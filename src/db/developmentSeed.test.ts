import { seedDevelopmentData } from './developmentSeed';
import { runMigrations } from './migrate';
import { migrations } from './migrations';
import { createTestDatabase } from './testDatabase';

describe('development seed', () => {
  it('populates a fresh database and is safe to run again', async () => {
    const database = createTestDatabase();

    try {
      await runMigrations(database, migrations);

      expect(await seedDevelopmentData(database)).toBe(true);
      expect(await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM accounts;')).toEqual({ count: 3 });
      expect(await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM transactions;')).toEqual({ count: 19 });
      expect(await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM recurring_rules;')).toEqual({ count: 3 });
      expect(await seedDevelopmentData(database)).toBe(false);
      expect(await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM transactions;')).toEqual({ count: 19 });
    } finally {
      database.close();
    }
  });

  it('does not touch an existing database', async () => {
    const database = createTestDatabase();

    try {
      await runMigrations(database, migrations);
      await database.runAsync(
        `INSERT INTO accounts
          (name, institution_name, visual_type, visual_value, icon_value,
           color_value, is_archived, created_at, updated_at)
         VALUES ('Minha conta', 'Meu banco', 'icon', 'wallet', 'wallet', '#276749', 0, '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z');`,
      );

      expect(await seedDevelopmentData(database)).toBe(false);
      expect(await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM accounts;')).toEqual({ count: 1 });
    } finally {
      database.close();
    }
  });
});
