import type { RepositoryDatabase } from '../repositories/database';
import {
  acquireOutboxLease,
  applySyncEvent,
  applySyncReceipt,
  recordSyncConflict,
  releaseOutboxLease,
  updateSyncCursor,
} from './outbox';
import type { SyncTransport } from './simulatedTransport';

export type ReconciliationResult = {
  readonly pushed: number;
  readonly received: number;
  readonly conflicts: number;
};

export async function reconcileOnce(
  db: RepositoryDatabase,
  transport: SyncTransport,
  clock: () => string,
  leaseDurationMs = 60_000,
): Promise<ReconciliationResult> {
  const startedAt = clock();
  const expiresAt = new Date(new Date(startedAt).getTime() + leaseDurationMs).toISOString();
  const lease = await acquireOutboxLease(db, startedAt, expiresAt);
  let conflictCount = 0;
  try {
    if (lease.commands.length > 0) {
      const push = await transport.push(lease.commands);
      for (const conflict of push.conflicts) {
        await recordSyncConflict(db, conflict.command, conflict.current, conflict.reason, clock());
        conflictCount += 1;
      }
      for (const receipt of push.receipts) await applySyncReceipt(db, receipt, clock());
    }
  } catch (error) {
    await releaseOutboxLease(db, lease.token, clock());
    throw error;
  }

  const state = await db.getFirstAsync<{ cursor_value: string | null }>(
    'SELECT cursor_value FROM sync_state WHERE id = 1;',
  );
  const pull = await transport.pull(state?.cursor_value ?? null);
  let received = 0;
  for (const event of pull.events) {
    if (await applySyncEvent(db, event, clock())) received += 1;
  }
  await updateSyncCursor(db, pull.cursor, clock());
  return { pushed: lease.commands.length, received, conflicts: conflictCount };
}
