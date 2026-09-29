import { recurringOccurrenceSyncId, recurringTransactionSyncId } from './recurrenceIdentity';

describe('recurrence sync identity', () => {
  it('derives both identities from the rule and civil date', () => {
    expect(recurringOccurrenceSyncId('rule-1', '2028-02-29')).toBe('rule-1:2028-02-29');
    expect(recurringTransactionSyncId('rule-1', '2028-02-29')).toBe('rule-1:2028-02-29:transaction');
  });
});
