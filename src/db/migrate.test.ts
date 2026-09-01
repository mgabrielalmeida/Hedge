import { runMigrations } from './migrate';
import type { Migration } from './migrations/migration';
import { createTestDatabase, type TestDatabase } from './testDatabase';

function createMigration(version: number, source: string): Migration {
  return {
    version,
    up: async (db) => db.execAsync(source),
  };
}

describe('runMigrations', () => {
  let database: TestDatabase;

  beforeEach(() => {
    database = createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it('runs pending migrations in order and advances the schema version', async () => {
    const migrations = [
      createMigration(1, 'CREATE TABLE first_table (id INTEGER PRIMARY KEY);'),
      createMigration(2, 'CREATE TABLE second_table (id INTEGER PRIMARY KEY);'),
    ];

    await runMigrations(database, migrations);

    await expect(
      database.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name;",
      ),
    ).resolves.toEqual([{ name: 'first_table' }, { name: 'second_table' }]);
    await expect(
      database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'),
    ).resolves.toEqual({ user_version: 2 });
  });

  it('skips applied migrations and runs only the pending suffix', async () => {
    await database.execAsync('CREATE TABLE first_table (id INTEGER PRIMARY KEY);');
    await database.execAsync('PRAGMA user_version = 1;');
    const firstUp = jest.fn(async () => undefined);
    const secondUp = jest.fn(async (db) => {
      await db.execAsync('CREATE TABLE second_table (id INTEGER PRIMARY KEY);');
    });
    const migrations: Migration[] = [
      { version: 1, up: firstUp },
      { version: 2, up: secondUp },
    ];

    await runMigrations(database, migrations);

    expect(firstUp).not.toHaveBeenCalled();
    expect(secondUp).toHaveBeenCalledTimes(1);
    await expect(
      database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'),
    ).resolves.toEqual({ user_version: 2 });
  });

  it('does not execute a migration when the database is already current', async () => {
    await database.execAsync('PRAGMA user_version = 1;');
    const up = jest.fn(async () => undefined);

    await runMigrations(database, [{ version: 1, up }]);

    expect(up).not.toHaveBeenCalled();
  });

  it('rejects migration lists that do not start at one or have a gap', async () => {
    await expect(
      runMigrations(database, [{ version: 0, up: async () => undefined }]),
    ).rejects.toThrow('Migration versions must be sequential');

    await expect(
      runMigrations(database, [
        { version: 1, up: async () => undefined },
        { version: 3, up: async () => undefined },
      ]),
    ).rejects.toThrow('Migration versions must be sequential');
  });

  it('rejects a database schema that is newer than the migration list', async () => {
    await database.execAsync('PRAGMA user_version = 2;');

    await expect(
      runMigrations(database, [
        createMigration(1, 'CREATE TABLE first_table (id INTEGER PRIMARY KEY);'),
      ]),
    ).rejects.toThrow('Database schema version 2 is newer');
  });

  it('rolls back a failed migration without advancing its schema version', async () => {
    const migrations: Migration[] = [
      createMigration(1, 'CREATE TABLE stable_table (id INTEGER PRIMARY KEY);'),
      {
        version: 2,
        up: async (db) => {
          await db.execAsync('CREATE TABLE rolled_back_table (id INTEGER PRIMARY KEY);');
          throw new Error('migration failed');
        },
      },
    ];

    await expect(runMigrations(database, migrations)).rejects.toThrow('migration failed');

    await expect(
      database.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name;",
      ),
    ).resolves.toEqual([{ name: 'stable_table' }]);
    await expect(
      database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'),
    ).resolves.toEqual({ user_version: 1 });
  });
});
