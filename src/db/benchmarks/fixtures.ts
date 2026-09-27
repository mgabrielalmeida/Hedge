export const benchmarkTransactionCounts = [1_000, 10_000, 50_000] as const;

export type BenchmarkTransactionFixture = {
  readonly name: string;
  readonly amountCents: number;
  readonly categoryId: number;
  readonly transactionDate: string;
};

export type BenchmarkFixture = {
  readonly transactionCount: number;
  readonly transactions: readonly BenchmarkTransactionFixture[];
};

export function createBenchmarkFixture(transactionCount: number): BenchmarkFixture {
  if (!Number.isSafeInteger(transactionCount) || transactionCount < 1) {
    throw new Error('Benchmark transaction count must be a positive safe integer.');
  }

  const transactions: BenchmarkTransactionFixture[] = [];
  for (let index = 0; index < transactionCount; index += 1) {
    transactions.push({
      name: `Benchmark expense ${index + 1}`,
      amountCents: -((index % 90_000) + 100),
      categoryId: (index % 5) + 1,
      transactionDate: civilDateForIndex(index),
    });
  }

  return { transactionCount, transactions };
}

function civilDateForIndex(index: number): string {
  const date = new Date(Date.UTC(2024, 0, 1 + (index % 731)));
  return date.toISOString().slice(0, 10);
}
