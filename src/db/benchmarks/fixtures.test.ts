import { benchmarkTransactionCounts, createBenchmarkFixture } from './fixtures';

describe('benchmark fixtures', () => {
  it('provides the three required deterministic dataset sizes', () => {
    expect(benchmarkTransactionCounts).toEqual([1_000, 10_000, 50_000]);
    const fixture = createBenchmarkFixture(1_000);
    expect(fixture.transactions).toHaveLength(1_000);
    expect(fixture.transactions[0]).toEqual({ name: 'Benchmark expense 1', amountCents: -100, categoryId: 1, transactionDate: '2024-01-01' });
    expect(fixture.transactions[999]).toEqual({ name: 'Benchmark expense 1000', amountCents: -1099, categoryId: 5, transactionDate: '2024-09-25' });
    expect(createBenchmarkFixture(10_000).transactions).toHaveLength(10_000);
    expect(createBenchmarkFixture(50_000).transactions).toHaveLength(50_000);
  });

  it('rejects an invalid dataset size', () => {
    expect(() => createBenchmarkFixture(0)).toThrow('positive safe integer');
  });
});
