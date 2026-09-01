import type { Cents, EntityId, Transaction, YearMonth } from '../models/financial';
import { addCents, assertSafeCents } from '../models/money';

export function calculateCategoryMonthlySpending(
  transactions: readonly Transaction[],
  categoryId: EntityId,
  month: YearMonth,
): Cents {
  return transactions.reduce((spending, transaction) => {
    if (
      transaction.kind !== 'expense' ||
      transaction.categoryId !== categoryId ||
      transaction.transactionDate.slice(0, 7) !== month
    ) {
      return spending;
    }

    assertSafeCents(transaction.amountCents);
    return addCents(spending, -transaction.amountCents);
  }, 0);
}
