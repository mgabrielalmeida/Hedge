import type { Migration } from './migration';

export const defaultCategoryIconsMigration: Migration = {
  version: 3,
  up: async (db) => {
    await db.execAsync(`
      UPDATE categories SET visual_type = 'icon', visual_value = '🛒' WHERE name = 'Compras';
      UPDATE categories SET visual_type = 'icon', visual_value = '🔁' WHERE name = 'Assinatura';
      UPDATE categories SET visual_type = 'icon', visual_value = '🎬' WHERE name = 'Entretenimento';
      UPDATE categories SET visual_type = 'icon', visual_value = '🍽️' WHERE name = 'Alimentação';
      UPDATE categories SET visual_type = 'icon', visual_value = '🏷️' WHERE name = 'Outros';
    `);
  },
};
