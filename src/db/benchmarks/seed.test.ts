import { initializeDatabase } from '../database';
import { createTestDatabase, type TestDatabase } from '../testDatabase';
import { createBenchmarkFixture } from './fixtures';
import { measureLocalCommit, percentile95, seedBenchmarkFixture } from './seed';

describe('benchmark seed and measurement helpers', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => database.close());

  it('seeds a deterministic fixture in one local transaction', async () => {
    await seedBenchmarkFixture(database, createBenchmarkFixture(10), '2026-09-27T00:00:00.000Z');
    await expect(database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM transactions;')).resolves.toEqual({ count: 10 });
  });

  it('measures repeated commits and calculates p95 without a UI dependency', async () => {
    const times = [0, 12, 20, 44, 70, 101];
    const measurement = await measureLocalCommit(async () => undefined, 3, () => times.shift()!);
    expect(measurement).toEqual({ samplesMs: [12, 24, 31], p95Ms: 31 });
    expect(percentile95([1, 2, 3, 4, 5])).toBe(5);
  });
});
