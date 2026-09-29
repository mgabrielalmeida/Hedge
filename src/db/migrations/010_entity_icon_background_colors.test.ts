import { runMigrations } from '@/db/migrate';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';
import { migrations } from '.';

describe('entity icon background colors migration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await runMigrations(database, migrations.slice(0, 9));
  });

  afterEach(() => database.close());

  it('adds dynamic default background colors without changing persisted icon colors', async () => {
    await database.execAsync(
      "INSERT INTO accounts (name, institution_name, visual_type, visual_value, icon_value, color_value, theme_color_index, created_at, updated_at) VALUES ('Conta', 'Banco', 'icon', 'lucide:landmark', 'lucide:landmark', '#176B9C', 2, '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z');",
    );

    await runMigrations(database, migrations);

    await expect(database.getFirstAsync<{ color_value: string; background_color_value: string; background_theme_color_index: number }>(
      'SELECT color_value, background_color_value, background_theme_color_index FROM accounts WHERE id = 1;',
    )).resolves.toEqual({ color_value: '#176B9C', background_color_value: '#D4EFDD', background_theme_color_index: 2 });
  });
});
