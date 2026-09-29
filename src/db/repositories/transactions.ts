import { normalizeOptionalText, parseCivilDate, validateRequiredText } from '@/domain';
import type { Cents, CivilDate, EntityId, Transaction } from '@/domain';

import { type Clock, type RepositoryDatabase, systemClock } from './database';
import { mapTransaction, type TransactionRow } from './rows';

const transactionColumns = 'id, kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at';
const HISTORY_PAGE_SIZE = 50;

export type TransactionHistoryKind = 'transactions' | 'transfers';

export type TransactionPageCursor = {
  readonly id: EntityId;
  readonly transactionDate: CivilDate;
};

export type TransactionPage = {
  readonly items: readonly Transaction[];
  readonly nextCursor: TransactionPageCursor | null;
};

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

export async function createTransaction(db: RepositoryDatabase, input: TransactionInput, clock: Clock = systemClock): Promise<Transaction> {
  const transaction = normalized(input); const timestamp = clock();
  await assertActiveAccounts(db, transaction.accountId, transaction.destinationAccountId);
  await db.runAsync(
    `INSERT INTO transactions (kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    transaction.kind, transaction.accountId, transaction.destinationAccountId, transaction.categoryId, transaction.name, transaction.description, transaction.amountCents, transaction.transactionDate, timestamp, timestamp,
  );
  const row = await db.getFirstAsync<TransactionRow>(`SELECT ${transactionColumns} FROM transactions WHERE id = last_insert_rowid();`);
  if (!row) throw new Error('Created transaction was not found.'); return mapTransaction(row);
}

export async function listTransactions(db: RepositoryDatabase): Promise<readonly Transaction[]> {
  const rows = await db.getAllAsync<TransactionRow>(`SELECT t.${transactionColumns.replaceAll(', ', ', t.')} FROM transactions t JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0 LEFT JOIN accounts d ON d.id = t.destination_account_id WHERE t.destination_account_id IS NULL OR d.is_archived = 0 ORDER BY t.transaction_date DESC, t.id DESC;`);
  return rows.map(mapTransaction);
}

export async function listTransactionPage(
  db: RepositoryDatabase,
  options: {
    readonly accountId: EntityId | null;
    readonly cursor?: TransactionPageCursor | null;
    readonly historyKind: TransactionHistoryKind;
    readonly month: string;
  },
): Promise<TransactionPage> {
  const monthStart = `${options.month}-01`;
  if (!parseCivilDate(monthStart).ok) throw new Error('Invalid transaction history month.');
  const [year, month] = options.month.split('-').map(Number);
  const nextMonth = month === 12
    ? `${String(year + 1).padStart(4, '0')}-01-01`
    : `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-01`;
  const kindClause = options.historyKind === 'transfers'
    ? "t.kind = 'transfer'"
    : "t.kind IN ('expense', 'income')";
  const accountClause = options.accountId === null
    ? ''
    : 'AND (t.account_id = ? OR t.destination_account_id = ?)';
  const cursorClause = options.cursor === undefined || options.cursor === null
    ? ''
    : 'AND (t.transaction_date < ? OR (t.transaction_date = ? AND t.id < ?))';
  const parameters: (string | number)[] = [monthStart, nextMonth];
  if (options.accountId !== null) parameters.push(options.accountId, options.accountId);
  if (options.cursor !== undefined && options.cursor !== null) {
    parameters.push(options.cursor.transactionDate, options.cursor.transactionDate, options.cursor.id);
  }
  parameters.push(HISTORY_PAGE_SIZE + 1);

  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT t.${transactionColumns.replaceAll(', ', ', t.')}
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id AND a.is_archived = 0
     LEFT JOIN accounts d ON d.id = t.destination_account_id
     WHERE (t.destination_account_id IS NULL OR d.is_archived = 0)
       AND t.transaction_date >= ? AND t.transaction_date < ?
       AND ${kindClause}
       ${accountClause}
       ${cursorClause}
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT ?;`,
    ...parameters,
  );
  const hasMore = rows.length > HISTORY_PAGE_SIZE;
  const items = rows.slice(0, HISTORY_PAGE_SIZE).map(mapTransaction);
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? { id: last.id, transactionDate: last.transactionDate } : null,
  };
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
