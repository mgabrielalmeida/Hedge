import { createTestDatabase, type TestDatabase } from '../testDatabase';
import { initialSchemaMigration } from './001_initial_schema';
import { categoryVisualsMigration } from './002_category_visuals';
import { defaultCategoryIconsMigration } from './003_default_category_icons';
import { composedVisualIndicatorsMigration } from './004_composed_visual_indicators';
import { themeColorIndicesMigration } from './005_theme_color_indices';

describe('themeColorIndicesMigration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initialSchemaMigration.up(database);
    await categoryVisualsMigration.up(database);
    await defaultCategoryIconsMigration.up(database);
    await composedVisualIndicatorsMigration.up(database);
  });

  afterEach(() => database.close());

  it('keeps existing colors custom and accepts only the five preset indices', async () => {
    await database.runAsync(
      'INSERT INTO accounts (name, institution_name, visual_type, visual_value, icon_value, color_value) VALUES (?, ?, ?, ?, ?, ?);',
      'Principal', 'Banco', 'icon', 'bank', 'bank', '#123456',
    );

    await themeColorIndicesMigration.up(database);

    await expect(database.getFirstAsync('SELECT theme_color_index FROM accounts WHERE name = \'Principal\';')).resolves.toEqual({ theme_color_index: null });
    await expect(database.runAsync('UPDATE accounts SET theme_color_index = 4 WHERE name = ?;', 'Principal')).resolves.toBeUndefined();
    await expect(database.runAsync('UPDATE accounts SET theme_color_index = 5 WHERE name = ?;', 'Principal')).rejects.toThrow();
  });
});
