import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrate';

export const DATABASE_NAME = 'hedge.db';

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(db);
}
