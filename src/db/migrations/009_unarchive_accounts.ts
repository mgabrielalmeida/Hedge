import type { Migration } from './migration';

export const unarchiveAccountsMigration: Migration = {
  version: 9,
  up: async (db) => {
    await db.execAsync(`
      UPDATE recurring_rules
      SET deleted_at = NULL
      WHERE is_active = 0
        AND deleted_at IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM accounts
          WHERE accounts.id = recurring_rules.account_id
            AND accounts.is_archived = 1
            AND accounts.archived_at = recurring_rules.deleted_at
        );
    `);
  },
};
