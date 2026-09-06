import type { Migration } from './migration';

export const themeColorIndicesMigration: Migration = {
  version: 5,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN theme_color_index INTEGER
        CHECK (theme_color_index BETWEEN 0 AND 4 OR theme_color_index IS NULL);
      ALTER TABLE categories ADD COLUMN theme_color_index INTEGER
        CHECK (theme_color_index BETWEEN 0 AND 4 OR theme_color_index IS NULL);
    `);
  },
};
