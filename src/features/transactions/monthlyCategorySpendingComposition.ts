import { addCents, assertSafeCents } from '@/domain';
import type { Cents, EntityId, Transaction, YearMonth } from '@/domain';

export type MonthlyCategorySpendingItem = {
  readonly categoryId: EntityId;
  readonly spendingCents: Cents;
};

export type MonthlyCategorySpendingComposition = {
  readonly items: readonly MonthlyCategorySpendingItem[];
  readonly otherSpendingCents: Cents;
  readonly totalSpendingCents: Cents;
};

export function buildMonthlyCategorySpendingComposition(
  transactions: readonly Transaction[],
  categoryIds: readonly EntityId[],
  month: YearMonth,
  visibleCategoryLimit = 5,
): MonthlyCategorySpendingComposition {
  if (!Number.isInteger(visibleCategoryLimit) || visibleCategoryLimit < 1) {
    throw new RangeError('Visible category limit must be a positive integer.');
  }

  const spendingByCategory = new Map(categoryIds.map((categoryId) => [categoryId, 0 as Cents]));
  let unmatchedSpendingCents: Cents = 0;
  let totalSpendingCents: Cents = 0;

  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' || transaction.transactionDate.slice(0, 7) !== month) {
      continue;
    }

    assertSafeCents(transaction.amountCents);
    const spendingCents = -transaction.amountCents;
    assertSafeCents(spendingCents);
    totalSpendingCents = addCents(totalSpendingCents, spendingCents);

    const categoryId = transaction.categoryId;
    if (categoryId === null || !spendingByCategory.has(categoryId)) {
      unmatchedSpendingCents = addCents(unmatchedSpendingCents, spendingCents);
      continue;
    }

    spendingByCategory.set(
      categoryId,
      addCents(spendingByCategory.get(categoryId) ?? 0, spendingCents),
    );
  }

  const rankedItems = [...spendingByCategory.entries()]
    .filter(([, spendingCents]) => spendingCents > 0)
    .map(([categoryId, spendingCents]) => ({ categoryId, spendingCents }))
    .sort((left, right) => (
      right.spendingCents - left.spendingCents || left.categoryId - right.categoryId
    ));
  const items = rankedItems.slice(0, visibleCategoryLimit);
  const otherSpendingCents = rankedItems
    .slice(visibleCategoryLimit)
    .reduce(
      (total, item) => addCents(total, item.spendingCents),
      unmatchedSpendingCents,
    );

  return { items, otherSpendingCents, totalSpendingCents };
}
