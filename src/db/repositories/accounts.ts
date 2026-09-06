import { addCents, assertSafeCents, normalizeOptionalText, parseCivilDate, validateRequiredText } from '@/domain';
import type { Account, Cents, CivilDate, ThemeColorIndex } from '@/domain';

import { type Clock, type RepositoryDatabase, type RepositorySession, systemClock } from './database';
import { mapAccount, type AccountRow } from './rows';

const accountColumns = 'id, name, institution_name, icon_value, color_value, theme_color_index, created_at, updated_at';

export type CreateAccountInput = {
  readonly name: string;
  readonly institutionName: string;
  readonly iconValue: string;
  readonly colorValue: string;
  readonly themeColorIndex?: ThemeColorIndex | null;
  readonly initialBalanceCents: Cents;
  readonly openingBalanceDate: CivilDate;
  readonly openingBalanceDescription?: string | null;
};

export type UpdateAccountInput = Omit<CreateAccountInput, 'initialBalanceCents' | 'openingBalanceDate' | 'openingBalanceDescription'>;

export type UpdateAccountWithBalanceInput = UpdateAccountInput & {
  readonly currentBalanceCents: Cents;
  readonly adjustmentDate: CivilDate;
};

type BalanceRow = { balance_cents: number };

export async function createAccount(db: RepositoryDatabase, input: CreateAccountInput, clock: Clock = systemClock): Promise<Account> {
  const name = required(input.name, 'account name');
  const institutionName = required(input.institutionName, 'institution name');
  const iconValue = required(input.iconValue, 'account icon value');
  const colorValue = required(input.colorValue, 'account color value');
  const themeColorIndex = input.themeColorIndex ?? null;
  validateThemeColorIndex(themeColorIndex);
  if (!Number.isSafeInteger(input.initialBalanceCents)) throw new Error('Invalid opening balance.');
  if (!parseCivilDate(input.openingBalanceDate).ok) throw new Error('Invalid opening balance date.');
  const description = normalizeOptionalText(input.openingBalanceDescription);
  const timestamp = clock();
  let account: Account | null = null;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'INSERT INTO accounts (name, institution_name, visual_type, visual_value, icon_value, color_value, theme_color_index, created_at, updated_at) VALUES (?, ?, \'icon\', ?, ?, ?, ?, ?, ?);',
      name, institutionName, iconValue, iconValue, colorValue, themeColorIndex, timestamp, timestamp,
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

export async function getAccountBalance(db: RepositoryDatabase, id: number): Promise<Cents | null> {
  if (!await findAccountById(db, id)) return null;
  return readAccountBalance(db, id);
}

export async function updateAccount(db: RepositoryDatabase, id: number, input: UpdateAccountInput, clock: Clock = systemClock): Promise<Account | null> {
  const name = required(input.name, 'account name');
  const institutionName = required(input.institutionName, 'institution name');
  const iconValue = required(input.iconValue, 'account icon value');
  const colorValue = required(input.colorValue, 'account color value');
  const themeColorIndex = input.themeColorIndex ?? null;
  validateThemeColorIndex(themeColorIndex);
  await db.runAsync('UPDATE accounts SET name = ?, institution_name = ?, visual_type = \'icon\', visual_value = ?, icon_value = ?, color_value = ?, theme_color_index = ?, updated_at = ? WHERE id = ?;', name, institutionName, iconValue, iconValue, colorValue, themeColorIndex, clock(), id);
  return findAccountById(db, id);
}

export async function updateAccountWithBalance(
  db: RepositoryDatabase,
  id: number,
  input: UpdateAccountWithBalanceInput,
  clock: Clock = systemClock,
): Promise<Account | null> {
  const name = required(input.name, 'account name');
  const institutionName = required(input.institutionName, 'institution name');
  const iconValue = required(input.iconValue, 'account icon value');
  const colorValue = required(input.colorValue, 'account color value');
  const themeColorIndex = input.themeColorIndex ?? null;
  validateThemeColorIndex(themeColorIndex);
  assertSafeCents(input.currentBalanceCents);
  if (!parseCivilDate(input.adjustmentDate).ok) throw new Error('Invalid balance adjustment date.');

  const timestamp = clock();
  let account: Account | null = null;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<AccountRow>(
      `SELECT ${accountColumns} FROM accounts WHERE id = ?;`,
      id,
    );
    if (!existing) return;

    const previousBalanceCents = await readAccountBalance(transaction, id);
    const differenceCents = addCents(input.currentBalanceCents, -previousBalanceCents);

    await transaction.runAsync(
      `UPDATE accounts
       SET name = ?, institution_name = ?, visual_type = 'icon', visual_value = ?, icon_value = ?,
           color_value = ?, theme_color_index = ?, updated_at = ?
       WHERE id = ?;`,
      name, institutionName, iconValue, iconValue, colorValue, themeColorIndex, timestamp, id,
    );

    if (differenceCents !== 0) {
      await transaction.runAsync(
        `INSERT INTO transactions
          (kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at)
         VALUES (?, ?, NULL, NULL, 'Retífica de saldo', NULL, ?, ?, ?, ?);`,
        differenceCents > 0 ? 'income' : 'expense',
        id,
        differenceCents,
        input.adjustmentDate,
        timestamp,
        timestamp,
      );
    }

    const updated = await transaction.getFirstAsync<AccountRow>(
      `SELECT ${accountColumns} FROM accounts WHERE id = ?;`,
      id,
    );
    if (!updated) throw new Error('Updated account was not found.');
    account = mapAccount(updated);
  });
  return account;
}

async function readAccountBalance(db: RepositorySession, id: number): Promise<Cents> {
  const row = await db.getFirstAsync<BalanceRow>(
    `SELECT COALESCE(SUM(
       CASE
         WHEN account_id = ? THEN amount_cents
         WHEN kind = 'transfer' AND destination_account_id = ? THEN -amount_cents
         ELSE 0
       END
     ), 0) AS balance_cents
     FROM transactions
     WHERE account_id = ? OR destination_account_id = ?;`,
    id, id, id, id,
  );
  const balance = row?.balance_cents ?? 0;
  assertSafeCents(balance);
  return balance;
}

function required(value: string, label: string): string {
  const result = validateRequiredText(value);
  if (!result.ok) throw new Error(`Invalid ${label}.`);
  return result.value;
}

function validateThemeColorIndex(value: ThemeColorIndex | null): void {
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > 4)) throw new Error('Invalid account theme color index.');
}
