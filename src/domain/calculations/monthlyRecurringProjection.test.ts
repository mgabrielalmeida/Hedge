import type { RecurringOccurrence, RecurringRule, Transaction } from '@/domain';

import { projectMonthEndBalance } from './monthlyRecurringProjection';

const timestamp = '2026-09-01T12:00:00.000Z';

function transaction(id: number, amountCents: number, date: string): Transaction {
  return {
    accountId: 1,
    amountCents,
    categoryId: amountCents < 0 ? 2 : null,
    createdAt: timestamp,
    description: null,
    destinationAccountId: null,
    id,
    kind: amountCents < 0 ? 'expense' : 'income',
    name: 'Transaction',
    transactionDate: date,
    updatedAt: timestamp,
  } as Transaction;
}

function rule(id: number, amountCents: number, chargeDay: number): RecurringRule {
  return {
    accountId: 1,
    amountCents,
    categoryId: amountCents < 0 ? 2 : null,
    createdAt: timestamp,
    deletedAt: null,
    description: null,
    endDate: null,
    id,
    isActive: true,
    kind: amountCents < 0 ? 'expense' : 'income',
    name: amountCents < 0 ? 'Internet' : 'Salary',
    schedule: { chargeDay, chargeMonth: null, frequency: 'monthly' },
    startDate: '2026-01-01',
    updatedAt: timestamp,
  } as RecurringRule;
}

describe('projectMonthEndBalance', () => {
  it('adds only recurring occurrences that have not already been processed', () => {
    const occurrence: RecurringOccurrence = {
      createdAt: timestamp,
      id: 1,
      recurringRuleId: 1,
      scheduledDate: '2026-09-05',
      transactionId: 2,
    };
    const result = projectMonthEndBalance(
      '2026-09',
      [transaction(1, 10_000, '2026-09-01'), transaction(2, -1_500, '2026-09-05'), transaction(3, 8_000, '2026-10-01')],
      [rule(1, -1_500, 5), rule(2, 3_000, 20)],
      [occurrence],
    );

    expect(result.availableBalanceCents).toBe(11_500);
    expect(result.monthEndDate).toBe('2026-09-30');
    expect(result.items).toEqual([
      expect.objectContaining({ name: 'Transaction', scheduledDate: '2026-09-05', status: 'processed' }),
      expect.objectContaining({ name: 'Salary', scheduledDate: '2026-09-20', status: 'pending' }),
    ]);
  });

  it('does not forecast paused rules', () => {
    const result = projectMonthEndBalance(
      '2026-09',
      [transaction(1, 2_000, '2026-09-01')],
      [{ ...rule(1, -1_000, 10), isActive: false, deletedAt: null }],
      [],
    );

    expect(result.availableBalanceCents).toBe(2_000);
    expect(result.items).toEqual([]);
  });
});
