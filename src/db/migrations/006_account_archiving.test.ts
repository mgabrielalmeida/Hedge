import { initializeDatabase } from '@/db/database';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';

describe('account archiving migration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => database.close());

  it('adds a consistent archive state to accounts', async () => {
    await database.runAsync(
      'INSERT INTO accounts (name, institution_name, visual_type, visual_value, icon_value, color_value) VALUES (?, ?, ?, ?, ?, ?);',
      'Principal', 'Banco', 'icon', 'bank', 'bank', '#123456',
    );

    await expect(database.getFirstAsync('SELECT is_archived, archived_at FROM accounts WHERE name = ?;', 'Principal')).resolves.toEqual({ is_archived: 0, archived_at: null });
    await expect(database.runAsync('UPDATE accounts SET is_archived = 1, archived_at = ? WHERE name = ?;', '2026-09-07T10:00:00.000Z', 'Principal')).resolves.toBeUndefined();
    await expect(database.runAsync('UPDATE accounts SET is_archived = 0 WHERE name = ?;', 'Principal')).rejects.toThrow();
  });
});
