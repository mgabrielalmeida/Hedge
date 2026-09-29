import type { Migration } from './migration';

export const historyPagingAndRecurringResumeMigration: Migration = {
  version: 8,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE recurring_rules ADD COLUMN processing_start_date TEXT;

      UPDATE recurring_rules
      SET processing_start_date = start_date
      WHERE processing_start_date IS NULL;

      CREATE INDEX transactions_by_date_id
        ON transactions(transaction_date DESC, id DESC);

      CREATE INDEX transactions_by_kind_date_id
        ON transactions(kind, transaction_date DESC, id DESC);
    `);
  },
};
