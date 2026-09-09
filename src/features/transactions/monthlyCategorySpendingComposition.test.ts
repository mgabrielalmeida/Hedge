import type { Transaction } from '@/domain';

import { buildMonthlyCategorySpendingComposition } from './monthlyCategorySpendingComposition';

const timestamp = '2026-09-09T12:00:00.000Z';

function expense(
  id: number,
  categoryId: number | null,
  amountCents: number,
  transactionDate = '2026-09-09',
): Transaction {
  return {
    accountId: 1,
    amountCents,
    categoryId,
    createdAt: timestamp,
    description: null,
    destinationAccountId: null,
    id,
    kind: 'expense',
    name: `Expense ${id}`,
    transactionDate,
    updatedAt: timestamp,
  };
}

describe('monthly category spending composition', () => {
  it('ranks five categories and groups the remaining and deleted categories', () => {
    const composition = buildMonthlyCategorySpendingComposition([
      expense(1, 1, -1_000),
      expense(2, 2, -6_000),
      expense(3, 3, -5_000),
      expense(4, 4, -4_000),
      expense(5, 5, -3_000),
      expense(6, 6, -2_000),
      expense(7, null, -700),
      expense(8, 99, -300),
      expense(9, 2, -9_999, '2026-08-31'),
    ], [1, 2, 3, 4, 5, 6], '2026-09');

    expect(composition).toEqual({
      items: [
        { categoryId: 2, spendingCents: 6_000 },
        { categoryId: 3, spendingCents: 5_000 },
        { categoryId: 4, spendingCents: 4_000 },
        { categoryId: 5, spendingCents: 3_000 },
        { categoryId: 6, spendingCents: 2_000 },
      ],
      otherSpendingCents: 2_000,
      totalSpendingCents: 22_000,
    });
  });

  it('ignores non-expenses and validates the visible category limit', () => {
    const income: Transaction = {
      accountId: 1,
      amountCents: 5_000,
      categoryId: null,
      createdAt: timestamp,
      description: null,
      destinationAccountId: null,
      id: 10,
      kind: 'income',
      name: 'Income',
      transactionDate: '2026-09-09',
      updatedAt: timestamp,
    };

    expect(buildMonthlyCategorySpendingComposition([income], [1], '2026-09'))
      .toEqual({ items: [], otherSpendingCents: 0, totalSpendingCents: 0 });
    expect(() => buildMonthlyCategorySpendingComposition([], [], '2026-09', 0))
      .toThrow(RangeError);
  });
});
