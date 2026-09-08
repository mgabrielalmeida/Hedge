import { initializeDatabase } from '@/db/database';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';
import { defaultCategoryColorsMigration } from './007_default_category_colors';

describe('default category colors migration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => database.close());

  it('assigns the five predefined colors in seed order', async () => {
    await expect(database.getAllAsync<{ name: string; theme_color_index: number | null }>(
      'SELECT name, theme_color_index FROM categories ORDER BY id;',
    )).resolves.toEqual([
      { name: 'Compras', theme_color_index: 0 },
      { name: 'Assinatura', theme_color_index: 1 },
      { name: 'Entretenimento', theme_color_index: 2 },
      { name: 'Alimentação', theme_color_index: 3 },
      { name: 'Outros', theme_color_index: 4 },
    ]);
  });

  it('does not overwrite a color customized by the user', async () => {
    await database.runAsync('UPDATE categories SET theme_color_index = ? WHERE name = ?;', 4, 'Compras');
    await database.execAsync('PRAGMA user_version = 6;');
    await defaultCategoryColorsMigration.up(database);
    await expect(database.getFirstAsync('SELECT theme_color_index FROM categories WHERE name = ?;', 'Compras')).resolves.toEqual({ theme_color_index: 4 });
  });
});
