import { initializeDatabase } from '@/db/database';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';

describe('query performance indexes migration', () => {
  let database: TestDatabase;
  beforeEach(async () => { database = createTestDatabase(); await initializeDatabase(database); });
  afterEach(() => database.close());

  it('adds indexes for paginated and aggregate reads', async () => {
    const rows = await database.getAllAsync<{ name: string }>("SELECT name FROM sqlite_schema WHERE type = 'index' AND name IN ('transactions_by_date_and_id', 'transactions_by_category_date_and_id', 'transactions_by_destination_date_and_id', 'recurring_occurrences_by_date') ORDER BY name;");
    expect(rows.map((row) => row.name)).toEqual(['recurring_occurrences_by_date', 'transactions_by_category_date_and_id', 'transactions_by_date_and_id', 'transactions_by_destination_date_and_id']);
  });
});
