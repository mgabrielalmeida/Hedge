import {
  backupDatabaseAsync,
  deserializeDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { initializeDatabase } from './database';
import { migrations } from './migrations';
import { runMigrations } from './migrate';
import {
  isThemePreferences,
  loadThemePreferences,
  saveThemePreferences,
  type ThemePreferences,
} from './preferences';

const BACKUP_FORMAT = 'com.hedge.backup';
const BACKUP_FORMAT_VERSION = 1;
const BACKUP_METADATA_TABLE = '__hedge_backup_metadata_v1';

type BackupMetadataRow = {
  created_at: string;
  format: string;
  format_version: number;
  preferences_json: string;
  schema_version: number;
};

type IntegrityCheckRow = {
  quick_check: string;
};

type SchemaVersionRow = {
  user_version: number;
};

export type BackupErrorCode =
  | 'invalid-file'
  | 'newer-backup'
  | 'restore-failed';

export class BackupError extends Error {
  public constructor(
    public readonly code: BackupErrorCode,
    message: string,
  ) {
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
    await backupDatabaseAsync({
      destDatabase: backupDatabase,
      sourceDatabase: database,
    });
    await prepareInMemoryDatabaseForWrites(backupDatabase);
    const schemaVersion = await readSchemaVersion(backupDatabase);

    await backupDatabase.execAsync(`
      CREATE TABLE ${BACKUP_METADATA_TABLE} (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        format TEXT NOT NULL,
        format_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        schema_version INTEGER NOT NULL,
        preferences_json TEXT NOT NULL
      ) STRICT;
    `);
    await backupDatabase.runAsync(
      `INSERT INTO ${BACKUP_METADATA_TABLE} (
        id, format, format_version, created_at, schema_version, preferences_json
      ) VALUES (1, ?, ?, ?, ?, ?);`,
      BACKUP_FORMAT,
      BACKUP_FORMAT_VERSION,
      createdAt.toISOString(),
      schemaVersion,
      JSON.stringify(preferences),
    );

    return await backupDatabase.serializeAsync();
  } finally {
    await backupDatabase.closeAsync();
  }
}

export async function restoreBackupBytes(
  database: SQLiteDatabase,
  backupBytes: Uint8Array,
): Promise<ThemePreferences> {
  const backupDatabase = await openAndValidateBackup(backupBytes);
  const [rollbackDatabase, currentPreferences] = await Promise.all([
    openDatabaseAsync(':memory:', { useNewConnection: true }),
    loadThemePreferences(),
  ]);
  let destinationMayHaveChanged = false;

  try {
    await backupDatabaseAsync({
      destDatabase: rollbackDatabase,
      sourceDatabase: database,
    });
    const metadata = await readBackupMetadata(backupDatabase);
    const preferences = parseBackupPreferences(metadata.preferences_json);

    await prepareInMemoryDatabaseForWrites(backupDatabase);
    await backupDatabase.execAsync(`DROP TABLE ${BACKUP_METADATA_TABLE};`);
    await runMigrations(backupDatabase);

    destinationMayHaveChanged = true;
    await backupDatabaseAsync({
      destDatabase: database,
      sourceDatabase: backupDatabase,
    });
    await initializeDatabase(database);
    await saveThemePreferences(preferences);

    return preferences;
  } catch (error) {
    if (destinationMayHaveChanged) {
      try {
        await backupDatabaseAsync({
          destDatabase: database,
          sourceDatabase: rollbackDatabase,
        });
        await initializeDatabase(database);
        await saveThemePreferences(currentPreferences);
      } catch {
        throw new BackupError(
          'restore-failed',
          'A restauração falhou e o backup de segurança não pôde ser reaplicado.',
        );
      }
    }

    if (error instanceof BackupError) throw error;
    throw new BackupError('restore-failed', 'Não foi possível restaurar o backup.');
  } finally {
    await backupDatabase.closeAsync();
    await rollbackDatabase.closeAsync();
  }
}

async function openAndValidateBackup(bytes: Uint8Array): Promise<SQLiteDatabase> {
  let database: SQLiteDatabase;

  try {
    database = await deserializeDatabaseAsync(bytes);
  } catch {
    throw new BackupError('invalid-file', 'O arquivo não contém um banco de dados válido.');
  }

  try {
    const integrity = await database.getFirstAsync<IntegrityCheckRow>('PRAGMA quick_check;');
    if (integrity?.quick_check !== 'ok') {
      throw new BackupError('invalid-file', 'O arquivo de backup está corrompido.');
    }

    const metadata = await readBackupMetadata(database);
    const schemaVersion = await readSchemaVersion(database);

    if (metadata.format !== BACKUP_FORMAT || metadata.format_version < 1) {
      throw new BackupError('invalid-file', 'O arquivo não é um backup reconhecido do Hedge.');
    }
    if (metadata.format_version > BACKUP_FORMAT_VERSION) {
      throw new BackupError(
        'newer-backup',
        'Este backup foi criado por uma versão mais recente do Hedge.',
      );
    }
    if (metadata.schema_version !== schemaVersion || schemaVersion < 1) {
      throw new BackupError('invalid-file', 'A versão do banco no backup é inválida.');
    }
    if (schemaVersion > migrations.length) {
      throw new BackupError(
        'newer-backup',
        'Este backup usa uma versão de dados mais recente que o aplicativo.',
      );
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
     FROM ${BACKUP_METADATA_TABLE}
     WHERE id = 1;`,
  );

  if (!metadata || Number.isNaN(Date.parse(metadata.created_at))) {
    throw new BackupError('invalid-file', 'Os metadados do backup são inválidos.');
  }

  return metadata;
}

async function readSchemaVersion(database: SQLiteDatabase): Promise<number> {
  const row = await database.getFirstAsync<SchemaVersionRow>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}

function parseBackupPreferences(value: string): ThemePreferences {
  try {
    const preferences: unknown = JSON.parse(value);
    if (isThemePreferences(preferences)) return preferences;
  } catch {
    // The common invalid-file error below gives the user a useful recovery path.
  }

  throw new BackupError('invalid-file', 'As preferências do backup são inválidas.');
}

async function prepareInMemoryDatabaseForWrites(
  database: SQLiteDatabase,
): Promise<void> {
  // A copied or serialized file can keep WAL in its header. An in-memory
  // database cannot create the corresponding -wal file, so switch journals
  // before any write.
  await database.execAsync('PRAGMA journal_mode = MEMORY;');
}
