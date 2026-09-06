import {
  parseCivilDate,
  validateDateRange,
  validateNotFuture,
  type CivilDateError,
} from './civilDate';
import type {
  Account,
  Category,
  EntityId,
  RecurringOccurrence,
  RecurringRule,
  Transaction,
  UtcTimestamp,
} from './financial';
import { invalid, isSafeCents, valid, type ValidationResult } from './money';

export type DomainValidationError =
  | 'invalid_entity_id'
  | 'invalid_required_text'
  | 'invalid_optional_text'
  | 'invalid_utc_timestamp'
  | 'invalid_account'
  | 'invalid_category'
  | 'invalid_recurring_occurrence'
  | 'invalid_category_budget'
  | 'invalid_transaction'
  | 'expense_category_required'
  | 'invalid_recurring_rule'
  | CivilDateError;

export function validateEntityId(value: number): ValidationResult<EntityId, 'invalid_entity_id'> {
  return Number.isSafeInteger(value) && value > 0 ? valid(value) : invalid('invalid_entity_id');
}

export function validateRequiredText(value: string): ValidationResult<string, 'invalid_required_text'> {
  const normalized = value.trim();
  return normalized.length > 0 ? valid(normalized) : invalid('invalid_required_text');
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

export function isUtcTimestamp(value: string): value is UtcTimestamp {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/.exec(value);
  if (!match) {
    return false;
  }

  const [, date, hours, minutes, seconds] = match;
  return parseCivilDate(date).ok && Number(hours) <= 23 && Number(minutes) <= 59 && Number(seconds) <= 59;
}

export function validateCategoryBudget(value: number): ValidationResult<number, 'invalid_category_budget'> {
  return isSafeCents(value) && value >= 0 ? valid(value) : invalid('invalid_category_budget');
}

export function validateAccount(account: Account): ValidationResult<Account, DomainValidationError> {
  if (
    !validateEntityId(account.id).ok ||
    !isNormalizedRequiredText(account.name) ||
    !isNormalizedRequiredText(account.institutionName) ||
    !isNormalizedRequiredText(account.iconValue) ||
    !isNormalizedRequiredText(account.colorValue) ||
    !isUtcTimestamp(account.createdAt) ||
    !isUtcTimestamp(account.updatedAt)
  ) {
    return invalid('invalid_account');
  }

  return valid(account);
}

export function validateCategory(category: Category): ValidationResult<Category, DomainValidationError> {
  if (
    !validateEntityId(category.id).ok ||
    !isNormalizedRequiredText(category.name) ||
    !validateCategoryBudget(category.monthlyBudgetCents).ok ||
    !isNormalizedRequiredText(category.iconValue) ||
    !isNormalizedRequiredText(category.colorValue) ||
    !isUtcTimestamp(category.createdAt) ||
    !isUtcTimestamp(category.updatedAt)
  ) {
    return invalid('invalid_category');
  }

  return valid(category);
}

export function validateTransaction(
  transaction: Transaction,
  referenceDate?: string,
): ValidationResult<Transaction, DomainValidationError> {
  if (!hasValidTransactionBase(transaction)) {
    return invalid('invalid_transaction');
  }

  const transactionDate = parseCivilDate(transaction.transactionDate);
  if (!transactionDate.ok) {
    return transactionDate;
  }

  if (referenceDate !== undefined) {
    const reference = parseCivilDate(referenceDate);
    if (!reference.ok) {
      return reference;
    }

    const futureValidation = validateNotFuture(transactionDate.value, reference.value);
    if (!futureValidation.ok) {
      return futureValidation;
    }
  }

  switch (transaction.kind) {
    case 'expense':
      return transaction.amountCents < 0 && transaction.destinationAccountId === null &&
        (transaction.categoryId === null || validateEntityId(transaction.categoryId).ok)
        ? valid(transaction)
        : invalid('invalid_transaction');
    case 'income':
      return transaction.amountCents > 0 && transaction.categoryId === null &&
        transaction.destinationAccountId === null
        ? valid(transaction)
        : invalid('invalid_transaction');
    case 'transfer':
      return transaction.amountCents < 0 && transaction.categoryId === null &&
        validateEntityId(transaction.destinationAccountId).ok &&
        transaction.destinationAccountId !== transaction.accountId
        ? valid(transaction)
        : invalid('invalid_transaction');
    case 'opening_balance':
      return transaction.categoryId === null && transaction.destinationAccountId === null
        ? valid(transaction)
        : invalid('invalid_transaction');
  }
}

export function validateNewTransaction(
  transaction: Transaction,
  referenceDate: string,
): ValidationResult<Transaction, DomainValidationError> {
  const validation = validateTransaction(transaction, referenceDate);
  if (!validation.ok) {
    return validation;
  }

  return transaction.kind === 'expense' && transaction.categoryId === null
    ? invalid('expense_category_required')
    : validation;
}

export function validateRecurringRule(
  rule: RecurringRule,
): ValidationResult<RecurringRule, DomainValidationError> {
  if (
    !validateEntityId(rule.id).ok ||
    !validateEntityId(rule.accountId).ok ||
    !isNormalizedRequiredText(rule.name) ||
    !isNormalizedOptionalText(rule.description) ||
    !isSafeCents(rule.amountCents) ||
    !isUtcTimestamp(rule.createdAt) ||
    !isUtcTimestamp(rule.updatedAt) ||
    (rule.deletedAt !== null && !isUtcTimestamp(rule.deletedAt))
  ) {
    return invalid('invalid_recurring_rule');
  }

  const startDate = parseCivilDate(rule.startDate);
  const endDate = rule.endDate === null ? valid(null) : parseCivilDate(rule.endDate);
  if (!startDate.ok) {
    return startDate;
  }
  if (!endDate.ok) {
    return endDate;
  }

  const dateRange = validateDateRange(startDate.value, endDate.value);
  if (!dateRange.ok) {
    return dateRange;
  }

  if (!hasValidSchedule(rule)) {
    return invalid('invalid_recurring_rule');
  }

  if (rule.kind === 'expense') {
    if (rule.amountCents >= 0 || (rule.isActive && !validateEntityId(rule.categoryId).ok)) {
      return invalid('invalid_recurring_rule');
    }
  } else if (rule.amountCents <= 0 || rule.categoryId !== null) {
    return invalid('invalid_recurring_rule');
  }

  if (rule.isActive && rule.deletedAt !== null) {
    return invalid('invalid_recurring_rule');
  }

  return valid(rule);
}

export function validateRecurringOccurrence(
  occurrence: RecurringOccurrence,
): ValidationResult<RecurringOccurrence, DomainValidationError> {
  if (
    !validateEntityId(occurrence.id).ok ||
    !validateEntityId(occurrence.recurringRuleId).ok ||
    (occurrence.transactionId !== null && !validateEntityId(occurrence.transactionId).ok) ||
    !isUtcTimestamp(occurrence.createdAt)
  ) {
    return invalid('invalid_recurring_occurrence');
  }

  const scheduledDate = parseCivilDate(occurrence.scheduledDate);
  return scheduledDate.ok ? valid(occurrence) : scheduledDate;
}

function hasValidTransactionBase(transaction: Transaction): boolean {
  return (
    validateEntityId(transaction.id).ok &&
    validateEntityId(transaction.accountId).ok &&
    isNormalizedRequiredText(transaction.name) &&
    isNormalizedOptionalText(transaction.description) &&
    isSafeCents(transaction.amountCents) &&
    isUtcTimestamp(transaction.createdAt) &&
    isUtcTimestamp(transaction.updatedAt)
  );
}

function isNormalizedRequiredText(value: string): boolean {
  const validation = validateRequiredText(value);
  return validation.ok && validation.value === value;
}

function isNormalizedOptionalText(value: string | null): boolean {
  return normalizeOptionalText(value) === value;
}

function hasValidSchedule(rule: RecurringRule): boolean {
  const { schedule } = rule;
  switch (schedule.frequency) {
    case 'weekly':
      return Number.isInteger(schedule.chargeDay) &&
        schedule.chargeDay >= 1 && schedule.chargeDay <= 7 && schedule.chargeMonth === null;
    case 'monthly':
      return Number.isInteger(schedule.chargeDay) &&
        schedule.chargeDay >= 1 && schedule.chargeDay <= 31 && schedule.chargeMonth === null;
    case 'yearly':
      return Number.isInteger(schedule.chargeDay) && Number.isInteger(schedule.chargeMonth) &&
        schedule.chargeDay >= 1 && schedule.chargeDay <= 31 &&
        schedule.chargeMonth >= 1 && schedule.chargeMonth <= 12;
  }
}
