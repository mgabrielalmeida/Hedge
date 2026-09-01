import type { SQLiteDatabase } from 'expo-sqlite';

import { migrations } from './migrations';
import type { Migration } from './migrations/migration';

type SchemaVersionRow = {
  user_version: number;
};

function validateMigrations(items: readonly Migration[]): void {
  for (let index = 0; index < items.length; index += 1) {
    const expectedVersion = index + 1;

    if (items[index].version !== expectedVersion) {
      throw new Error(
        `Migration versions must be sequential. Expected ${expectedVersion}, received ${items[index].version}.`,
      );
    }
  }
}

export async function runMigrations(
  db: SQLiteDatabase,
  items: readonly Migration[] = migrations,
): Promise<void> {
  validateMigrations(items);

  const schemaVersion = await db.getFirstAsync<SchemaVersionRow>('PRAGMA user_version;');
  const currentVersion = schemaVersion?.user_version ?? 0;

  if (currentVersion > items.length) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than the app migration version ${items.length}.`,
    );
  }

  for (const migration of items) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await db.withExclusiveTransactionAsync(async (transaction) => {
      await migration.up(transaction);
      await transaction.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
  }
}
