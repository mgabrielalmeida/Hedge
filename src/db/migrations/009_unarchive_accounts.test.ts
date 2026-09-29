import { runMigrations } from '@/db/migrate';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';

import { migrations } from '.';

describe('unarchive accounts migration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await runMigrations(database, migrations.slice(0, 8));
  });

  afterEach(() => database.close());

  it('converts only rules paused by the legacy account archive operation', async () => {
    await database.execAsync(`
      INSERT INTO accounts (name, institution_name, visual_type, visual_value, icon_value, color_value, is_archived, archived_at, created_at, updated_at)
      VALUES ('Archived', 'Bank', 'icon', 'bank', 'bank', '#276749', 1, '2026-09-10T10:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-09-10T10:00:00.000Z');
      INSERT INTO recurring_rules (kind, account_id, category_id, name, description, amount_cents, frequency, charge_day, charge_month, start_date, processing_start_date, end_date, is_active, deleted_at, created_at, updated_at)
      VALUES
        ('income', 1, NULL, 'Paused with account', NULL, 100, 'monthly', 1, NULL, '2026-01-01', '2026-01-01', NULL, 0, '2026-09-10T10:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-09-10T10:00:00.000Z'),
        ('income', 1, NULL, 'Deleted separately', NULL, 100, 'monthly', 2, NULL, '2026-01-01', '2026-01-01', NULL, 0, '2026-09-11T10:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-09-11T10:00:00.000Z');
    `);

    await runMigrations(database);

    await expect(database.getAllAsync<{ deleted_at: string | null; name: string }>(
      'SELECT name, deleted_at FROM recurring_rules ORDER BY id;',
    )).resolves.toEqual([
      { name: 'Paused with account', deleted_at: null },
      { name: 'Deleted separately', deleted_at: '2026-09-11T10:00:00.000Z' },
    ]);
    await expect(database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;')).resolves.toEqual({ user_version: 9 });
  });
});
