import type { Migration } from './migration';

export const INITIAL_SCHEMA_SQL = `
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  institution_name TEXT NOT NULL CHECK (length(trim(institution_name)) > 0),
  visual_type TEXT NOT NULL CHECK (visual_type IN ('icon', 'color')),
  visual_value TEXT NOT NULL CHECK (length(trim(visual_value)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0),
  monthly_budget_cents INTEGER NOT NULL DEFAULT 0
    CHECK (monthly_budget_cents BETWEEN 0 AND 9007199254740991),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE recurring_rules (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  amount_cents INTEGER NOT NULL
    CHECK (amount_cents BETWEEN -9007199254740991 AND 9007199254740991)
    CHECK (
      (kind = 'expense' AND amount_cents < 0) OR
      (kind = 'income' AND amount_cents > 0)
    ),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  charge_day INTEGER NOT NULL,
  charge_month INTEGER,
  start_date TEXT NOT NULL
    CHECK (
      length(start_date) = 10 AND
      start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    ),
  end_date TEXT
    CHECK (
      end_date IS NULL OR (
        length(end_date) = 10 AND
        end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
        end_date >= start_date
      )
    ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (category_id IS NULL OR kind = 'expense'),
  CHECK (kind <> 'expense' OR category_id IS NOT NULL OR is_active = 0),
  CHECK (deleted_at IS NULL OR is_active = 0),
  CHECK (
    (
      frequency = 'weekly' AND
      charge_day BETWEEN 1 AND 7 AND
      charge_month IS NULL
    ) OR
    (
      frequency = 'monthly' AND
      charge_day BETWEEN 1 AND 31 AND
      charge_month IS NULL
    ) OR
    (
      frequency = 'yearly' AND
      charge_day BETWEEN 1 AND 31 AND
      charge_month BETWEEN 1 AND 12
    )
  )
) STRICT;

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL
    CHECK (kind IN ('expense', 'income', 'transfer', 'opening_balance')),
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  destination_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT,
  amount_cents INTEGER NOT NULL
    CHECK (amount_cents BETWEEN -9007199254740991 AND 9007199254740991),
  transaction_date TEXT NOT NULL
    CHECK (
      length(transaction_date) = 10 AND
      transaction_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (
      kind = 'expense' AND
      amount_cents < 0 AND
      destination_account_id IS NULL
    ) OR
    (
      kind = 'income' AND
      amount_cents > 0 AND
      destination_account_id IS NULL
    ) OR
    (
      kind = 'transfer' AND
      amount_cents < 0 AND
      destination_account_id IS NOT NULL AND
      destination_account_id <> account_id
    ) OR
    (
      kind = 'opening_balance' AND
      destination_account_id IS NULL
    )
  ),
  CHECK (category_id IS NULL OR kind = 'expense')
) STRICT;

CREATE TABLE recurring_occurrences (
  id INTEGER PRIMARY KEY,
  recurring_rule_id INTEGER NOT NULL
    REFERENCES recurring_rules(id) ON DELETE RESTRICT,
  scheduled_date TEXT NOT NULL
    CHECK (
      length(scheduled_date) = 10 AND
      scheduled_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    ),
  transaction_id INTEGER UNIQUE REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (recurring_rule_id, scheduled_date)
) STRICT;

CREATE UNIQUE INDEX transactions_one_opening_balance_per_account
  ON transactions(account_id)
  WHERE kind = 'opening_balance';

CREATE INDEX transactions_by_account_date
  ON transactions(account_id, transaction_date DESC, id DESC);

CREATE INDEX transactions_by_destination_date
  ON transactions(destination_account_id, transaction_date DESC, id DESC)
  WHERE destination_account_id IS NOT NULL;

CREATE INDEX transactions_by_category_date
  ON transactions(category_id, transaction_date DESC, id DESC)
  WHERE category_id IS NOT NULL AND kind = 'expense';

CREATE INDEX recurring_rules_by_account
  ON recurring_rules(account_id);

CREATE INDEX recurring_rules_by_category
  ON recurring_rules(category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX recurring_rules_active
  ON recurring_rules(is_active, start_date, end_date)
  WHERE deleted_at IS NULL;

CREATE INDEX recurring_occurrences_by_transaction
  ON recurring_occurrences(transaction_id)
  WHERE transaction_id IS NOT NULL;

INSERT INTO categories (name, monthly_budget_cents) VALUES
  ('Compras', 0),
  ('Assinatura', 0),
  ('Entretenimento', 0),
  ('Alimentação', 0),
  ('Outros', 0);
`;

export const initialSchemaMigration: Migration = {
  version: 1,
  up: async (db) => {
    await db.execAsync(INITIAL_SCHEMA_SQL);
  },
};
