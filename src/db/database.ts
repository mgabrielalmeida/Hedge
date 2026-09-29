import {
  backupDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { runMigrations } from './migrate';
import type { MigrationExecutorDatabase } from './migrations/migration';
import { resolveSystemTimeZone } from '@/utils/financialTimeZone';

export const DATABASE_NAME = 'hedge.db';
export const GLOBAL_IDENTITY_SCHEMA_VERSION = 9;

type SchemaVersionRow = { user_version: number };
type IntegrityCheckRow = { quick_check: string };

type InitializeDatabaseOptions = {
  readonly databaseName?: string;
  readonly createRecoveryCopy?: boolean;
};

export async function initializeDatabase(
  db: MigrationExecutorDatabase,
  options: InitializeDatabaseOptions = {},
): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const version = await readSchemaVersion(db);
  if (
    options.createRecoveryCopy
    && options.databaseName
    && version > 0
    && version < GLOBAL_IDENTITY_SCHEMA_VERSION
  ) {
    await createPreIdentityRecoveryCopy(db as SQLiteDatabase, options.databaseName);
  }
  await runMigrations(db);
  await ensureFinancialTimeZone(db);
}

async function ensureFinancialTimeZone(db: MigrationExecutorDatabase): Promise<void> {
  const profile = await db.getFirstAsync<{ financial_timezone: string | null }>(
    'SELECT financial_timezone FROM local_profile WHERE id = 1;',
  );
  if (!profile) throw new Error('Local profile is unavailable.');
  if (profile.financial_timezone !== null) return;
  await db.runAsync(
    'UPDATE local_profile SET financial_timezone = ?, updated_at = ? WHERE id = 1 AND financial_timezone IS NULL;',
    resolveSystemTimeZone(),
    new Date().toISOString(),
  );
}

export function recoveryDatabaseName(databaseName: string): string {
  const suffix = '.db';
  const basename = databaseName.endsWith(suffix)
    ? databaseName.slice(0, -suffix.length)
    : databaseName;
  return `${basename}.pre-global-identity.v${GLOBAL_IDENTITY_SCHEMA_VERSION - 1}.recovery.db`;
}

async function createPreIdentityRecoveryCopy(
  database: SQLiteDatabase,
  databaseName: string,
): Promise<void> {
  const recovery = await openDatabaseAsync(recoveryDatabaseName(databaseName), {
    useNewConnection: true,
  });
  try {
    await backupDatabaseAsync({ destDatabase: recovery, sourceDatabase: database });
    const integrity = await recovery.getFirstAsync<IntegrityCheckRow>('PRAGMA quick_check;');
    if (integrity?.quick_check !== 'ok') {
      throw new Error('The pre-identity recovery copy failed its integrity check.');
    }
  } finally {
    await recovery.closeAsync();
  }
}

async function readSchemaVersion(db: MigrationExecutorDatabase): Promise<number> {
  const row = await db.getFirstAsync<SchemaVersionRow>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}
