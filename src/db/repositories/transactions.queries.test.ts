import { initializeDatabase } from '@/db/database';
import { createTestDatabase, type TestDatabase } from '@/db/testDatabase';

import { createAccount } from './accounts';
import { createCategory } from './categories';
import { createTransaction, getConsolidatedBalanceThroughDate, getFinancialBalances, listCategoryMonthlySpending, listTransactionsPage } from './transactions';

describe('bounded transaction queries', () => {
  let database: TestDatabase;
  beforeEach(async () => { database = createTestDatabase(); await initializeDatabase(database); });
  afterEach(() => database.close());

  it('paginates deterministically and filters before materializing rows', async () => {
    const account = await createAccount(database, { name: 'Main', institutionName: 'Bank', iconValue: 'bank', colorValue: '#123456', initialBalanceCents: 1000, openingBalanceDate: '2026-09-01' });
    const category = await createCategory(database, { name: 'Food', monthlyBudgetCents: 10000 });
    for (let day = 1; day <= 5; day += 1) await createTransaction(database, { kind: 'expense', accountId: account.id, categoryId: category.id, name: `Expense ${day}`, amountCents: -day * 100, transactionDate: `2026-09-0${day}` });

    const first = await listTransactionsPage(database, { kind: 'points', month: '2026-09', limit: 2 });
    const second = await listTransactionsPage(database, { kind: 'points', month: '2026-09', limit: 2, cursor: first.nextCursor });
    expect(first.items.map((item) => item.name)).toEqual(['Expense 5', 'Expense 4']);
    expect(second.items.map((item) => item.name)).toEqual(['Expense 3', 'Expense 2']);
    expect(first.nextCursor).toEqual({ transactionDate: '2026-09-04', id: first.items[1].id });
  });

  it('aggregates balances and category spending in SQLite', async () => {
    const source = await createAccount(database, { name: 'Main', institutionName: 'A', iconValue: 'bank', colorValue: '#123456', initialBalanceCents: 10000, openingBalanceDate: '2026-09-01' });
    const destination = await createAccount(database, { name: 'Reserve', institutionName: 'B', iconValue: 'wallet', colorValue: '#123456', initialBalanceCents: 0, openingBalanceDate: '2026-09-01' });
    const category = await createCategory(database, { name: 'Food', monthlyBudgetCents: 10000 });
    await createTransaction(database, { kind: 'expense', accountId: source.id, categoryId: category.id, name: 'Food', amountCents: -1500, transactionDate: '2026-09-02' });
    await createTransaction(database, { kind: 'transfer', accountId: source.id, destinationAccountId: destination.id, name: 'Save', amountCents: -2000, transactionDate: '2026-09-03' });

    const balances = await getFinancialBalances(database);
    expect(balances.consolidatedCents).toBe(8500);
    expect(balances.byAccountId.get(source.id)).toBe(6500);
    expect(balances.byAccountId.get(destination.id)).toBe(2000);
    await expect(getConsolidatedBalanceThroughDate(database, '2026-09-03')).resolves.toBe(8500);
    await expect(listCategoryMonthlySpending(database, '2026-09')).resolves.toEqual([{ categoryId: category.id, spendingCents: 1500 }]);
  });
});
