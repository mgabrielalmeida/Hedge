import { addCents, assertSafeCents } from '@/domain';
import type { Cents, EntityId, Transaction, YearMonth } from '@/domain';

export type MonthlyCategorySpendingItem = {
  readonly categoryId: EntityId;
  readonly spendingCents: Cents;
};

export type MonthlyCategorySpendingComposition = {
  readonly items: readonly MonthlyCategorySpendingItem[];
  readonly totalSpendingCents: Cents;
};

export function buildMonthlyCategorySpendingComposition(
  transactions: readonly Transaction[],
  categoryIds: readonly EntityId[],
  month: YearMonth,
): MonthlyCategorySpendingComposition {
  const spendingByCategory = new Map(categoryIds.map((categoryId) => [categoryId, 0 as Cents]));
  let totalSpendingCents: Cents = 0;

  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' || transaction.transactionDate.slice(0, 7) !== month) {
      continue;
    }

    assertSafeCents(transaction.amountCents);
    const spendingCents = -transaction.amountCents;
    assertSafeCents(spendingCents);
    const categoryId = transaction.categoryId;
    if (categoryId === null || !spendingByCategory.has(categoryId)) {
      continue;
    }

    totalSpendingCents = addCents(totalSpendingCents, spendingCents);
    spendingByCategory.set(
      categoryId,
      addCents(spendingByCategory.get(categoryId) ?? 0, spendingCents),
    );
  }

  return {
    items: categoryIds.map((categoryId) => ({
      categoryId,
      spendingCents: spendingByCategory.get(categoryId) ?? 0,
    })),
    totalSpendingCents,
  };
}
