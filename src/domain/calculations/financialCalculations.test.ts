import {
  calculateAccountBalance,
  calculateCategoryMonthlySpending,
  calculateConsolidatedBalance,
  isRecurringRuleDueOn,
} from './index';
import type { RecurringRule, Transaction } from '../models/financial';

const timestamp = '2026-09-01T12:34:56.789Z';

const transactions: readonly Transaction[] = [
  {
    id: 1,
    kind: 'opening_balance',
    accountId: 1,
    destinationAccountId: null,
    categoryId: null,
    name: 'Opening balance',
    description: null,
    amountCents: 10000,
    transactionDate: '2026-08-01',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 2,
    kind: 'expense',
    accountId: 1,
    destinationAccountId: null,
    categoryId: 5,
    name: 'Groceries',
    description: null,
    amountCents: -2500,
    transactionDate: '2026-09-01',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 3,
    kind: 'transfer',
    accountId: 1,
    destinationAccountId: 2,
    categoryId: null,
    name: 'Transfer',
    description: null,
    amountCents: -3000,
    transactionDate: '2026-09-01',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: 4,
    kind: 'income',
    accountId: 2,
    destinationAccountId: null,
    categoryId: null,
    name: 'Income',
    description: null,
    amountCents: 500,
    transactionDate: '2026-09-02',
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

const monthlyRule: RecurringRule = {
  id: 1,
  kind: 'expense',
  accountId: 1,
  categoryId: 5,
  name: 'Monthly last day',
  description: null,
  amountCents: -1000,
  startDate: '2026-01-01',
  endDate: null,
  isActive: true,
  deletedAt: null,
  schedule: { frequency: 'monthly', chargeDay: 31, chargeMonth: null },
  createdAt: timestamp,
  updatedAt: timestamp,
};

describe('financial calculations', () => {
  it('calculates individual and consolidated balances with transfers', () => {
    expect(calculateAccountBalance(transactions, 1)).toBe(4500);
    expect(calculateAccountBalance(transactions, 2)).toBe(3500);
    expect(calculateConsolidatedBalance(transactions)).toBe(8000);
  });

  it('counts only categorized expenses in the requested month', () => {
    expect(calculateCategoryMonthlySpending(transactions, 5, '2026-09')).toBe(2500);
    expect(calculateCategoryMonthlySpending(transactions, 5, '2026-08')).toBe(0);
  });

  it('matches adjusted monthly recurrence dates without filling missed dates', () => {
    expect(isRecurringRuleDueOn(monthlyRule, '2026-02-28')).toBe(true);
    expect(isRecurringRuleDueOn(monthlyRule, '2026-02-27')).toBe(false);
    expect(isRecurringRuleDueOn({ ...monthlyRule, isActive: false, categoryId: null }, '2026-02-28')).toBe(false);
  });

  it('matches weekly and adjusted yearly schedules inside their inclusive date range', () => {
    expect(isRecurringRuleDueOn({ ...monthlyRule, schedule: { frequency: 'weekly', chargeDay: 3, chargeMonth: null } }, '2026-09-02')).toBe(true);
    expect(isRecurringRuleDueOn({ ...monthlyRule, schedule: { frequency: 'weekly', chargeDay: 4, chargeMonth: null } }, '2026-09-02')).toBe(false);
    expect(isRecurringRuleDueOn({ ...monthlyRule, startDate: '2026-09-03', schedule: { frequency: 'weekly', chargeDay: 3, chargeMonth: null } }, '2026-09-02')).toBe(false);
    expect(isRecurringRuleDueOn({ ...monthlyRule, endDate: '2026-09-01', schedule: { frequency: 'weekly', chargeDay: 3, chargeMonth: null } }, '2026-09-02')).toBe(false);
    expect(isRecurringRuleDueOn({ ...monthlyRule, schedule: { frequency: 'yearly', chargeDay: 29, chargeMonth: 2 } }, '2027-02-28')).toBe(true);
  });
});
