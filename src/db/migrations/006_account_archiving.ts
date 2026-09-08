import type { Migration } from './migration';

export const accountArchivingMigration: Migration = {
  version: 6,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0
        CHECK (is_archived IN (0, 1));
      ALTER TABLE accounts ADD COLUMN archived_at TEXT
        CHECK (
          (is_archived = 0 AND archived_at IS NULL) OR
          (is_archived = 1 AND archived_at IS NOT NULL)
        );
      CREATE INDEX accounts_active ON accounts(is_archived) WHERE is_archived = 0;
    `);
  },
};
