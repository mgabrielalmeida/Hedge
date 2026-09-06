import type { Migration } from './migration';

export const composedVisualIndicatorsMigration: Migration = {
  version: 4,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN icon_value TEXT NOT NULL DEFAULT 'bank'
        CHECK (length(trim(icon_value)) > 0);
      ALTER TABLE accounts ADD COLUMN color_value TEXT NOT NULL DEFAULT '#276749'
        CHECK (length(trim(color_value)) > 0);
      UPDATE accounts SET icon_value = visual_value WHERE visual_type = 'icon';
      UPDATE accounts SET color_value = visual_value WHERE visual_type = 'color';

      ALTER TABLE categories ADD COLUMN icon_value TEXT NOT NULL DEFAULT '🏷️'
        CHECK (length(trim(icon_value)) > 0);
      ALTER TABLE categories ADD COLUMN color_value TEXT NOT NULL DEFAULT '#276749'
        CHECK (length(trim(color_value)) > 0);
      UPDATE categories
      SET icon_value = CASE visual_value WHEN 'tag' THEN '🏷️' ELSE visual_value END
      WHERE visual_type = 'icon';
      UPDATE categories SET color_value = visual_value WHERE visual_type = 'color';
    `);
  },
};
