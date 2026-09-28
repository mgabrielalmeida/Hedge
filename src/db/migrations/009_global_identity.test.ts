import { runMigrations } from '@/db/migrate';
import { migrations } from '@/db/migrations';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';

import { globalIdentityMigration } from './009_global_identity';

describe('global identity migration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await runMigrations(database, migrations.slice(0, 8));
    await seedLegacyData(database);
  });

  afterEach(() => database.close());

  it('assigns immutable unique identities while preserving relations and balances', async () => {
    const balanceBefore = await accountBalance(database, 1);

    await runMigrations(database);

    for (const table of ['accounts', 'categories', 'recurring_rules', 'transactions', 'recurring_occurrences']) {
      const rows = await database.getAllAsync<{ sync_id: string; sync_version: number }>(
        `SELECT sync_id, sync_version FROM ${table};`,
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.sync_id.length > 0 && row.sync_version === 0)).toBe(true);
      expect(new Set(rows.map((row) => row.sync_id)).size).toBe(rows.length);
    }

    const occurrence = await database.getFirstAsync<{ sync_id: string; expected: string; recurring_rule_id: number; transaction_id: number }>(
      `SELECT o.sync_id, r.sync_id || ':' || o.scheduled_date AS expected,
              o.recurring_rule_id, o.transaction_id
       FROM recurring_occurrences o JOIN recurring_rules r ON r.id = o.recurring_rule_id;`,
    );
    expect(occurrence).toEqual(expect.objectContaining({ recurring_rule_id: 1, transaction_id: 2 }));
    expect(occurrence?.sync_id).toBe(occurrence?.expected);
    await expect(accountBalance(database, 1)).resolves.toBe(balanceBefore);

    const account = await database.getFirstAsync<{ sync_id: string }>('SELECT sync_id FROM accounts WHERE id = 1;');
    await expect(database.runAsync('UPDATE accounts SET sync_id = NULL WHERE id = 1;')).rejects.toThrow();
    await expect(database.runAsync('UPDATE accounts SET sync_id = ? WHERE id = 1;', 'replacement')).rejects.toThrow();
    await expect(database.getFirstAsync('SELECT sync_id FROM accounts WHERE id = 1;')).resolves.toEqual(account);
  });

  it('assigns identities to rows created after the migration', async () => {
    await runMigrations(database);
    await database.runAsync(
      "INSERT INTO accounts (name, institution_name, visual_type, visual_value) VALUES ('Nova', 'Banco', 'icon', 'bank');",
    );
    await expect(database.getFirstAsync<{ sync_id: string }>(
      "SELECT sync_id FROM accounts WHERE name = 'Nova';",
    )).resolves.toEqual({ sync_id: expect.stringMatching(/^[0-9a-f]{32}$/) });
  });

  it('rolls back an interrupted identity migration and resumes without duplicates', async () => {
    await expect(database.withExclusiveTransactionAsync(async (transaction) => {
      await globalIdentityMigration.up(transaction);
      throw new Error('interrupted');
    })).rejects.toThrow('interrupted');

    await expect(database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'))
      .resolves.toEqual({ user_version: 8 });
    await expect(database.getAllAsync("SELECT name FROM pragma_table_info('accounts') WHERE name = 'sync_id';"))
      .resolves.toEqual([]);

    await runMigrations(database);
    const rows = await database.getAllAsync<{ sync_id: string }>('SELECT sync_id FROM accounts;');
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.sync_id)).size).toBe(2);
  });
});

async function seedLegacyData(database: TestDatabase): Promise<void> {
  await database.runAsync(
    "INSERT INTO accounts (id, name, institution_name, visual_type, visual_value) VALUES (1, 'Principal', 'Banco', 'icon', 'bank'), (2, 'Reserva', 'Banco', 'icon', 'vault');",
  );
  await database.runAsync(
    "INSERT INTO transactions (id, kind, account_id, name, amount_cents, transaction_date) VALUES (1, 'opening_balance', 1, 'Saldo', 10000, '2026-09-01');",
  );
  await database.runAsync(
    "INSERT INTO recurring_rules (id, kind, account_id, category_id, name, amount_cents, frequency, charge_day, start_date) VALUES (1, 'expense', 1, 1, 'Mercado', -2000, 'monthly', 10, '2026-09-01');",
  );
  await database.runAsync(
    "INSERT INTO transactions (id, kind, account_id, category_id, name, amount_cents, transaction_date) VALUES (2, 'expense', 1, 1, 'Mercado', -2000, '2026-09-10');",
  );
  await database.runAsync(
    "INSERT INTO recurring_occurrences (id, recurring_rule_id, scheduled_date, transaction_id) VALUES (1, 1, '2026-09-10', 2);",
  );
}

async function accountBalance(database: TestDatabase, accountId: number): Promise<number> {
  const row = await database.getFirstAsync<{ balance: number }>(
    'SELECT COALESCE(SUM(amount_cents), 0) AS balance FROM transactions WHERE account_id = ?;',
    accountId,
  );
  return row?.balance ?? 0;
}
