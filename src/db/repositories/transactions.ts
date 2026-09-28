import { normalizeOptionalText, parseCivilDate, validateRequiredText } from '@/domain';
import type { Cents, CivilDate, EntityId, Transaction, YearMonth } from '@/domain';

import { type Clock, type RepositoryDatabase, systemClock } from './database';
import { mapTransaction, type TransactionRow } from './rows';

const transactionColumns = 'id, kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at';

export type TransactionInput = {
  readonly kind: Transaction['kind'];
  readonly accountId: EntityId;
  readonly destinationAccountId?: EntityId | null;
  readonly categoryId?: EntityId | null;
  readonly name: string;
  readonly description?: string | null;
  readonly amountCents: Cents;
  readonly transactionDate: CivilDate;
};

export type TransactionPageCursor = {
  readonly transactionDate: CivilDate;
  readonly id: EntityId;
};

export type TransactionPage = {
  readonly items: readonly Transaction[];
  readonly nextCursor: TransactionPageCursor | null;
};

export type TransactionPageQuery = {
  readonly accountId?: EntityId | null;
  readonly cursor?: TransactionPageCursor | null;
  readonly kind: 'points' | 'transfers';
  readonly limit?: number;
  readonly month: YearMonth;
};

export type FinancialBalances = {
  readonly byAccountId: ReadonlyMap<EntityId, Cents>;
  readonly consolidatedCents: Cents;
};

export type CategoryMonthlySpending = {
  readonly categoryId: EntityId;
  readonly spendingCents: Cents;
};

export type AccountMonthlyCategorySpending = {
  readonly accountId: EntityId;
  readonly month: YearMonth;
  readonly spendingCents: Cents;
};

export async function createTransaction(db: RepositoryDatabase, input: TransactionInput, clock: Clock = systemClock): Promise<Transaction> {
  const transaction = normalized(input); const timestamp = clock();
  await assertActiveAccounts(db, transaction.accountId, transaction.destinationAccountId);
  const row = await db.getFirstAsync<TransactionRow>(
    `INSERT INTO transactions (kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${transactionColumns};`,
    transaction.kind, transaction.accountId, transaction.destinationAccountId, transaction.categoryId, transaction.name, transaction.description, transaction.amountCents, transaction.transactionDate, timestamp, timestamp,
  );
  if (!row) throw new Error('Created transaction was not found.'); return mapTransaction(row);
}

export async function listTransactions(db: RepositoryDatabase): Promise<readonly Transaction[]> {
  const rows = await db.getAllAsync<TransactionRow>(`SELECT t.${transactionColumns.replaceAll(', ', ', t.')} FROM transactions t JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0 LEFT JOIN accounts d ON d.id = t.destination_account_id WHERE t.destination_account_id IS NULL OR d.is_archived = 0 ORDER BY t.transaction_date DESC, t.id DESC;`);
  return rows.map(mapTransaction);
}

export async function listTransactionsPage(db: RepositoryDatabase, query: TransactionPageQuery): Promise<TransactionPage> {
  const limit = query.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Transaction page limit must be between 1 and 100.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)) throw new Error('Invalid transaction page month.');
  if (query.accountId !== undefined && query.accountId !== null && !validId(query.accountId)) throw new Error('Invalid transaction page account.');
  if (query.cursor && (!validId(query.cursor.id) || !parseCivilDate(query.cursor.transactionDate).ok)) throw new Error('Invalid transaction page cursor.');

  const parameters: (string | number | null)[] = [`${query.month}-01`, nextMonth(query.month)];
  const conditions = ['t.transaction_date >= ?', 't.transaction_date < ?'];
  if (query.kind === 'transfers') conditions.push("t.kind = 'transfer'");
  else conditions.push("t.kind IN ('expense', 'income')");
  if (query.accountId !== undefined && query.accountId !== null) {
    conditions.push('(t.account_id = ? OR t.destination_account_id = ?)');
    parameters.push(query.accountId, query.accountId);
  }
  if (query.cursor) {
    conditions.push('(t.transaction_date < ? OR (t.transaction_date = ? AND t.id < ?))');
    parameters.push(query.cursor.transactionDate, query.cursor.transactionDate, query.cursor.id);
  }
  parameters.push(limit + 1);
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT t.${transactionColumns.replaceAll(', ', ', t.')}
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0
     LEFT JOIN accounts d ON d.id = t.destination_account_id
     WHERE (t.destination_account_id IS NULL OR d.is_archived = 0)
       AND ${conditions.join(' AND ')}
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT ?;`,
    ...parameters,
  );
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  return {
    items: pageRows.map(mapTransaction),
    nextCursor: rows.length > limit && last ? { transactionDate: last.transaction_date, id: last.id } : null,
  };
}

export async function getFinancialBalances(db: RepositoryDatabase): Promise<FinancialBalances> {
  const rows = await db.getAllAsync<{ account_id: number; balance_cents: number }>(
    `WITH visible_transactions AS (
       SELECT t.* FROM transactions t
       JOIN accounts source ON source.id = t.account_id AND source.is_archived = 0
       LEFT JOIN accounts destination ON destination.id = t.destination_account_id
       WHERE t.destination_account_id IS NULL OR destination.is_archived = 0
     ), effects AS (
       SELECT account_id, amount_cents AS amount_cents FROM visible_transactions
       UNION ALL
       SELECT destination_account_id, -amount_cents FROM visible_transactions WHERE kind = 'transfer'
     )
     SELECT a.id AS account_id, COALESCE(SUM(e.amount_cents), 0) AS balance_cents
     FROM accounts a LEFT JOIN effects e ON e.account_id = a.id
     WHERE a.is_archived = 0
     GROUP BY a.id ORDER BY a.id;`,
  );
  const byAccountId = new Map<EntityId, Cents>();
  let consolidatedCents = 0;
  for (const row of rows) {
    if (!Number.isSafeInteger(row.balance_cents)) throw new Error('Unsafe account balance returned by database.');
    byAccountId.set(row.account_id, row.balance_cents);
    consolidatedCents += row.balance_cents;
  }
  if (!Number.isSafeInteger(consolidatedCents)) throw new Error('Unsafe consolidated balance returned by database.');
  return { byAccountId, consolidatedCents };
}

export async function listCategoryMonthlySpending(db: RepositoryDatabase, month: YearMonth): Promise<readonly CategoryMonthlySpending[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid spending month.');
  const rows = await db.getAllAsync<{ category_id: number; spending_cents: number }>(
    `SELECT t.category_id, -SUM(t.amount_cents) AS spending_cents
     FROM transactions t JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0
     WHERE t.kind = 'expense' AND t.category_id IS NOT NULL
       AND t.transaction_date >= ? AND t.transaction_date < ?
     GROUP BY t.category_id ORDER BY t.category_id;`,
    `${month}-01`, nextMonth(month),
  );
  return rows.map((row) => {
    if (!Number.isSafeInteger(row.spending_cents)) throw new Error('Unsafe category spending returned by database.');
    return { categoryId: row.category_id, spendingCents: row.spending_cents };
  });
}

export async function getConsolidatedBalanceThroughDate(db: RepositoryDatabase, date: CivilDate): Promise<Cents> {
  if (!parseCivilDate(date).ok) throw new Error('Invalid balance date.');
  const row = await db.getFirstAsync<{ balance_cents: number }>(
    `SELECT COALESCE(SUM(CASE WHEN t.kind = 'transfer' THEN 0 ELSE t.amount_cents END), 0) AS balance_cents
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0
     LEFT JOIN accounts d ON d.id = t.destination_account_id
     WHERE (t.destination_account_id IS NULL OR d.is_archived = 0) AND t.transaction_date <= ?;`,
    date,
  );
  const balance = row?.balance_cents ?? 0;
  if (!Number.isSafeInteger(balance)) throw new Error('Unsafe consolidated balance returned by database.');
  return balance;
}

export async function listTransactionsForRecurringOccurrencesMonth(db: RepositoryDatabase, month: YearMonth): Promise<readonly Transaction[]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid occurrence transaction month.');
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT t.${transactionColumns.replaceAll(', ', ', t.')}
     FROM recurring_occurrences o
     JOIN transactions t ON t.id = o.transaction_id
     JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0
     WHERE o.scheduled_date >= ? AND o.scheduled_date < ?
     ORDER BY o.scheduled_date, o.id;`,
    `${month}-01`, nextMonth(month),
  );
  return rows.map(mapTransaction);
}

export async function listCategoryExpensesPage(
  db: RepositoryDatabase,
  categoryId: EntityId,
  month: YearMonth,
  cursor: TransactionPageCursor | null = null,
  limit = 50,
): Promise<TransactionPage> {
  if (!validId(categoryId)) throw new Error('Invalid category id.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Transaction page limit must be between 1 and 100.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid category expense month.');
  if (cursor && (!validId(cursor.id) || !parseCivilDate(cursor.transactionDate).ok)) throw new Error('Invalid category expense cursor.');
  const parameters: (string | number)[] = [categoryId, `${month}-01`, nextMonth(month)];
  const cursorCondition = cursor ? 'AND (t.transaction_date < ? OR (t.transaction_date = ? AND t.id < ?))' : '';
  if (cursor) parameters.push(cursor.transactionDate, cursor.transactionDate, cursor.id);
  parameters.push(limit + 1);
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT t.${transactionColumns.replaceAll(', ', ', t.')}
     FROM transactions t JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0
     WHERE t.kind = 'expense' AND t.category_id = ? AND t.transaction_date >= ? AND t.transaction_date < ? ${cursorCondition}
     ORDER BY t.transaction_date DESC, t.id DESC LIMIT ?;`,
    ...parameters,
  );
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  return { items: pageRows.map(mapTransaction), nextCursor: rows.length > limit && last ? { transactionDate: last.transaction_date, id: last.id } : null };
}

export async function listCategorySpendingByAccount(
  db: RepositoryDatabase,
  categoryId: EntityId,
  endingMonth: YearMonth,
  monthCount = 6,
): Promise<readonly AccountMonthlyCategorySpending[]> {
  if (!validId(categoryId) || !Number.isInteger(monthCount) || monthCount < 1 || monthCount > 24) throw new Error('Invalid category history query.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(endingMonth)) throw new Error('Invalid category history month.');
  const firstMonth = shiftMonth(endingMonth, -(monthCount - 1));
  const rows = await db.getAllAsync<{ account_id: number; month: string; spending_cents: number }>(
    `SELECT t.account_id, substr(t.transaction_date, 1, 7) AS month, -SUM(t.amount_cents) AS spending_cents
     FROM transactions t JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0
     WHERE t.kind = 'expense' AND t.category_id = ? AND t.transaction_date >= ? AND t.transaction_date < ?
     GROUP BY t.account_id, substr(t.transaction_date, 1, 7) ORDER BY month, t.account_id;`,
    categoryId, `${firstMonth}-01`, nextMonth(endingMonth),
  );
  return rows.map((row) => {
    if (!Number.isSafeInteger(row.spending_cents)) throw new Error('Unsafe category history spending returned by database.');
    return { accountId: row.account_id, month: row.month as YearMonth, spendingCents: row.spending_cents };
  });
}

function nextMonth(month: YearMonth): CivilDate {
  const [year, monthNumber] = month.split('-').map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonthNumber = monthNumber === 12 ? 1 : monthNumber + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonthNumber).padStart(2, '0')}-01`;
}

function shiftMonth(month: YearMonth, offset: number): YearMonth {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + monthNumber - 1 + offset;
  const nextYear = Math.floor(index / 12);
  const nextMonthNumber = index % 12 + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonthNumber).padStart(2, '0')}`;
}

export async function findTransactionById(db: RepositoryDatabase, id: number): Promise<Transaction | null> {
  const row = await db.getFirstAsync<TransactionRow>(`SELECT t.${transactionColumns.replaceAll(', ', ', t.')} FROM transactions t JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0 LEFT JOIN accounts d ON d.id = t.destination_account_id WHERE t.id = ? AND (t.destination_account_id IS NULL OR d.is_archived = 0);`, id);
  return row ? mapTransaction(row) : null;
}

export async function updateTransaction(db: RepositoryDatabase, id: number, input: TransactionInput, clock: Clock = systemClock): Promise<Transaction | null> {
  if (!await findTransactionById(db, id)) return null;
  const transaction = normalized(input);
  await assertActiveAccounts(db, transaction.accountId, transaction.destinationAccountId);
  await db.runAsync(
    `UPDATE transactions SET kind = ?, account_id = ?, destination_account_id = ?, category_id = ?, name = ?, description = ?, amount_cents = ?, transaction_date = ?, updated_at = ? WHERE id = ?;`,
    transaction.kind, transaction.accountId, transaction.destinationAccountId, transaction.categoryId, transaction.name, transaction.description, transaction.amountCents, transaction.transactionDate, clock(), id,
  );
  return findTransactionById(db, id);
}
async function assertActiveAccounts(db: RepositoryDatabase, accountId: number, destinationAccountId: number | null): Promise<void> {
  const accounts = await db.getAllAsync<{ id: number }>('SELECT id FROM accounts WHERE is_archived = 0 AND (id = ? OR id = ?);', accountId, destinationAccountId);
  const expected = destinationAccountId === null ? 1 : 2;
  if (accounts.length !== expected) throw new Error('Archived or missing account cannot receive transactions.');
}

export async function deleteTransaction(db: RepositoryDatabase, id: number): Promise<boolean> {
  if (!await findTransactionById(db, id)) return false;
  await db.runAsync('DELETE FROM transactions WHERE id = ?;', id); return true;
}

function normalized(input: TransactionInput): Required<Omit<TransactionInput, 'destinationAccountId' | 'categoryId' | 'description'>> & { destinationAccountId: EntityId | null; categoryId: EntityId | null; description: string | null } {
  const name = validateRequiredText(input.name);
  if (!name.ok || !Number.isSafeInteger(input.amountCents) || !validId(input.accountId) || !parseCivilDate(input.transactionDate).ok) throw new Error('Invalid transaction input.');
  const destinationAccountId = input.destinationAccountId ?? null;
  const categoryId = input.categoryId ?? null;
  if ((destinationAccountId !== null && !validId(destinationAccountId)) || (categoryId !== null && !validId(categoryId))) throw new Error('Invalid transaction relation.');
  switch (input.kind) {
    case 'expense': if (input.amountCents >= 0 || destinationAccountId !== null || categoryId === null) throw new Error('Invalid expense input.'); break;
    case 'income': if (input.amountCents <= 0 || destinationAccountId !== null || categoryId !== null) throw new Error('Invalid income input.'); break;
    case 'transfer': if (input.amountCents >= 0 || categoryId !== null || destinationAccountId === null || destinationAccountId === input.accountId) throw new Error('Invalid transfer input.'); break;
    case 'opening_balance': if (destinationAccountId !== null || categoryId !== null) throw new Error('Invalid opening balance input.'); break;
    default: throw new Error('Invalid transaction kind.');
  }
  return { ...input, name: name.value, description: normalizeOptionalText(input.description), destinationAccountId, categoryId };
}
function validId(value: number): boolean { return Number.isSafeInteger(value) && value > 0; }
