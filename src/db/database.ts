import { runMigrations } from './migrate';
import { seedDevelopmentData } from './developmentSeed';
import type { MigrationExecutorDatabase } from './migrations/migration';
import type { RepositoryDatabase } from './repositories/database';

export const DATABASE_NAME = 'hedge.db';

export async function initializeDatabase(
  db: MigrationExecutorDatabase & RepositoryDatabase,
): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
  if (typeof __DEV__ !== 'undefined' && __DEV__ && process.env.NODE_ENV !== 'test') {
    await seedDevelopmentData(db);
  }
}
