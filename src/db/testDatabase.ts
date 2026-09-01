import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  MigrationDatabase,
  MigrationExecutorDatabase,
} from './migrations/migration';

export class TestDatabase implements MigrationExecutorDatabase {
  private readonly database: DatabaseSync;

  public constructor(
    filename = ':memory:',
    private readonly cleanup?: () => void,
  ) {
    this.database = new DatabaseSync(filename, {
      enableForeignKeyConstraints: false,
    });
  }

  public async execAsync(source: string): Promise<void> {
    this.database.exec(source);
  }

  public async getAllAsync<T>(
    source: string,
    ...parameters: SQLInputValue[]
  ): Promise<T[]> {
    return this.database.prepare(source).all(...parameters) as T[];
  }

  public async getFirstAsync<T>(
    source: string,
    ...parameters: SQLInputValue[]
  ): Promise<T | null> {
    return (this.database.prepare(source).get(...parameters) as T | undefined) ?? null;
  }

  public async runAsync(
    source: string,
    ...parameters: SQLInputValue[]
  ): Promise<void> {
    this.database.prepare(source).run(...parameters);
  }

  public async withExclusiveTransactionAsync(
    task: (transaction: MigrationDatabase) => Promise<void>,
  ): Promise<void> {
    this.database.exec('BEGIN EXCLUSIVE;');

    try {
      await task(this);
      this.database.exec('COMMIT;');
    } catch (error) {
      this.database.exec('ROLLBACK;');
      throw error;
    }
  }

  public close(): void {
    this.database.close();
    this.cleanup?.();
  }
}

export function createTestDatabase(): TestDatabase {
  return new TestDatabase();
}

export function createFileTestDatabase(): TestDatabase {
  const directory = mkdtempSync(join(tmpdir(), 'hedge-sqlite-test-'));
  const filename = join(directory, 'database.db');

  return new TestDatabase(filename, () => {
    rmSync(directory, { force: true, recursive: true });
  });
}
