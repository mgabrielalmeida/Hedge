import type { Transaction } from '@/domain';

import { buildCategorySpendingHistory } from './categorySpendingHistory';

const timestamp = '2026-09-06T12:00:00.000Z';

function expense(
  id: number,
  accountId: number,
  categoryId: number,
  amountCents: number,
  transactionDate: string,
): Transaction {
  return {
    id,
    kind: 'expense',
    accountId,
    categoryId,
    destinationAccountId: null,
    name: `Expense ${id}`,
    description: null,
    amountCents,
    transactionDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('category spending history', () => {
  it('groups six ending months by every registered account', () => {
    const history = buildCategorySpendingHistory([
      expense(1, 1, 7, -1_000, '2026-04-10'),
      expense(2, 1, 7, -2_500, '2026-09-05'),
      expense(3, 2, 7, -750, '2026-09-01'),
      expense(4, 1, 8, -9_999, '2026-09-02'),
      expense(5, 1, 7, -9_999, '2026-03-31'),
    ], [1, 2, 3], 7, '2026-09');

    expect(history.months).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
    ]);
    expect(history.series).toEqual([
      { accountId: 1, spendingByMonth: [1_000, 0, 0, 0, 0, 2_500] },
      { accountId: 2, spendingByMonth: [0, 0, 0, 0, 0, 750] },
      { accountId: 3, spendingByMonth: [0, 0, 0, 0, 0, 0] },
    ]);
  });

  it('crosses the year boundary and validates the requested range', () => {
    expect(buildCategorySpendingHistory([], [1], 7, '2026-02', 3).months)
      .toEqual(['2025-12', '2026-01', '2026-02']);
    expect(() => buildCategorySpendingHistory([], [], 7, '2026-02', 0)).toThrow(RangeError);
  });
});
