import {
  compareCivilDates,
  daysInMonth,
  getCivilDateParts,
  parseYearMonth,
} from '../models/civilDate';
import type {
  Cents,
  RecurringOccurrence,
  RecurringRule,
  Transaction,
  YearMonth,
} from '../models/financial';
import { addCents } from '../models/money';

import { calculateConsolidatedBalance } from './balances';
import { listRecurringRuleDatesDueBy } from './recurrence';

export type MonthlyRecurringItem = {
  readonly accountId: number;
  readonly amountCents: Cents;
  readonly name: string;
  readonly recurringRuleId: number;
  readonly scheduledDate: string;
  readonly status: 'processed' | 'pending';
};

export type MonthlyRecurringProjection = {
  readonly availableBalanceCents: Cents;
  readonly items: readonly MonthlyRecurringItem[];
  readonly monthEndDate: string;
};

/**
 * Projects the consolidated balance on the last day of a month. Transactions
 * already dated in that month are included once; only unprocessed recurring
 * occurrences are added to the registered balance.
 */
export function projectMonthEndBalance(
  month: YearMonth,
  transactions: readonly Transaction[],
  rules: readonly RecurringRule[],
  occurrences: readonly RecurringOccurrence[],
): MonthlyRecurringProjection {
  const parsedMonth = parseYearMonth(month);
  if (!parsedMonth.ok) throw new RangeError('Expected a valid year month.');

  const { year, month: monthNumber } = getCivilDateParts(`${month}-01`);
  const monthEndDate = `${month}-${String(daysInMonth(year, monthNumber)).padStart(2, '0')}`;
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const processedKeys = new Set<string>();
  const items: MonthlyRecurringItem[] = [];

  for (const occurrence of occurrences) {
    if (!occurrence.scheduledDate.startsWith(`${month}-`)) continue;
    const rule = rulesById.get(occurrence.recurringRuleId);
    if (!rule) continue;
    const transaction = occurrence.transactionId === null
      ? null
      : transactionsById.get(occurrence.transactionId) ?? null;

    processedKeys.add(recurringKey(rule.id, occurrence.scheduledDate));
    items.push({
      accountId: transaction?.accountId ?? rule.accountId,
      amountCents: transaction?.amountCents ?? rule.amountCents,
      name: transaction?.name ?? rule.name,
      recurringRuleId: rule.id,
      scheduledDate: occurrence.scheduledDate,
      status: 'processed',
    });
  }

  for (const rule of rules) {
    if (!rule.isActive) continue;
    for (const scheduledDate of listRecurringRuleDatesDueBy(rule, monthEndDate)) {
      if (!scheduledDate.startsWith(`${month}-`) || processedKeys.has(recurringKey(rule.id, scheduledDate))) continue;
      items.push({
        accountId: rule.accountId,
        amountCents: rule.amountCents,
        name: rule.name,
        recurringRuleId: rule.id,
        scheduledDate,
        status: 'pending',
      });
    }
  }

  const registeredBalanceAtMonthEnd = calculateConsolidatedBalance(
    transactions.filter((transaction) => compareCivilDates(transaction.transactionDate, monthEndDate) <= 0),
  );
  const pendingAmount = items
    .filter((item) => item.status === 'pending')
    .reduce<Cents>((total, item) => addCents(total, item.amountCents), 0);

  return {
    availableBalanceCents: addCents(registeredBalanceAtMonthEnd, pendingAmount),
    items: items.sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate) || left.name.localeCompare(right.name)),
    monthEndDate,
  };
}

function recurringKey(ruleId: number, scheduledDate: string): string {
  return `${ruleId}:${scheduledDate}`;
}
