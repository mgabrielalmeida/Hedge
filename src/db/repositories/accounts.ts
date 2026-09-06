import { normalizeOptionalText, parseCivilDate, validateRequiredText } from '@/domain';
import type { Account, Cents, CivilDate } from '@/domain';

import { type Clock, type RepositoryDatabase, systemClock } from './database';
import { mapAccount, type AccountRow } from './rows';

const accountColumns = 'id, name, institution_name, icon_value, color_value, created_at, updated_at';

export type CreateAccountInput = {
  readonly name: string;
  readonly institutionName: string;
  readonly iconValue: string;
  readonly colorValue: string;
  readonly initialBalanceCents: Cents;
  readonly openingBalanceDate: CivilDate;
  readonly openingBalanceDescription?: string | null;
};

export type UpdateAccountInput = Omit<CreateAccountInput, 'initialBalanceCents' | 'openingBalanceDate' | 'openingBalanceDescription'>;

export async function createAccount(db: RepositoryDatabase, input: CreateAccountInput, clock: Clock = systemClock): Promise<Account> {
  const name = required(input.name, 'account name');
  const institutionName = required(input.institutionName, 'institution name');
  const iconValue = required(input.iconValue, 'account icon value');
  const colorValue = required(input.colorValue, 'account color value');
  if (!Number.isSafeInteger(input.initialBalanceCents)) throw new Error('Invalid opening balance.');
  if (!parseCivilDate(input.openingBalanceDate).ok) throw new Error('Invalid opening balance date.');
  const description = normalizeOptionalText(input.openingBalanceDescription);
  const timestamp = clock();
  let account: Account | null = null;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'INSERT INTO accounts (name, institution_name, visual_type, visual_value, icon_value, color_value, created_at, updated_at) VALUES (?, ?, \'icon\', ?, ?, ?, ?, ?);',
      name, institutionName, iconValue, iconValue, colorValue, timestamp, timestamp,
    );
    const row = await transaction.getFirstAsync<AccountRow>(`SELECT ${accountColumns} FROM accounts WHERE id = last_insert_rowid();`);
    if (!row) throw new Error('Created account was not found.');
    account = mapAccount(row);
    await transaction.runAsync(
      `INSERT INTO transactions (kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at)
       VALUES ('opening_balance', ?, NULL, NULL, ?, ?, ?, ?, ?, ?);`,
      account.id, 'Saldo inicial', description, input.initialBalanceCents, input.openingBalanceDate, timestamp, timestamp,
    );
  });
  if (!account) throw new Error('Account creation did not complete.');
  return account;
}

export async function listAccounts(db: RepositoryDatabase): Promise<readonly Account[]> {
  const rows = await db.getAllAsync<AccountRow>(`SELECT ${accountColumns} FROM accounts ORDER BY id ASC;`);
  return rows.map(mapAccount);
}

export async function findAccountById(db: RepositoryDatabase, id: number): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>(`SELECT ${accountColumns} FROM accounts WHERE id = ?;`, id);
  return row ? mapAccount(row) : null;
}

export async function updateAccount(db: RepositoryDatabase, id: number, input: UpdateAccountInput, clock: Clock = systemClock): Promise<Account | null> {
  const name = required(input.name, 'account name');
  const institutionName = required(input.institutionName, 'institution name');
  const iconValue = required(input.iconValue, 'account icon value');
  const colorValue = required(input.colorValue, 'account color value');
  await db.runAsync('UPDATE accounts SET name = ?, institution_name = ?, visual_type = \'icon\', visual_value = ?, icon_value = ?, color_value = ?, updated_at = ? WHERE id = ?;', name, institutionName, iconValue, iconValue, colorValue, clock(), id);
  return findAccountById(db, id);
}

function required(value: string, label: string): string {
  const result = validateRequiredText(value);
  if (!result.ok) throw new Error(`Invalid ${label}.`);
  return result.value;
}
