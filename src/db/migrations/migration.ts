import type { SQLiteDatabase } from 'expo-sqlite';

export type MigrationDatabase = Pick<SQLiteDatabase, 'execAsync'>;

export type Migration = {
  version: number;
  up: (db: MigrationDatabase) => Promise<void>;
};
