import type { Migration } from './migration';

export const defaultCategoryColorsMigration: Migration = {
  version: 7,
  up: async (db) => {
    await db.execAsync(`
      UPDATE categories
      SET theme_color_index = CASE name
        WHEN 'Compras' THEN 0
        WHEN 'Assinatura' THEN 1
        WHEN 'Entretenimento' THEN 2
        WHEN 'Alimentação' THEN 3
        WHEN 'Outros' THEN 4
      END
      WHERE theme_color_index IS NULL
        AND name IN ('Compras', 'Assinatura', 'Entretenimento', 'Alimentação', 'Outros');
    `);
  },
};
