import { addCents, assertSafeCents, normalizeOptionalText, parseCivilDate, validateRequiredText } from '@/domain';
import type { Account, Cents, CivilDate, ThemeColorIndex } from '@/domain';

import { type Clock, type RepositoryDatabase, type RepositorySession, systemClock } from './database';
import { enqueueFinancialAccountMutations } from './financialVersions';
import { mapAccount, type AccountRow } from './rows';
import { enqueueEntityMutation } from '../sync/outbox';

const accountColumns = 'id, name, institution_name, icon_value, color_value, theme_color_index, is_archived, archived_at, financial_version, created_at, updated_at';

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
  readonly expectedFinancialVersion: number;
};

export class StaleBalanceAdjustmentError extends Error {
  public constructor() {
    super('Account balance changed after it was loaded.');
    this.name = 'StaleBalanceAdjustmentError';
  }
}

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
    const row = await transaction.getFirstAsync<AccountRow>(
      `INSERT INTO accounts (name, institution_name, visual_type, visual_value, icon_value, color_value, theme_color_index, created_at, updated_at)
       VALUES (?, ?, 'icon', ?, ?, ?, ?, ?, ?)
       RETURNING ${accountColumns};`,
      name, institutionName, iconValue, iconValue, colorValue, themeColorIndex, timestamp, timestamp,
    );
    if (!row) throw new Error('Created account was not found.');
    account = mapAccount(row);
    await enqueueEntityMutation(transaction, 'account', account.id, timestamp);
    const openingBalance = await transaction.getFirstAsync<{ id: number }>(
      `INSERT INTO transactions (kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at)
       VALUES ('opening_balance', ?, NULL, NULL, ?, ?, ?, ?, ?, ?) RETURNING id;`,
      account.id, 'Saldo inicial', description, input.initialBalanceCents, input.openingBalanceDate, timestamp, timestamp,
    );
    if (!openingBalance) throw new Error('Opening balance was not found.');
    await enqueueFinancialAccountMutations(transaction, [account.id], timestamp);
    await enqueueEntityMutation(transaction, 'transaction', openingBalance.id, timestamp);
    const updatedAccount = await transaction.getFirstAsync<AccountRow>(
      `SELECT ${accountColumns} FROM accounts WHERE id = ?;`,
      account.id,
    );
    if (!updatedAccount) throw new Error('Created account was not found after opening balance.');
    account = mapAccount(updatedAccount);
  });
  if (!account) throw new Error('Account creation did not complete.');
  return account;
}

export async function listAccounts(db: RepositoryDatabase): Promise<readonly Account[]> {
  const rows = await db.getAllAsync<AccountRow>(`SELECT ${accountColumns} FROM accounts WHERE is_archived = 0 AND deleted_at IS NULL ORDER BY id ASC;`);
  return rows.map(mapAccount);
}

export async function findAccountById(db: RepositoryDatabase, id: number): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>(`SELECT ${accountColumns} FROM accounts WHERE id = ? AND is_archived = 0 AND deleted_at IS NULL;`, id);
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
  const timestamp = clock();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE id = ? AND is_archived = 0 AND deleted_at IS NULL;', id);
    if (!existing) return;
    await transaction.runAsync('UPDATE accounts SET name = ?, institution_name = ?, visual_type = \'icon\', visual_value = ?, icon_value = ?, color_value = ?, theme_color_index = ?, updated_at = ? WHERE id = ?;', name, institutionName, iconValue, iconValue, colorValue, themeColorIndex, timestamp, id);
    await enqueueEntityMutation(transaction, 'account', id, timestamp);
  });
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
  if (!Number.isSafeInteger(input.expectedFinancialVersion) || input.expectedFinancialVersion < 0) {
    throw new Error('Invalid expected financial version.');
  }
  if (!parseCivilDate(input.adjustmentDate).ok) throw new Error('Invalid balance adjustment date.');

  const timestamp = clock();
  let account: Account | null = null;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<AccountRow>(
      `SELECT ${accountColumns} FROM accounts WHERE id = ? AND is_archived = 0 AND deleted_at IS NULL;`,
      id,
    );
    if (!existing) return;
    if (existing.financial_version !== input.expectedFinancialVersion) {
      throw new StaleBalanceAdjustmentError();
    }

    const previousBalanceCents = await readAccountBalance(transaction, id);
    const differenceCents = addCents(input.currentBalanceCents, -previousBalanceCents);

    await transaction.runAsync(
      `UPDATE accounts
       SET name = ?, institution_name = ?, visual_type = 'icon', visual_value = ?, icon_value = ?,
           color_value = ?, theme_color_index = ?, updated_at = ?
       WHERE id = ? AND is_archived = 0 AND deleted_at IS NULL;`,
      name, institutionName, iconValue, iconValue, colorValue, themeColorIndex, timestamp, id,
    );
    await enqueueEntityMutation(transaction, 'account', id, timestamp);

    if (differenceCents !== 0) {
      const adjustment = await transaction.getFirstAsync<{ id: number }>(
        `INSERT INTO transactions
          (kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at)
         VALUES (?, ?, NULL, NULL, 'Retífica de saldo', NULL, ?, ?, ?, ?) RETURNING id;`,
        differenceCents > 0 ? 'income' : 'expense',
        id,
        differenceCents,
        input.adjustmentDate,
        timestamp,
        timestamp,
      );
      if (!adjustment) throw new Error('Balance adjustment was not found.');
      await enqueueFinancialAccountMutations(transaction, [id], timestamp);
      await enqueueEntityMutation(transaction, 'transaction', adjustment.id, timestamp);
    }

    const updated = await transaction.getFirstAsync<AccountRow>(
      `SELECT ${accountColumns} FROM accounts WHERE id = ? AND is_archived = 0 AND deleted_at IS NULL;`,
      id,
    );
    if (!updated) throw new Error('Updated account was not found.');
    account = mapAccount(updated);
  });
  return account;
}

export async function archiveAccount(db: RepositoryDatabase, id: number, clock: Clock = systemClock): Promise<boolean> {
  const timestamp = clock();
  let archived = false;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<{ id: number }>(
      'SELECT id FROM accounts WHERE id = ? AND is_archived = 0 AND deleted_at IS NULL;',
      id,
    );
    if (!existing) return;
    await transaction.runAsync(
      'UPDATE accounts SET is_archived = 1, archived_at = ?, updated_at = ? WHERE id = ?;',
      timestamp, timestamp, id,
    );
    await enqueueEntityMutation(transaction, 'account', id, timestamp);
    const rules = await transaction.getAllAsync<{ id: number }>(
      'SELECT id FROM recurring_rules WHERE account_id = ? AND is_active = 1;', id,
    );
    await transaction.runAsync(
      'UPDATE recurring_rules SET is_active = 0, deleted_at = ?, updated_at = ? WHERE account_id = ? AND is_active = 1;',
      timestamp, timestamp, id,
    );
    for (const rule of rules) await enqueueEntityMutation(transaction, 'recurring_rule', rule.id, timestamp);
    archived = true;
  });
  return archived;
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
     WHERE deleted_at IS NULL AND (account_id = ? OR destination_account_id = ?);`,
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
