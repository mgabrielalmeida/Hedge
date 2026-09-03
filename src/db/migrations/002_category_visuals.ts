import type { Migration } from './migration';

export const categoryVisualsMigration: Migration = {
  version: 2,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE categories ADD COLUMN visual_type TEXT NOT NULL DEFAULT 'icon'
        CHECK (visual_type IN ('icon', 'color'));
      ALTER TABLE categories ADD COLUMN visual_value TEXT NOT NULL DEFAULT 'tag'
        CHECK (length(trim(visual_value)) > 0);
    `);
  },
};
