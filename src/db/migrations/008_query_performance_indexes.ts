import type { Migration } from './migration';

export const queryPerformanceIndexesMigration: Migration = {
  version: 8,
  up: async (db) => {
    await db.execAsync(`
      CREATE INDEX transactions_by_date_and_id ON transactions(transaction_date DESC, id DESC);
      CREATE INDEX transactions_by_category_date_and_id ON transactions(category_id, transaction_date DESC, id DESC) WHERE kind = 'expense';
      CREATE INDEX transactions_by_destination_date_and_id ON transactions(destination_account_id, transaction_date DESC, id DESC) WHERE destination_account_id IS NOT NULL;
      CREATE INDEX recurring_occurrences_by_date ON recurring_occurrences(scheduled_date, id);
    `);
  },
};
