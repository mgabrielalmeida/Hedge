import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'hedge.db';

export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
}
