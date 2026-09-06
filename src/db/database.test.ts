import { initializeDatabase } from './database';
import { createFileTestDatabase, type TestDatabase } from './testDatabase';

describe('initializeDatabase', () => {
  let database: TestDatabase;

  beforeEach(() => {
    database = createFileTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it('configures the connection and installs the complete schema v1', async () => {
    await initializeDatabase(database);

    await expect(
      database.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys;'),
    ).resolves.toEqual({ foreign_keys: 1 });
    await expect(
      database.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode;'),
    ).resolves.toEqual({ journal_mode: 'wal' });
    await expect(
      database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'),
    ).resolves.toEqual({ user_version: 4 });
    await expect(
      database.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name;",
      ),
    ).resolves.toEqual([
      { name: 'accounts' },
      { name: 'categories' },
      { name: 'recurring_occurrences' },
      { name: 'recurring_rules' },
      { name: 'transactions' },
    ]);
    await expect(
      database.getAllAsync<{ name: string; strict: number }>(
        "SELECT name, strict FROM pragma_table_list WHERE schema = 'main' AND name NOT LIKE 'sqlite_%' ORDER BY name;",
      ),
    ).resolves.toEqual([
      { name: 'accounts', strict: 1 },
      { name: 'categories', strict: 1 },
      { name: 'recurring_occurrences', strict: 1 },
      { name: 'recurring_rules', strict: 1 },
      { name: 'transactions', strict: 1 },
    ]);
    await expect(
      database.getAllAsync<{ name: string }>(
        'SELECT name FROM categories ORDER BY id;',
      ),
    ).resolves.toEqual([
      { name: 'Compras' },
      { name: 'Assinatura' },
      { name: 'Entretenimento' },
      { name: 'Alimentação' },
      { name: 'Outros' },
    ]);
    await expect(
      database.getAllAsync<{ name: string }>('SELECT name FROM pragma_table_info(\'accounts\') WHERE name IN (\'icon_value\', \'color_value\') ORDER BY name;'),
    ).resolves.toEqual([{ name: 'color_value' }, { name: 'icon_value' }]);
  });

  it('is idempotent after the first initialization', async () => {
    await initializeDatabase(database);
    await initializeDatabase(database);

    await expect(
      database.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM categories;',
      ),
    ).resolves.toEqual({ count: 5 });
    await expect(
      database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;'),
    ).resolves.toEqual({ user_version: 4 });
  });

  it('enforces the financial, referential, and recurring invariants of schema v1', async () => {
    await initializeDatabase(database);
    await database.runAsync(
      'INSERT INTO accounts (id, name, institution_name, visual_type, visual_value) VALUES (?, ?, ?, ?, ?);',
      1,
      'Principal',
      'Banco A',
      'color',
      '#123456',
    );
    await database.runAsync(
      'INSERT INTO accounts (id, name, institution_name, visual_type, visual_value) VALUES (?, ?, ?, ?, ?);',
      2,
      'Reserva',
      'Banco B',
      'icon',
      'bank',
    );
    await database.runAsync(
      "INSERT INTO transactions (kind, account_id, name, amount_cents, transaction_date) VALUES ('opening_balance', ?, ?, ?, ?);",
      1,
      'Saldo inicial',
      10_000,
      '2026-09-01',
    );
    await database.runAsync(
      "INSERT INTO transactions (kind, account_id, category_id, name, amount_cents, transaction_date) VALUES ('expense', ?, ?, ?, ?, ?);",
      1,
      1,
      'Mercado',
      -2_000,
      '2026-09-01',
    );
    await database.runAsync(
      "INSERT INTO transactions (kind, account_id, destination_account_id, name, amount_cents, transaction_date) VALUES ('transfer', ?, ?, ?, ?, ?);",
      1,
      2,
      'Reserva',
      -3_000,
      '2026-09-01',
    );

    await expect(
      database.runAsync(
        "INSERT INTO transactions (kind, account_id, name, amount_cents, transaction_date) VALUES ('expense', ?, ?, ?, ?);",
        1,
        'Sinal inválido',
        1,
        '2026-09-01',
      ),
    ).rejects.toThrow();
    await expect(
      database.runAsync(
        "INSERT INTO transactions (kind, account_id, name, amount_cents, transaction_date) VALUES ('opening_balance', ?, ?, ?, ?);",
        1,
        'Saldo duplicado',
        0,
        '2026-09-01',
      ),
    ).rejects.toThrow();
    await expect(database.runAsync('DELETE FROM accounts WHERE id = ?;', 1)).rejects.toThrow();

    await database.runAsync(
      "INSERT INTO recurring_rules (id, kind, account_id, category_id, name, amount_cents, frequency, charge_day, start_date) VALUES (?, 'expense', ?, ?, ?, ?, 'monthly', ?, ?);",
      1,
      1,
      1,
      'Assinatura',
      -500,
      31,
      '2026-09-01',
    );
    await database.runAsync(
      "INSERT INTO transactions (id, kind, account_id, category_id, name, amount_cents, transaction_date) VALUES (?, 'expense', ?, ?, ?, ?, ?);",
      99,
      1,
      1,
      'Assinatura',
      -500,
      '2026-09-30',
    );
    await database.runAsync(
      'INSERT INTO recurring_occurrences (recurring_rule_id, scheduled_date, transaction_id) VALUES (?, ?, ?);',
      1,
      '2026-09-30',
      99,
    );
    await database.runAsync('DELETE FROM transactions WHERE id = ?;', 99);

    await expect(
      database.getFirstAsync<{ transaction_id: number | null }>(
        'SELECT transaction_id FROM recurring_occurrences WHERE recurring_rule_id = ? AND scheduled_date = ?;',
        1,
        '2026-09-30',
      ),
    ).resolves.toEqual({ transaction_id: null });
  });
});
