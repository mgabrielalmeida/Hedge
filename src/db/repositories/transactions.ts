import { normalizeOptionalText, parseCivilDate, validateRequiredText } from '@/domain';
import type { Cents, CivilDate, EntityId, Transaction } from '@/domain';

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

export async function createTransaction(db: RepositoryDatabase, input: TransactionInput, clock: Clock = systemClock): Promise<Transaction> {
  const transaction = normalized(input); const timestamp = clock();
  await db.runAsync(
    `INSERT INTO transactions (kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    transaction.kind, transaction.accountId, transaction.destinationAccountId, transaction.categoryId, transaction.name, transaction.description, transaction.amountCents, transaction.transactionDate, timestamp, timestamp,
  );
  const row = await db.getFirstAsync<TransactionRow>(`SELECT ${transactionColumns} FROM transactions WHERE id = last_insert_rowid();`);
  if (!row) throw new Error('Created transaction was not found.'); return mapTransaction(row);
}

export async function listTransactions(db: RepositoryDatabase): Promise<readonly Transaction[]> {
  const rows = await db.getAllAsync<TransactionRow>(`SELECT ${transactionColumns} FROM transactions ORDER BY transaction_date DESC, id DESC;`);
  return rows.map(mapTransaction);
}

export async function findTransactionById(db: RepositoryDatabase, id: number): Promise<Transaction | null> {
  const row = await db.getFirstAsync<TransactionRow>(`SELECT ${transactionColumns} FROM transactions WHERE id = ?;`, id);
  return row ? mapTransaction(row) : null;
}

export async function updateTransaction(db: RepositoryDatabase, id: number, input: TransactionInput, clock: Clock = systemClock): Promise<Transaction | null> {
  const transaction = normalized(input);
  await db.runAsync(
    `UPDATE transactions SET kind = ?, account_id = ?, destination_account_id = ?, category_id = ?, name = ?, description = ?, amount_cents = ?, transaction_date = ?, updated_at = ? WHERE id = ?;`,
    transaction.kind, transaction.accountId, transaction.destinationAccountId, transaction.categoryId, transaction.name, transaction.description, transaction.amountCents, transaction.transactionDate, clock(), id,
  );
  return findTransactionById(db, id);
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
