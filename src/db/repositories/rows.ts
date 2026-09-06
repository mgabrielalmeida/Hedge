import {
  validateAccount,
  validateCategory,
  validateRecurringOccurrence,
  validateRecurringRule,
  validateTransaction,
} from '@/domain';
import type {
  Account,
  Category,
  EntityId,
  RecurringOccurrence,
  RecurringRule,
  Transaction,
} from '@/domain';

export type AccountRow = {
  id: number;
  name: string;
  institution_name: string;
  icon_value: string;
  color_value: string;
  created_at: string;
  updated_at: string;
};

export type CategoryRow = {
  id: number;
  name: string;
  monthly_budget_cents: number;
  icon_value: string;
  color_value: string;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: number;
  kind: string;
  account_id: number;
  destination_account_id: number | null;
  category_id: number | null;
  name: string;
  description: string | null;
  amount_cents: number;
  transaction_date: string;
  created_at: string;
  updated_at: string;
};

export type RecurringRuleRow = {
  id: number;
  kind: string;
  account_id: number;
  category_id: number | null;
  name: string;
  description: string | null;
  amount_cents: number;
  frequency: string;
  charge_day: number;
  charge_month: number | null;
  start_date: string;
  end_date: string | null;
  is_active: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringOccurrenceRow = {
  id: number;
  recurring_rule_id: number;
  scheduled_date: string;
  transaction_id: number | null;
  created_at: string;
};

export function mapAccount(row: AccountRow): Account {
  const account: Account = {
    id: row.id,
    name: row.name,
    institutionName: row.institution_name,
    iconValue: row.icon_value,
    colorValue: row.color_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return unwrap(validateAccount(account), 'account row');
}

export function mapCategory(row: CategoryRow): Category {
  return unwrap(validateCategory({
    id: row.id,
    name: row.name,
    monthlyBudgetCents: row.monthly_budget_cents,
    iconValue: row.icon_value,
    colorValue: row.color_value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }), 'category row');
}

export function mapTransaction(row: TransactionRow): Transaction {
  const base = {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    description: row.description,
    amountCents: row.amount_cents,
    transactionDate: row.transaction_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  let transaction: Transaction;
  switch (row.kind) {
    case 'expense':
      transaction = { ...base, kind: 'expense', categoryId: row.category_id, destinationAccountId: null };
      break;
    case 'income':
      transaction = { ...base, kind: 'income', categoryId: null, destinationAccountId: null };
      break;
    case 'transfer':
      if (row.destination_account_id === null) throw new Error('Invalid transfer row.');
      transaction = { ...base, kind: 'transfer', categoryId: null, destinationAccountId: row.destination_account_id };
      break;
    case 'opening_balance':
      transaction = { ...base, kind: 'opening_balance', categoryId: null, destinationAccountId: null };
      break;
    default:
      throw new Error('Unknown transaction kind in database.');
  }
  return unwrap(validateTransaction(transaction), 'transaction row');
}

export function mapRecurringRule(row: RecurringRuleRow): RecurringRule {
  const schedule = mapSchedule(row);
  let rule: RecurringRule;
  if (row.kind === 'income') {
    rule = {
      id: row.id, kind: 'income', accountId: row.account_id, categoryId: null,
      name: row.name, description: row.description, amountCents: row.amount_cents,
      startDate: row.start_date, endDate: row.end_date, isActive: row.is_active === 1,
      deletedAt: row.deleted_at, schedule, createdAt: row.created_at, updatedAt: row.updated_at,
    };
  } else if (row.kind === 'expense') {
    rule = {
      id: row.id, kind: 'expense', accountId: row.account_id, categoryId: row.category_id,
      name: row.name, description: row.description, amountCents: row.amount_cents,
      startDate: row.start_date, endDate: row.end_date, isActive: row.is_active === 1,
      deletedAt: row.deleted_at, schedule, createdAt: row.created_at, updatedAt: row.updated_at,
    } as RecurringRule;
  } else {
    throw new Error('Unknown recurring rule kind in database.');
  }
  return unwrap(validateRecurringRule(rule), 'recurring rule row');
}

export function mapRecurringOccurrence(row: RecurringOccurrenceRow): RecurringOccurrence {
  return unwrap(validateRecurringOccurrence({
    id: row.id,
    recurringRuleId: row.recurring_rule_id,
    scheduledDate: row.scheduled_date,
    transactionId: row.transaction_id,
    createdAt: row.created_at,
  }), 'recurring occurrence row');
}

function mapSchedule(row: RecurringRuleRow): RecurringRule['schedule'] {
  switch (row.frequency) {
    case 'weekly': return { frequency: 'weekly', chargeDay: row.charge_day, chargeMonth: null };
    case 'monthly': return { frequency: 'monthly', chargeDay: row.charge_day, chargeMonth: null };
    case 'yearly':
      if (row.charge_month === null) throw new Error('Invalid yearly recurring rule row.');
      return { frequency: 'yearly', chargeDay: row.charge_day, chargeMonth: row.charge_month };
    default: throw new Error('Unknown recurring frequency in database.');
  }
}

function unwrap<T>(result: { readonly ok: true; readonly value: T } | { readonly ok: false }, label: string): T {
  if (!result.ok) throw new Error(`Invalid ${label} returned by database.`);
  return result.value;
}

export function entityId(value: number): EntityId {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Expected a persisted entity id.');
  return value;
}
