import type { Migration } from './migration';

const ENTITY_TABLES = [
  'accounts',
  'categories',
  'recurring_rules',
  'transactions',
] as const;

export const globalIdentityMigration: Migration = {
  version: 9,
  up: async (db) => {
    for (const table of ENTITY_TABLES) {
      await db.execAsync(`
        ALTER TABLE ${table} ADD COLUMN sync_id TEXT
          CHECK (sync_id IS NULL OR length(trim(sync_id)) > 0);
        ALTER TABLE ${table} ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0
          CHECK (sync_version >= 0);
      `);
    }

    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN deleted_at TEXT;
      ALTER TABLE categories ADD COLUMN deleted_at TEXT;
      ALTER TABLE transactions ADD COLUMN deleted_at TEXT;

      ALTER TABLE recurring_occurrences ADD COLUMN sync_id TEXT
        CHECK (sync_id IS NULL OR length(trim(sync_id)) > 0);
      ALTER TABLE recurring_occurrences ADD COLUMN sync_version INTEGER NOT NULL DEFAULT 0
        CHECK (sync_version >= 0);
      ALTER TABLE recurring_occurrences ADD COLUMN deleted_at TEXT;

      UPDATE accounts SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL;
      UPDATE categories SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL;
      UPDATE recurring_rules SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL;
      UPDATE transactions SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL;
      UPDATE recurring_occurrences
      SET sync_id = (
        SELECT recurring_rules.sync_id || ':' || recurring_occurrences.scheduled_date
        FROM recurring_rules
        WHERE recurring_rules.id = recurring_occurrences.recurring_rule_id
      )
      WHERE sync_id IS NULL;

      CREATE UNIQUE INDEX accounts_by_sync_id ON accounts(sync_id);
      CREATE UNIQUE INDEX categories_by_sync_id ON categories(sync_id);
      CREATE UNIQUE INDEX recurring_rules_by_sync_id ON recurring_rules(sync_id);
      CREATE UNIQUE INDEX transactions_by_sync_id ON transactions(sync_id);
      CREATE UNIQUE INDEX recurring_occurrences_by_sync_id ON recurring_occurrences(sync_id);

      CREATE TRIGGER accounts_assign_sync_id
      AFTER INSERT ON accounts WHEN NEW.sync_id IS NULL
      BEGIN
        UPDATE accounts SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
      END;
      CREATE TRIGGER categories_assign_sync_id
      AFTER INSERT ON categories WHEN NEW.sync_id IS NULL
      BEGIN
        UPDATE categories SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
      END;
      CREATE TRIGGER recurring_rules_assign_sync_id
      AFTER INSERT ON recurring_rules WHEN NEW.sync_id IS NULL
      BEGIN
        UPDATE recurring_rules SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
      END;
      CREATE TRIGGER transactions_assign_sync_id
      AFTER INSERT ON transactions WHEN NEW.sync_id IS NULL
      BEGIN
        UPDATE transactions SET sync_id = lower(hex(randomblob(16))) WHERE id = NEW.id;
      END;
      CREATE TRIGGER recurring_occurrences_assign_sync_id
      AFTER INSERT ON recurring_occurrences WHEN NEW.sync_id IS NULL
      BEGIN
        UPDATE recurring_occurrences
        SET sync_id = (
          SELECT recurring_rules.sync_id || ':' || NEW.scheduled_date
          FROM recurring_rules
          WHERE recurring_rules.id = NEW.recurring_rule_id
        )
        WHERE id = NEW.id;
      END;

      CREATE TRIGGER accounts_keep_sync_id
      BEFORE UPDATE OF sync_id ON accounts
      WHEN OLD.sync_id IS NOT NULL AND (NEW.sync_id IS NULL OR OLD.sync_id <> NEW.sync_id)
      BEGIN SELECT RAISE(ABORT, 'accounts.sync_id is immutable'); END;
      CREATE TRIGGER categories_keep_sync_id
      BEFORE UPDATE OF sync_id ON categories
      WHEN OLD.sync_id IS NOT NULL AND (NEW.sync_id IS NULL OR OLD.sync_id <> NEW.sync_id)
      BEGIN SELECT RAISE(ABORT, 'categories.sync_id is immutable'); END;
      CREATE TRIGGER recurring_rules_keep_sync_id
      BEFORE UPDATE OF sync_id ON recurring_rules
      WHEN OLD.sync_id IS NOT NULL AND (NEW.sync_id IS NULL OR OLD.sync_id <> NEW.sync_id)
      BEGIN SELECT RAISE(ABORT, 'recurring_rules.sync_id is immutable'); END;
      CREATE TRIGGER transactions_keep_sync_id
      BEFORE UPDATE OF sync_id ON transactions
      WHEN OLD.sync_id IS NOT NULL AND (NEW.sync_id IS NULL OR OLD.sync_id <> NEW.sync_id)
      BEGIN SELECT RAISE(ABORT, 'transactions.sync_id is immutable'); END;
      CREATE TRIGGER recurring_occurrences_keep_sync_id
      BEFORE UPDATE OF sync_id ON recurring_occurrences
      WHEN OLD.sync_id IS NOT NULL AND (NEW.sync_id IS NULL OR OLD.sync_id <> NEW.sync_id)
      BEGIN SELECT RAISE(ABORT, 'recurring_occurrences.sync_id is immutable'); END;
    `);
  },
};
