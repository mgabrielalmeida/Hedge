import type { CivilDate } from '../models/financial';

export function recurringOccurrenceSyncId(ruleSyncId: string, scheduledDate: CivilDate): string {
  return `${ruleSyncId}:${scheduledDate}`;
}

export function recurringTransactionSyncId(ruleSyncId: string, scheduledDate: CivilDate): string {
  return `${recurringOccurrenceSyncId(ruleSyncId, scheduledDate)}:transaction`;
}
