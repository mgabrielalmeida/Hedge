import {
  backupDatabaseAsync,
  deserializeDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { initializeDatabase } from './database';
import { migrations } from './migrations';
import { runMigrations } from './migrate';
import { isThemePreferences, loadThemePreferences, type ThemePreferences } from './preferences';

const BACKUP_FORMAT = 'com.hedge.backup';
const BACKUP_FORMAT_VERSION = 2;
const BACKUP_METADATA_TABLE = '__hedge_backup_metadata_v1';

type BackupMetadataRow = {
  created_at: string;
  format: string;
  format_version: number;
  preferences_json: string;
  schema_version: number;
  profile_id?: string;
  ledger_id?: string;
  generation?: number;
};

type IntegrityCheckRow = { quick_check: string };
type SchemaVersionRow = { user_version: number };

export type BackupProfileIdentity = {
  readonly profileId: string;
  readonly ledgerId: string;
  readonly generation: number;
};

export type PreparedBackup = {
  readonly database: SQLiteDatabase;
  readonly preferences: ThemePreferences;
  readonly profile: BackupProfileIdentity;
  readonly isLinkedToProfile: boolean;
};

export type BackupErrorCode = 'invalid-file' | 'newer-backup' | 'profile-mismatch' | 'restore-failed';

export class BackupError extends Error {
  public constructor(public readonly code: BackupErrorCode, message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export async function createBackupBytes(
  database: SQLiteDatabase,
  createdAt = new Date(),
): Promise<Uint8Array> {
  const [backupDatabase, preferences] = await Promise.all([
    openDatabaseAsync(':memory:', { useNewConnection: true }),
    loadThemePreferences(),
  ]);

  try {
    await backupDatabaseAsync({ destDatabase: backupDatabase, sourceDatabase: database });
    await prepareInMemoryDatabaseForWrites(backupDatabase);
    const [schemaVersion, profile] = await Promise.all([
      readSchemaVersion(backupDatabase),
      readLocalProfile(backupDatabase),
    ]);
    await removeTechnicalSyncState(backupDatabase);
    await backupDatabase.execAsync(`
      CREATE TABLE ${BACKUP_METADATA_TABLE} (
        id INTEGER PRIMARY KEY CHECK (id = 1), format TEXT NOT NULL,
        format_version INTEGER NOT NULL, created_at TEXT NOT NULL,
        schema_version INTEGER NOT NULL, preferences_json TEXT NOT NULL,
        profile_id TEXT NOT NULL, ledger_id TEXT NOT NULL,
        generation INTEGER NOT NULL CHECK (generation > 0)
      ) STRICT;
    `);
    await backupDatabase.runAsync(
      `INSERT INTO ${BACKUP_METADATA_TABLE} (
        id, format, format_version, created_at, schema_version, preferences_json,
        profile_id, ledger_id, generation
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?);`,
      BACKUP_FORMAT, BACKUP_FORMAT_VERSION, createdAt.toISOString(), schemaVersion,
      JSON.stringify(preferences), profile.profileId, profile.ledgerId, profile.generation,
    );
    return await backupDatabase.serializeAsync();
  } finally {
    await backupDatabase.closeAsync();
  }
}

/** Opens and migrates a backup in memory without changing any active database. */
export async function prepareBackupRestore(
  backupBytes: Uint8Array,
  expectedProfile?: BackupProfileIdentity,
): Promise<PreparedBackup> {
  const database = await openAndValidateBackup(backupBytes);
  try {
    const metadata = await readBackupMetadata(database);
    const preferences = parseBackupPreferences(metadata.preferences_json);
    const isLinkedToProfile = metadata.format_version >= 2;
    if (isLinkedToProfile && !metadata.profile_id) {
      throw new BackupError('invalid-file', 'A identidade vinculada do backup é inválida.');
    }
    if (expectedProfile && isLinkedToProfile && (
      metadata.profile_id !== expectedProfile.profileId || metadata.ledger_id !== expectedProfile.ledgerId
    )) {
      throw new BackupError('profile-mismatch', 'Este backup pertence a outro perfil local.');
    }
    await prepareInMemoryDatabaseForWrites(database);
    await database.execAsync(`DROP TABLE ${BACKUP_METADATA_TABLE};`);
    await runMigrations(database);
    const integrity = await database.getFirstAsync<IntegrityCheckRow>('PRAGMA quick_check;');
    if (integrity?.quick_check !== 'ok') {
      throw new BackupError('invalid-file', 'O banco restaurado não passou na verificação de integridade.');
    }
    return { database, preferences, profile: await readLocalProfile(database), isLinkedToProfile };
  } catch (error) {
    await database.closeAsync();
    if (error instanceof BackupError) throw error;
    throw new BackupError('restore-failed', 'Não foi possível preparar a restauração do backup.');
  }
}

export async function copyPreparedBackupToDatabase(
  prepared: PreparedBackup,
  destination: SQLiteDatabase,
  databaseName: string,
  nextGeneration: number,
): Promise<BackupProfileIdentity> {
  try {
    await backupDatabaseAsync({ destDatabase: destination, sourceDatabase: prepared.database });
    await initializeDatabase(destination, { createRecoveryCopy: true, databaseName });
    await destination.runAsync(
      `UPDATE local_profile SET generation = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1;`,
      nextGeneration,
    );
    const integrity = await destination.getFirstAsync<IntegrityCheckRow>('PRAGMA quick_check;');
    if (integrity?.quick_check !== 'ok') throw new Error('Restored database failed integrity check.');
    return await readLocalProfile(destination);
  } catch (error) {
    if (error instanceof BackupError) throw error;
    throw new BackupError('restore-failed', 'Não foi possível criar a nova geração do banco restaurado.');
  }
}

async function openAndValidateBackup(bytes: Uint8Array): Promise<SQLiteDatabase> {
  let database: SQLiteDatabase;
  try { database = await deserializeDatabaseAsync(bytes); } catch {
    throw new BackupError('invalid-file', 'O arquivo não contém um banco de dados válido.');
  }
  try {
    const integrity = await database.getFirstAsync<IntegrityCheckRow>('PRAGMA quick_check;');
    if (integrity?.quick_check !== 'ok') throw new BackupError('invalid-file', 'O arquivo de backup está corrompido.');
    const metadata = await readBackupMetadata(database);
    const schemaVersion = await readSchemaVersion(database);
    if (metadata.format !== BACKUP_FORMAT || metadata.format_version < 1) {
      throw new BackupError('invalid-file', 'O arquivo não é um backup reconhecido do Hedge.');
    }
    if (metadata.format_version > BACKUP_FORMAT_VERSION || schemaVersion > migrations.length) {
      throw new BackupError('newer-backup', 'Este backup foi criado por uma versão mais recente do Hedge.');
    }
    if (metadata.schema_version !== schemaVersion || schemaVersion < 1) {
      throw new BackupError('invalid-file', 'A versão do banco no backup é inválida.');
    }
    parseBackupPreferences(metadata.preferences_json);
    return database;
  } catch (error) {
    await database.closeAsync();
    if (error instanceof BackupError) throw error;
    throw new BackupError('invalid-file', 'O arquivo não é um backup reconhecido do Hedge.');
  }
}

async function readBackupMetadata(database: SQLiteDatabase): Promise<BackupMetadataRow> {
  const metadata = await database.getFirstAsync<BackupMetadataRow>(
    `SELECT format, format_version, created_at, schema_version, preferences_json
      FROM ${BACKUP_METADATA_TABLE} WHERE id = 1;`,
  );
  if (!metadata || Number.isNaN(Date.parse(metadata.created_at))) {
    throw new BackupError('invalid-file', 'Os metadados do backup são inválidos.');
  }
  if (metadata.format_version < 2) return metadata;
  const identity = await database.getFirstAsync<Pick<BackupMetadataRow, 'profile_id' | 'ledger_id' | 'generation'>>(
    `SELECT profile_id, ledger_id, generation FROM ${BACKUP_METADATA_TABLE} WHERE id = 1;`,
  );
  return { ...metadata, ...identity };
}

async function readLocalProfile(database: SQLiteDatabase): Promise<BackupProfileIdentity> {
  const profile = await database.getFirstAsync<{ profile_id: string; ledger_id: string; generation: number }>(
    'SELECT profile_id, ledger_id, generation FROM local_profile WHERE id = 1;',
  );
  if (!profile || !isIdentifier(profile.profile_id) || !isIdentifier(profile.ledger_id)
    || !Number.isSafeInteger(profile.generation) || profile.generation < 1) {
    throw new BackupError('invalid-file', 'A identidade local do backup é inválida.');
  }
  return { profileId: profile.profile_id, ledgerId: profile.ledger_id, generation: profile.generation };
}

async function removeTechnicalSyncState(database: SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    DELETE FROM sync_outbox; DELETE FROM sync_confirmed_entities; DELETE FROM sync_receipts;
    DELETE FROM sync_applied_events; DELETE FROM sync_conflicts;
    UPDATE sync_state SET cursor_value = NULL;
    DELETE FROM recurrence_processing_checkpoints; DELETE FROM recurrence_processing_batches;
  `);
}

async function readSchemaVersion(database: SQLiteDatabase): Promise<number> {
  const row = await database.getFirstAsync<SchemaVersionRow>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}

function parseBackupPreferences(value: string): ThemePreferences {
  try { const preferences: unknown = JSON.parse(value); if (isThemePreferences(preferences)) return preferences; } catch { /* invalid below */ }
  throw new BackupError('invalid-file', 'As preferências do backup são inválidas.');
}

async function prepareInMemoryDatabaseForWrites(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = MEMORY;');
}

function isIdentifier(value: string): boolean { return value.trim().length > 0 && value.length <= 200; }
