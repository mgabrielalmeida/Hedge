import type { RepositorySession } from '../repositories/database';
import type { BenchmarkFixture } from './fixtures';

export type BenchmarkSeedDatabase = Pick<RepositorySession, 'getFirstAsync' | 'runAsync'> & {
  withExclusiveTransactionAsync: (task: (transaction: RepositorySession) => Promise<void>) => Promise<void>;
};

export async function seedBenchmarkFixture(
  database: BenchmarkSeedDatabase,
  fixture: BenchmarkFixture,
  timestamp: string,
): Promise<number> {
  let accountId: number | null = null;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'INSERT INTO accounts (name, institution_name, visual_type, visual_value, icon_value, color_value, theme_color_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
      'Benchmark account', 'Benchmark bank', 'icon', 'wallet', 'wallet', '#276749', 0, timestamp, timestamp,
    );
    const account = await transaction.getFirstAsync<{ id: number }>('SELECT last_insert_rowid() AS id;');
    if (!account) throw new Error('Benchmark account was not created.');
    accountId = account.id;

    for (const item of fixture.transactions) {
      await transaction.runAsync(
        "INSERT INTO transactions (kind, account_id, category_id, name, amount_cents, transaction_date, created_at, updated_at) VALUES ('expense', ?, ?, ?, ?, ?, ?, ?);",
        account.id, item.categoryId, item.name, item.amountCents, item.transactionDate, timestamp, timestamp,
      );
    }
  });
  if (accountId === null) throw new Error('Benchmark account was not created.');
  return accountId;
}

export type LocalCommitMeasurement = {
  readonly samplesMs: readonly number[];
  readonly p95Ms: number;
};

export async function measureLocalCommit(
  commit: () => Promise<void>,
  samples = 30,
  now: () => number = () => performance.now(),
): Promise<LocalCommitMeasurement> {
  if (!Number.isInteger(samples) || samples < 1) throw new Error('Benchmark samples must be a positive integer.');
  const durations: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const startedAt = now();
    await commit();
    durations.push(now() - startedAt);
  }
  return { samplesMs: durations, p95Ms: percentile95(durations) };
}

export function percentile95(samples: readonly number[]): number {
  if (samples.length === 0) throw new Error('Cannot calculate a percentile without samples.');
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}
