import { createTestDatabase, type TestDatabase } from '../testDatabase';
import { initialSchemaMigration } from './001_initial_schema';
import { categoryVisualsMigration } from './002_category_visuals';
import { defaultCategoryIconsMigration } from './003_default_category_icons';
import { composedVisualIndicatorsMigration } from './004_composed_visual_indicators';

describe('composedVisualIndicatorsMigration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initialSchemaMigration.up(database);
    await categoryVisualsMigration.up(database);
  });

  afterEach(() => database.close());

  it('preserves the previous choice and supplies the missing visual attribute', async () => {
    await database.runAsync(
      'INSERT INTO accounts (name, institution_name, visual_type, visual_value) VALUES (?, ?, ?, ?);',
      'Principal', 'Banco', 'color', '#123456',
    );
    await database.runAsync(
      'INSERT INTO categories (name, monthly_budget_cents, visual_type, visual_value) VALUES (?, ?, ?, ?);',
      'Legada', 0, 'icon', 'tag',
    );
    await defaultCategoryIconsMigration.up(database);

    await composedVisualIndicatorsMigration.up(database);

    await expect(database.getFirstAsync(
      'SELECT icon_value, color_value FROM accounts WHERE name = \'Principal\';',
    )).resolves.toEqual({ icon_value: 'bank', color_value: '#123456' });
    await expect(database.getFirstAsync(
      'SELECT icon_value, color_value FROM categories WHERE name = \'Legada\';',
    )).resolves.toEqual({ icon_value: '🏷️', color_value: '#276749' });
  });
});
