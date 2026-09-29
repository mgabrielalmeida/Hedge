import { enqueueEntityMutation } from '../sync/outbox';
import type { RepositorySession } from './database';

export async function enqueueFinancialAccountMutations(
  db: RepositorySession,
  accountIds: readonly (number | null)[],
  timestamp: string,
): Promise<void> {
  const uniqueAccountIds = [...new Set(accountIds.filter((id): id is number => id !== null))];
  for (const accountId of uniqueAccountIds) {
    await enqueueEntityMutation(db, 'account', accountId, timestamp);
  }
}
