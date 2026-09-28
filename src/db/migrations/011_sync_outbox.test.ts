import { runMigrations } from '@/db/migrate';
import { migrations } from '@/db/migrations';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';

import { syncOutboxMigration } from './011_sync_outbox';

describe('sync outbox migration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await runMigrations(database, migrations.slice(0, 10));
  });

  afterEach(() => database.close());

  it('creates the local reconciliation state and backfills unsent entities with dependencies', async () => {
    await database.runAsync(
      `INSERT INTO accounts (id, name, institution_name, visual_type, visual_value, icon_value, color_value)
       VALUES (1, 'Main', 'Bank', 'icon', 'bank', 'bank', '#123456');`,
    );
    await database.runAsync(
      `INSERT INTO transactions (id, kind, account_id, name, amount_cents, transaction_date)
       VALUES (1, 'opening_balance', 1, 'Initial', 1000, '2026-09-28');`,
    );

    await runMigrations(database);

    await expect(database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'))
      .resolves.toEqual({ user_version: 11 });
    const commands = await database.getAllAsync<{
      entity_kind: string; depends_on_json: string; expected_version: number;
    }>(`SELECT entity_kind, depends_on_json, expected_version FROM sync_outbox
        WHERE entity_kind IN ('account', 'transaction') ORDER BY entity_kind;`);
    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual(expect.objectContaining({ entity_kind: 'account', expected_version: 0 }));
    expect(JSON.parse(commands[1].depends_on_json)).toHaveLength(1);
    await expect(database.getFirstAsync<{ cursor_value: string | null }>('SELECT cursor_value FROM sync_state WHERE id = 1;'))
      .resolves.toEqual({ cursor_value: null });
  });

  it('keeps the entire schema change atomic when backfill is interrupted', async () => {
    await database.runAsync(
      `INSERT INTO accounts (id, name, institution_name, visual_type, visual_value, icon_value, color_value)
       VALUES (1, 'Main', 'Bank', 'icon', 'bank', 'bank', '#123456');`,
    );
    await expect(database.withExclusiveTransactionAsync(async (transaction) => {
      await syncOutboxMigration.up(transaction);
      throw new Error('simulated migration interruption');
    })).rejects.toThrow('simulated migration interruption');
    await expect(database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM sqlite_schema WHERE name = 'sync_outbox';`,
    )).resolves.toEqual({ count: 0 });

    await runMigrations(database);
    await expect(database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox;'))
      .resolves.toEqual({ count: 6 });
  });
});
