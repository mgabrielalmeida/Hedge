import { initializeDatabase } from '@/db/database';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';

describe('local profile migration', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => database.close());

  it('creates one immutable profile, ledger and positive generation', async () => {
    const profile = await database.getFirstAsync<{
      profile_id: string;
      ledger_id: string;
      generation: number;
    }>('SELECT profile_id, ledger_id, generation FROM local_profile WHERE id = 1;');

    expect(profile).toEqual({
      profile_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      ledger_id: expect.stringMatching(/^[0-9a-f]{32}$/),
      generation: 1,
    });
    await expect(database.runAsync(
      "UPDATE local_profile SET profile_id = 'other' WHERE id = 1;",
    )).rejects.toThrow();
    await expect(database.runAsync('DELETE FROM local_profile WHERE id = 1;')).rejects.toThrow();
  });
});
