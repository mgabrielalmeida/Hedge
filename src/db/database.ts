import { runMigrations } from './migrate';
import type { MigrationExecutorDatabase } from './migrations/migration';

export const DATABASE_NAME = 'hedge.db';

export async function initializeDatabase(
  db: MigrationExecutorDatabase,
): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
}
