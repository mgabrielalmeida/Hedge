export type Cents = number;
export type EntityId = number;
export type CivilDate = string;
export type YearMonth = string;
export type UtcTimestamp = string;

export interface Account {
  readonly id: EntityId;
  readonly name: string;
  readonly institutionName: string;
  readonly iconValue: string;
  readonly colorValue: string;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface Category {
  readonly id: EntityId;
  readonly name: string;
  readonly monthlyBudgetCents: Cents;
  readonly iconValue: string;
  readonly colorValue: string;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

interface TransactionBase {
  readonly id: EntityId;
  readonly accountId: EntityId;
  readonly name: string;
  readonly description: string | null;
  readonly amountCents: Cents;
  readonly transactionDate: CivilDate;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface ExpenseTransaction extends TransactionBase {
  readonly kind: 'expense';
  readonly categoryId: EntityId | null;
  readonly destinationAccountId: null;
}

export interface IncomeTransaction extends TransactionBase {
  readonly kind: 'income';
  readonly categoryId: null;
  readonly destinationAccountId: null;
}

export interface TransferTransaction extends TransactionBase {
  readonly kind: 'transfer';
  readonly categoryId: null;
  readonly destinationAccountId: EntityId;
}

export interface OpeningBalanceTransaction extends TransactionBase {
  readonly kind: 'opening_balance';
  readonly categoryId: null;
  readonly destinationAccountId: null;
}

export type Transaction =
  | ExpenseTransaction
  | IncomeTransaction
  | TransferTransaction
  | OpeningBalanceTransaction;

export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export interface WeeklySchedule {
  readonly frequency: 'weekly';
  readonly chargeDay: number;
  readonly chargeMonth: null;
}

export interface MonthlySchedule {
  readonly frequency: 'monthly';
  readonly chargeDay: number;
  readonly chargeMonth: null;
}

export interface YearlySchedule {
  readonly frequency: 'yearly';
  readonly chargeDay: number;
  readonly chargeMonth: number;
}

export type RecurringSchedule = WeeklySchedule | MonthlySchedule | YearlySchedule;

interface RecurringRuleBase {
  readonly id: EntityId;
  readonly accountId: EntityId;
  readonly name: string;
  readonly description: string | null;
  readonly amountCents: Cents;
  readonly startDate: CivilDate;
  readonly endDate: CivilDate | null;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface IncomeRecurringRule extends RecurringRuleBase {
  readonly kind: 'income';
  readonly categoryId: null;
  readonly isActive: boolean;
  readonly deletedAt: UtcTimestamp | null;
  readonly schedule: RecurringSchedule;
}

export interface ActiveExpenseRecurringRule extends RecurringRuleBase {
  readonly kind: 'expense';
  readonly categoryId: EntityId;
  readonly isActive: true;
  readonly deletedAt: null;
  readonly schedule: RecurringSchedule;
}

export interface InactiveExpenseRecurringRule extends RecurringRuleBase {
  readonly kind: 'expense';
  readonly categoryId: EntityId | null;
  readonly isActive: false;
  readonly deletedAt: UtcTimestamp | null;
  readonly schedule: RecurringSchedule;
}

export type RecurringRule =
  | IncomeRecurringRule
  | ActiveExpenseRecurringRule
  | InactiveExpenseRecurringRule;

export interface RecurringOccurrence {
  readonly id: EntityId;
  readonly recurringRuleId: EntityId;
  readonly scheduledDate: CivilDate;
  readonly transactionId: EntityId | null;
  readonly createdAt: UtcTimestamp;
}
