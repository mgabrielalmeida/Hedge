import { runMigrations } from '@/db/migrate';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';
import { migrations } from '.';

describe('history paging and recurring resume migration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await runMigrations(database, migrations.slice(0, 7));
  });

  afterEach(() => database.close());

  it('initializes the recurring processing date from the original start date', async () => {
    await database.execAsync(`
      INSERT INTO accounts (name, institution_name, visual_type, visual_value, icon_value, color_value, created_at, updated_at)
      VALUES ('Main', 'Bank', 'icon', 'bank', 'bank', '#276749', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
      INSERT INTO recurring_rules (kind, account_id, category_id, name, description, amount_cents, frequency, charge_day, charge_month, start_date, end_date, is_active, deleted_at, created_at, updated_at)
      VALUES ('expense', 1, 1, 'Rent', NULL, -100, 'monthly', 1, NULL, '2026-01-01', NULL, 1, NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    `);
    await runMigrations(database, migrations.slice(0, 8));
    await expect(database.getAllAsync<{ name: string; processing_start_date: string }>(
      'SELECT name, processing_start_date FROM recurring_rules;',
    )).resolves.toEqual([{ name: 'Rent', processing_start_date: '2026-01-01' }]);
    await expect(database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;')).resolves.toEqual({ user_version: 8 });
  });
});
