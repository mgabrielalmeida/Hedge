import { runMigrations } from '@/db/migrate';
import { migrations } from '@/db/migrations';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';

describe('financial conflicts migration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await runMigrations(database, migrations.slice(0, 10));
  });

  afterEach(() => database.close());

  it('backfills financial versions and deterministic generated transaction identities', async () => {
    await database.runAsync(
      `INSERT INTO accounts (id, sync_id, name, institution_name, visual_type, visual_value, icon_value, color_value)
       VALUES (100, 'account-100', 'Main', 'Bank', 'icon', 'bank', 'bank', '#123456');`,
    );
    await database.runAsync(
      `INSERT INTO recurring_rules (
         id, sync_id, kind, account_id, name, amount_cents, frequency, charge_day, start_date
       ) VALUES (100, 'rule-100', 'income', 100, 'Salary', 1000, 'monthly', 10, '2026-01-01');`,
    );
    await database.runAsync(
      `INSERT INTO transactions (
         id, sync_id, kind, account_id, name, amount_cents, transaction_date
       ) VALUES (100, 'old-random-id', 'income', 100, 'Salary', 1000, '2026-01-10');`,
    );
    await database.runAsync(
      `INSERT INTO recurring_occurrences (
         id, sync_id, recurring_rule_id, scheduled_date, transaction_id
       ) VALUES (100, 'rule-100:2026-01-10', 100, '2026-01-10', 100);`,
    );

    await runMigrations(database);

    await expect(database.getFirstAsync<{ financial_version: number }>(
      'SELECT financial_version FROM accounts WHERE id = 100;',
    )).resolves.toEqual({ financial_version: 1 });
    await expect(database.getFirstAsync<{ sync_id: string }>(
      'SELECT sync_id FROM transactions WHERE id = 100;',
    )).resolves.toEqual({ sync_id: 'rule-100:2026-01-10:transaction' });
    await expect(database.getFirstAsync<{ entity_sync_id: string }>(
      `SELECT entity_sync_id FROM sync_outbox
       WHERE entity_kind = 'transaction' AND payload_json LIKE '%Salary%';`,
    )).resolves.toEqual({ entity_sync_id: 'rule-100:2026-01-10:transaction' });
  });

  it('installs persisted recurrence progress and explicit conflict review fields', async () => {
    await runMigrations(database);
    await database.runAsync(
      "UPDATE local_profile SET financial_timezone = 'America/Fortaleza' WHERE id = 1;",
    );
    await expect(database.runAsync(
      "UPDATE local_profile SET financial_timezone = 'UTC' WHERE id = 1;",
    )).rejects.toThrow('financial timezone is immutable');
    await expect(database.getFirstAsync<{ financial_timezone: string }>(
      'SELECT financial_timezone FROM local_profile WHERE id = 1;',
    )).resolves.toEqual({ financial_timezone: 'America/Fortaleza' });
    await expect(database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM pragma_table_info('sync_conflicts')
       WHERE name IN ('review_kind', 'resolution');`,
    )).resolves.toEqual({ count: 2 });
    await expect(database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM sqlite_schema
       WHERE type = 'table' AND name IN ('recurrence_processing_batches', 'recurrence_processing_checkpoints');`,
    )).resolves.toEqual({ count: 2 });
  });
});
