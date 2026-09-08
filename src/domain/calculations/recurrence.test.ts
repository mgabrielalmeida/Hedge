import type { RecurringRule } from '@/domain';

import { getNextRecurringChargeDate } from './recurrence';

const timestamp = '2026-09-01T12:00:00.000Z';

function rule(schedule: RecurringRule['schedule']): RecurringRule {
  return {
    accountId: 1,
    amountCents: -1_000,
    categoryId: 2,
    createdAt: timestamp,
    deletedAt: null,
    description: null,
    endDate: null,
    id: 3,
    isActive: true,
    kind: 'expense',
    name: 'Rule',
    schedule,
    startDate: '2026-01-01',
    updatedAt: timestamp,
  };
}

describe('getNextRecurringChargeDate', () => {
  it('finds the next weekly, monthly and yearly charges', () => {
    expect(getNextRecurringChargeDate(rule({ frequency: 'weekly', chargeDay: 1, chargeMonth: null }), '2026-09-08')).toBe('2026-09-14');
    expect(getNextRecurringChargeDate(rule({ frequency: 'monthly', chargeDay: 31, chargeMonth: null }), '2026-02-12')).toBe('2026-02-28');
    expect(getNextRecurringChargeDate(rule({ frequency: 'yearly', chargeDay: 29, chargeMonth: 2 }), '2026-03-01')).toBe('2027-02-28');
  });

  it('returns null when the rule is paused or has already ended', () => {
    expect(getNextRecurringChargeDate({ ...rule({ frequency: 'monthly', chargeDay: 10, chargeMonth: null }), isActive: false, deletedAt: null }, '2026-09-01')).toBeNull();
    expect(getNextRecurringChargeDate({ ...rule({ frequency: 'monthly', chargeDay: 10, chargeMonth: null }), endDate: '2026-08-10' }, '2026-09-01')).toBeNull();
  });
});
