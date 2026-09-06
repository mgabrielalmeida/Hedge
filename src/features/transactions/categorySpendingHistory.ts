import { addCents, assertSafeCents } from '@/domain';
import type { Cents, EntityId, Transaction, YearMonth } from '@/domain';

import { shiftYearMonth } from './monthNavigation';

export type AccountCategorySpendingSeries = {
  readonly accountId: EntityId;
  readonly spendingByMonth: readonly Cents[];
};

export type CategorySpendingHistory = {
  readonly months: readonly YearMonth[];
  readonly series: readonly AccountCategorySpendingSeries[];
};

export function buildCategorySpendingHistory(
  transactions: readonly Transaction[],
  accountIds: readonly EntityId[],
  categoryId: EntityId,
  endingMonth: YearMonth,
  monthCount = 6,
): CategorySpendingHistory {
  if (!Number.isInteger(monthCount) || monthCount < 1) {
    throw new RangeError('Month count must be a positive integer.');
  }

  const months = getTrailingMonths(endingMonth, monthCount);
  const monthIndexes = new Map(months.map((month, index) => [month, index]));
  const spendingByAccount = new Map(
    accountIds.map((accountId) => [accountId, Array<Cents>(months.length).fill(0)]),
  );

  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' || transaction.categoryId !== categoryId) continue;

    const monthIndex = monthIndexes.get(transaction.transactionDate.slice(0, 7));
    const spending = spendingByAccount.get(transaction.accountId);
    if (monthIndex === undefined || !spending) continue;

    assertSafeCents(transaction.amountCents);
    spending[monthIndex] = addCents(spending[monthIndex], -transaction.amountCents);
  }

  return {
    months,
    series: accountIds.map((accountId) => ({
      accountId,
      spendingByMonth: spendingByAccount.get(accountId) ?? [],
    })),
  };
}

function getTrailingMonths(endingMonth: YearMonth, monthCount: number): readonly YearMonth[] {
  const months: YearMonth[] = [endingMonth];

  while (months.length < monthCount) {
    const previousMonth = shiftYearMonth(months[0], -1);
    if (previousMonth === null) break;
    months.unshift(previousMonth);
  }

  return months;
}
