import type { SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrate';
import type { Migration, MigrationDatabase } from './migrations/migration';

function createDatabase(version = 0) {
  const executedSql: string[] = [];
  const transaction: MigrationDatabase = {
    execAsync: async (source) => {
      executedSql.push(source);
    },
  };

  const database = {
    getFirstAsync: async () => ({ user_version: version }),
    withExclusiveTransactionAsync: async (
      task: (db: MigrationDatabase) => Promise<void>,
    ) => task(transaction),
  } as unknown as SQLiteDatabase;

  return { database, executedSql };
}

describe('runMigrations', () => {
  it('runs pending migrations in order and advances the schema version', async () => {
    const { database, executedSql } = createDatabase();
    const migrations: Migration[] = [
      {
        version: 1,
        up: async (db) => db.execAsync('CREATE TABLE first_table (id INTEGER PRIMARY KEY);'),
      },
      {
        version: 2,
        up: async (db) => db.execAsync('CREATE TABLE second_table (id INTEGER PRIMARY KEY);'),
      },
    ];

    await runMigrations(database, migrations);

    expect(executedSql).toEqual([
      'CREATE TABLE first_table (id INTEGER PRIMARY KEY);',
      'PRAGMA user_version = 1;',
      'CREATE TABLE second_table (id INTEGER PRIMARY KEY);',
      'PRAGMA user_version = 2;',
    ]);
  });

  it('rejects migration lists with a version gap', async () => {
    const { database } = createDatabase();

    await expect(
      runMigrations(database, [
        { version: 2, up: async () => undefined },
      ]),
    ).rejects.toThrow('Migration versions must be sequential');
  });
});
