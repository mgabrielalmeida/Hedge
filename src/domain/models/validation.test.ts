import type { RecurringRule, Transaction } from './financial';
import {
  normalizeOptionalText,
  validateNewTransaction,
  validateRecurringOccurrence,
  validateRecurringRule,
  validateRequiredText,
} from './validation';

const timestamp = '2026-09-01T12:34:56.789Z';

function expense(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    kind: 'expense',
    accountId: 10,
    destinationAccountId: null,
    categoryId: 20,
    name: 'Groceries',
    description: null,
    amountCents: -1234,
    transactionDate: '2026-09-01',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  } as Transaction;
}

function activeExpenseRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 1,
    kind: 'expense',
    accountId: 10,
    categoryId: 20,
    name: 'Rent',
    description: null,
    amountCents: -150000,
    startDate: '2026-01-01',
    endDate: null,
    isActive: true,
    deletedAt: null,
    schedule: { frequency: 'monthly', chargeDay: 31, chargeMonth: null },
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  } as RecurringRule;
}

describe('financial model validation', () => {
  it('normalizes text according to the domain contract', () => {
    expect(validateRequiredText('  Account  ')).toEqual({ ok: true, value: 'Account' });
    expect(validateRequiredText('   ')).toEqual({ ok: false, error: 'invalid_required_text' });
    expect(normalizeOptionalText('  Description  ')).toBe('Description');
    expect(normalizeOptionalText('  ')).toBeNull();
  });

  it('requires a category for a new expense and rejects future dates', () => {
    expect(validateNewTransaction(expense({ categoryId: null }), '2026-09-01')).toEqual({
      ok: false,
      error: 'expense_category_required',
    });
    expect(validateNewTransaction(expense({ transactionDate: '2026-09-02' }), '2026-09-01')).toEqual({
      ok: false,
      error: 'future_civil_date',
    });
  });

  it('rejects persisted models that were not normalized at the domain boundary', () => {
    expect(validateNewTransaction(expense({ name: ' Groceries ' }), '2026-09-01')).toEqual({
      ok: false,
      error: 'invalid_transaction',
    });
  });

  it('allows an inactive recurring expense whose category was deleted', () => {
    expect(
      validateRecurringRule(activeExpenseRule({ isActive: false, categoryId: null, deletedAt: timestamp })),
    ).toEqual(expect.objectContaining({ ok: true }));
  });

  it('enforces the signs and schedule invariants of recurring rules', () => {
    expect(validateRecurringRule(activeExpenseRule({ amountCents: 1 }))).toEqual({
      ok: false,
      error: 'invalid_recurring_rule',
    });
    expect(
      validateRecurringRule(
        activeExpenseRule({ schedule: { frequency: 'weekly', chargeDay: 1.5, chargeMonth: null } }),
      ),
    ).toEqual({ ok: false, error: 'invalid_recurring_rule' });
  });

  it('validates recurring occurrence references and civil dates', () => {
    expect(
      validateRecurringOccurrence({
        id: 1,
        recurringRuleId: 2,
        scheduledDate: '2026-09-01',
        transactionId: null,
        createdAt: timestamp,
      }),
    ).toEqual(expect.objectContaining({ ok: true }));
    expect(
      validateRecurringOccurrence({
        id: 1,
        recurringRuleId: 2,
        scheduledDate: '2026-02-30',
        transactionId: null,
        createdAt: timestamp,
      }),
    ).toEqual({ ok: false, error: 'invalid_civil_date' });
  });
});
