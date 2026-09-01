import type { SQLiteDatabase } from 'expo-sqlite';

export type MigrationDatabase = Pick<SQLiteDatabase, 'execAsync'>;

export type MigrationExecutorDatabase = MigrationDatabase & {
  getFirstAsync: <T>(source: string) => Promise<T | null>;
  withExclusiveTransactionAsync: (
    task: (transaction: MigrationDatabase) => Promise<void>,
  ) => Promise<void>;
};

export type Migration = {
  version: number;
  up: (db: MigrationDatabase) => Promise<void>;
};
