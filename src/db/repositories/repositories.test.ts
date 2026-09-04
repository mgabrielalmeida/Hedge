import { initializeDatabase } from '@/db/database';

import {
  createAccount,
  createCategory,
  createDueOccurrence,
  createRecurringRule,
  createTransaction,
  deleteCategory,
  deleteRecurringRule,
  deleteTransaction,
  findTransactionById,
  listAccounts,
  listCategories,
  listRecurringRules,
  listTransactions,
  processDueRecurringRules,
  updateAccount,
  updateCategory,
  updateRecurringRule,
  updateTransaction,
} from '.';
import { createTestDatabase, type TestDatabase } from '../testDatabase';

const createdAt = '2026-09-02T10:00:00.000Z';
const updatedAt = '2026-09-02T11:00:00.000Z';

describe('SQLite repositories', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => database.close());

  it('creates an account and its opening balance atomically, and maps the domain model', async () => {
    const account = await createAccount(database, {
      name: '  Main account  ', institutionName: '  Banco A ', visualType: 'color', visualValue: ' #123456 ',
      initialBalanceCents: -1_250, openingBalanceDate: '2026-09-02', openingBalanceDescription: '  Overdraft  ',
    }, () => createdAt);

    expect(account).toMatchObject({
      id: 1, name: 'Main account', institutionName: 'Banco A', visualType: 'color', visualValue: '#123456', createdAt, updatedAt: createdAt,
    });
    await expect(listTransactions(database)).resolves.toEqual([
      expect.objectContaining({ kind: 'opening_balance', accountId: account.id, amountCents: -1_250, description: 'Overdraft' }),
    ]);
    await expect(updateAccount(database, account.id, {
      name: 'New main', institutionName: 'Banco B', visualType: 'icon', visualValue: 'bank',
    }, () => updatedAt)).resolves.toEqual(expect.objectContaining({ name: 'New main', updatedAt }));
    await expect(listAccounts(database)).resolves.toHaveLength(1);
  });

  it('rolls back account creation when the related opening balance cannot be completed', async () => {
    await database.execAsync(`
      CREATE TRIGGER reject_opening_balance
      BEFORE INSERT ON transactions
      WHEN NEW.kind = 'opening_balance'
      BEGIN
        SELECT RAISE(ABORT, 'opening balance rejected');
      END;
    `);
    await expect(createAccount(database, {
      name: 'Main', institutionName: 'Bank', visualType: 'icon', visualValue: 'bank', initialBalanceCents: 0, openingBalanceDate: '2026-09-02',
    }, () => createdAt)).rejects.toThrow('opening balance rejected');

    await expect(listAccounts(database)).resolves.toEqual([]);
    await expect(listTransactions(database)).resolves.toEqual([]);
  });

  it('updates categories and deactivates affected rules before deleting a category', async () => {
    const account = await createAccount(database, {
      name: 'Main', institutionName: 'Bank', visualType: 'icon', visualValue: 'bank', initialBalanceCents: 0, openingBalanceDate: '2026-09-02',
    }, () => createdAt);
    const category = await createCategory(database, { name: "  O'Reilly Travel ", monthlyBudgetCents: 25_000 }, () => createdAt);
    expect(category.name).toBe("O'Reilly Travel");
    await expect(updateCategory(database, category.id, { name: 'Trips', monthlyBudgetCents: 30_000 }, () => updatedAt)).resolves.toEqual(expect.objectContaining({ name: 'Trips', monthlyBudgetCents: 30_000, updatedAt }));
    const expense = await createTransaction(database, {
      kind: 'expense', accountId: account.id, categoryId: category.id, name: 'Hotel', amountCents: -10_000, transactionDate: '2026-09-02',
    }, () => createdAt);
    const rule = await createRecurringRule(database, {
      kind: 'expense', accountId: account.id, categoryId: category.id, name: 'Insurance', amountCents: -500, frequency: 'monthly', chargeDay: 1, startDate: '2026-09-01',
    }, () => createdAt);

    await expect(deleteCategory(database, category.id, () => updatedAt)).resolves.toBe(true);
    await expect(findTransactionById(database, expense.id)).resolves.toEqual(expect.objectContaining({ categoryId: null }));
    await expect(listRecurringRules(database)).resolves.toEqual([
      expect.objectContaining({ id: rule.id, isActive: false, categoryId: null, deletedAt: updatedAt, updatedAt }),
    ]);
    expect((await listCategories(database)).some((item) => item.id === category.id)).toBe(false);
  });

  it('persists, maps, edits and permanently deletes each point transaction kind', async () => {
    const source = await createAccount(database, { name: 'Source', institutionName: 'A', visualType: 'icon', visualValue: 'bank', initialBalanceCents: 0, openingBalanceDate: '2026-09-02' }, () => createdAt);
    const destination = await createAccount(database, { name: 'Destination', institutionName: 'B', visualType: 'icon', visualValue: 'wallet', initialBalanceCents: 0, openingBalanceDate: '2026-09-02' }, () => createdAt);
    const category = await createCategory(database, { name: 'Food', monthlyBudgetCents: 0 }, () => createdAt);
    const expense = await createTransaction(database, { kind: 'expense', accountId: source.id, categoryId: category.id, name: ' Lunch ', description: ' ', amountCents: -1_250, transactionDate: '2026-09-02' }, () => createdAt);
    const income = await createTransaction(database, { kind: 'income', accountId: source.id, name: 'Salary', amountCents: 10_000, transactionDate: '2026-09-02' }, () => createdAt);
    const transfer = await createTransaction(database, { kind: 'transfer', accountId: source.id, destinationAccountId: destination.id, name: 'Reserve', amountCents: -2_000, transactionDate: '2026-09-02' }, () => createdAt);
    expect([expense, income, transfer]).toEqual([
      expect.objectContaining({ kind: 'expense', name: 'Lunch', description: null, categoryId: category.id }),
      expect.objectContaining({ kind: 'income', categoryId: null, destinationAccountId: null }),
      expect.objectContaining({ kind: 'transfer', destinationAccountId: destination.id }),
    ]);
    await expect(updateTransaction(database, expense.id, { kind: 'expense', accountId: source.id, categoryId: category.id, name: 'Dinner', amountCents: -1_500, transactionDate: '2026-09-02' }, () => updatedAt)).resolves.toEqual(expect.objectContaining({ name: 'Dinner', amountCents: -1_500, updatedAt }));
    await expect(updateTransaction(database, transfer.id, { kind: 'transfer', accountId: destination.id, destinationAccountId: source.id, name: 'Return', amountCents: -750, transactionDate: '2026-09-01' }, () => updatedAt)).resolves.toEqual(expect.objectContaining({ accountId: destination.id, destinationAccountId: source.id, name: 'Return', amountCents: -750, transactionDate: '2026-09-01', updatedAt }));
    await expect(deleteTransaction(database, income.id)).resolves.toBe(true);
    await expect(deleteTransaction(database, transfer.id)).resolves.toBe(true);
    expect((await listTransactions(database)).some((item) => item.id === income.id)).toBe(false);
    expect((await listTransactions(database)).some((item) => item.id === transfer.id)).toBe(false);
  });

  it('handles recurring rule lifecycle and rolls back a duplicate occurrence with its generated transaction', async () => {
    const account = await createAccount(database, { name: 'Main', institutionName: 'Bank', visualType: 'icon', visualValue: 'bank', initialBalanceCents: 0, openingBalanceDate: '2026-09-02' }, () => createdAt);
    const category = await createCategory(database, { name: 'Bills', monthlyBudgetCents: 0 }, () => createdAt);
    const rule = await createRecurringRule(database, { kind: 'expense', accountId: account.id, categoryId: category.id, name: 'Internet', amountCents: -150, frequency: 'monthly', chargeDay: 31, startDate: '2026-01-01' }, () => createdAt);
    await expect(updateRecurringRule(database, rule.id, { kind: 'expense', accountId: account.id, categoryId: category.id, name: 'Internet plus', amountCents: -200, frequency: 'yearly', chargeDay: 29, chargeMonth: 2, startDate: '2026-01-01', endDate: '2028-02-29' }, () => updatedAt)).resolves.toEqual(expect.objectContaining({ name: 'Internet plus', updatedAt, schedule: { frequency: 'yearly', chargeDay: 29, chargeMonth: 2 } }));
    const activeRule = (await listRecurringRules(database, true))[0];
    await expect(createDueOccurrence(database, activeRule.id, '2028-02-28', () => updatedAt)).rejects.toThrow('not due');
    const generated = await createDueOccurrence(database, activeRule.id, '2028-02-29', () => updatedAt);
    expect(generated).toEqual({ occurrence: expect.objectContaining({ recurringRuleId: rule.id, scheduledDate: '2028-02-29' }), transaction: expect.objectContaining({ kind: 'expense', name: 'Internet plus', amountCents: -200 }) });
    const countBeforeDuplicate = (await listTransactions(database)).length;
    await expect(createDueOccurrence(database, activeRule.id, '2028-02-29', () => updatedAt)).rejects.toThrow();
    expect((await listTransactions(database)).length).toBe(countBeforeDuplicate);
    await expect(deleteRecurringRule(database, rule.id, () => updatedAt)).resolves.toBe(true);
    await expect(listRecurringRules(database, true)).resolves.toEqual([]);
    await expect(createDueOccurrence(database, activeRule.id, '2029-02-28', () => updatedAt)).rejects.toThrow('not due');
  });

  it('processes every rule due today once and preserves occurrence tombstones', async () => {
    const account = await createAccount(database, { name: 'Main', institutionName: 'Bank', visualType: 'icon', visualValue: 'bank', initialBalanceCents: 0, openingBalanceDate: '2026-09-02' }, () => createdAt);
    const category = await createCategory(database, { name: 'Recurring bills', monthlyBudgetCents: 0 }, () => createdAt);
    await createRecurringRule(database, { kind: 'income', accountId: account.id, name: 'Weekly income', amountCents: 1_000, frequency: 'weekly', chargeDay: 3, startDate: '2026-09-01' }, () => createdAt);
    await createRecurringRule(database, { kind: 'expense', accountId: account.id, categoryId: category.id, name: 'Yearly fee', amountCents: -250, frequency: 'yearly', chargeDay: 2, chargeMonth: 9, startDate: '2025-01-01' }, () => createdAt);
    await createRecurringRule(database, { kind: 'expense', accountId: account.id, categoryId: category.id, name: 'Not today', amountCents: -100, frequency: 'monthly', chargeDay: 3, startDate: '2026-01-01' }, () => createdAt);

    const firstProcessing = await processDueRecurringRules(database, '2026-09-02', () => updatedAt);
    expect(firstProcessing.generated.map((item) => item.transaction.name)).toEqual(['Weekly income', 'Yearly fee']);
    await expect(processDueRecurringRules(database, '2026-09-02', () => updatedAt)).resolves.toEqual({ generated: [] });

    await deleteTransaction(database, firstProcessing.generated[0].transaction.id);
    await expect(processDueRecurringRules(database, '2026-09-02', () => updatedAt)).resolves.toEqual({ generated: [] });
    expect((await listTransactions(database)).filter((item) => item.transactionDate === '2026-09-02').map((item) => item.name)).toEqual(expect.arrayContaining(['Saldo inicial', 'Yearly fee']));
  });
});
