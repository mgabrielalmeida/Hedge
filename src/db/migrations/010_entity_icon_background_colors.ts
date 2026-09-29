import type { Migration } from './migration';

export const entityIconBackgroundColorsMigration: Migration = {
  version: 10,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN background_color_value TEXT NOT NULL DEFAULT '#D4EFDD';
      ALTER TABLE accounts ADD COLUMN background_theme_color_index INTEGER NOT NULL DEFAULT 2
        CHECK (background_theme_color_index BETWEEN 0 AND 4 OR background_theme_color_index IS NULL);
      ALTER TABLE categories ADD COLUMN background_color_value TEXT NOT NULL DEFAULT '#D4EFDD';
      ALTER TABLE categories ADD COLUMN background_theme_color_index INTEGER NOT NULL DEFAULT 2
        CHECK (background_theme_color_index BETWEEN 0 AND 4 OR background_theme_color_index IS NULL);
    `);
  },
};
