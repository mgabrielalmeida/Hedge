import { isRecurringRuleDueOn, listRecurringRuleDatesDueBy, normalizeOptionalText, parseCivilDate, validateRequiredText } from '@/domain';
import type {
  Cents,
  CivilDate,
  EntityId,
  RecurringOccurrence,
  RecurringRule,
  Transaction,
} from '@/domain';

import {
  type Clock,
  type RepositoryDatabase,
  type RepositorySession,
  systemClock,
} from './database';
import { mapRecurringOccurrence, mapRecurringRule, mapTransaction, type RecurringOccurrenceRow, type RecurringRuleRow, type TransactionRow } from './rows';

const ruleColumns = 'id, kind, account_id, category_id, name, description, amount_cents, frequency, charge_day, charge_month, start_date, end_date, is_active, deleted_at, created_at, updated_at';
const transactionColumns = 'id, kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at';

export type RecurringRuleInput = {
  readonly kind: 'expense' | 'income'; readonly accountId: EntityId; readonly categoryId?: EntityId | null;
  readonly name: string; readonly description?: string | null; readonly amountCents: Cents;
  readonly frequency: 'weekly' | 'monthly' | 'yearly'; readonly chargeDay: number; readonly chargeMonth?: number | null;
  readonly startDate: CivilDate; readonly endDate?: CivilDate | null;
};

export type DueOccurrence = {
  readonly occurrence: RecurringOccurrence;
  readonly transaction: Transaction;
};

export type RecurringProcessingResult = {
  readonly generated: readonly DueOccurrence[];
};

export async function listRecurringRules(db: RepositoryDatabase, activeOnly = false): Promise<readonly RecurringRule[]> {
  const rows = await db.getAllAsync<RecurringRuleRow>(`SELECT r.${ruleColumns.replaceAll(', ', ', r.')} FROM recurring_rules r JOIN accounts a ON a.id = r.account_id AND a.is_archived = 0 WHERE ${activeOnly ? 'r.is_active = 1' : '1 = 1'} ORDER BY r.id DESC;`);
  return rows.map(mapRecurringRule);
}
export async function findRecurringRuleById(db: RepositoryDatabase, id: number): Promise<RecurringRule | null> {
  const row = await db.getFirstAsync<RecurringRuleRow>(`SELECT r.${ruleColumns.replaceAll(', ', ', r.')} FROM recurring_rules r JOIN accounts a ON a.id = r.account_id AND a.is_archived = 0 WHERE r.id = ?;`, id);
  return row ? mapRecurringRule(row) : null;
}
export async function createRecurringRule(db: RepositoryDatabase, input: RecurringRuleInput, clock: Clock = systemClock): Promise<RecurringRule> {
  const rule = normalized(input); const timestamp = clock();
  await assertActiveAccount(db, rule.accountId);
  await db.runAsync(`INSERT INTO recurring_rules (kind, account_id, category_id, name, description, amount_cents, frequency, charge_day, charge_month, start_date, end_date, is_active, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?);`, rule.kind, rule.accountId, rule.categoryId, rule.name, rule.description, rule.amountCents, rule.frequency, rule.chargeDay, rule.chargeMonth, rule.startDate, rule.endDate, timestamp, timestamp);
  const row = await db.getFirstAsync<RecurringRuleRow>(`SELECT ${ruleColumns} FROM recurring_rules WHERE id = last_insert_rowid();`);
  if (!row) throw new Error('Created recurring rule was not found.'); return mapRecurringRule(row);
}
export async function updateRecurringRule(db: RepositoryDatabase, id: number, input: RecurringRuleInput, clock: Clock = systemClock): Promise<RecurringRule | null> {
  const existing = await findRecurringRuleById(db, id);
  if (!existing?.isActive) return null;
  const rule = normalized(input);
  await assertActiveAccount(db, rule.accountId);
  await db.runAsync(`UPDATE recurring_rules SET kind = ?, account_id = ?, category_id = ?, name = ?, description = ?, amount_cents = ?, frequency = ?, charge_day = ?, charge_month = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ? AND is_active = 1;`, rule.kind, rule.accountId, rule.categoryId, rule.name, rule.description, rule.amountCents, rule.frequency, rule.chargeDay, rule.chargeMonth, rule.startDate, rule.endDate, clock(), id);
  return findRecurringRuleById(db, id);
}
export async function deleteRecurringRule(db: RepositoryDatabase, id: number, clock: Clock = systemClock): Promise<boolean> {
  const existing = await findRecurringRuleById(db, id); if (!existing || !existing.isActive) return false;
  const timestamp = clock();
  await db.runAsync('UPDATE recurring_rules SET is_active = 0, deleted_at = ?, updated_at = ? WHERE id = ?;', timestamp, timestamp, id); return true;
}
export async function createDueOccurrence(
  db: RepositoryDatabase,
  ruleId: EntityId,
  scheduledDate: CivilDate,
  clock: Clock = systemClock,
): Promise<DueOccurrence> {
  if (!validId(ruleId) || !parseCivilDate(scheduledDate).ok) throw new Error('Invalid recurring occurrence.');
  let created: DueOccurrence | null = null;
  await db.withExclusiveTransactionAsync(async (session) => {
    const ruleRow = await session.getFirstAsync<RecurringRuleRow>(`SELECT r.${ruleColumns.replaceAll(', ', ', r.')} FROM recurring_rules r JOIN accounts a ON a.id = r.account_id AND a.is_archived = 0 WHERE r.id = ?;`, ruleId);
    if (!ruleRow) throw new Error('Recurring rule was not found.');
    const rule = mapRecurringRule(ruleRow);
    if (!rule.isActive || !isRecurringRuleDueOn(rule, scheduledDate)) throw new Error('Recurring rule is not due.');
    const existingOccurrence = await findOccurrence(session, rule.id, scheduledDate);
    if (existingOccurrence) throw new Error('Recurring occurrence was already processed.');
    created = await insertDueOccurrence(session, rule, scheduledDate, clock());
  });
  if (!created) throw new Error('Recurring occurrence creation did not complete.');
  return created;
}

export async function processDueRecurringRules(
  db: RepositoryDatabase,
  scheduledDate: CivilDate,
  clock: Clock = systemClock,
): Promise<RecurringProcessingResult> {
  if (!parseCivilDate(scheduledDate).ok) throw new Error('Invalid recurring processing date.');

  const generated: DueOccurrence[] = [];
  await db.withExclusiveTransactionAsync(async (session) => {
    const rows = await session.getAllAsync<RecurringRuleRow>(
      `SELECT r.${ruleColumns.replaceAll(', ', ', r.')}
       FROM recurring_rules r
       JOIN accounts a ON a.id = r.account_id AND a.is_archived = 0
       WHERE r.is_active = 1
         AND r.start_date <= ?
         AND (r.end_date IS NULL OR r.end_date >= ?)
       ORDER BY r.id;`,
      scheduledDate,
      scheduledDate,
    );

    for (const row of rows) {
      const rule = mapRecurringRule(row);
      for (const occurrenceDate of listRecurringRuleDatesDueBy(rule, scheduledDate)) {
        if (await findOccurrence(session, rule.id, occurrenceDate)) continue;
        generated.push(await insertDueOccurrence(session, rule, occurrenceDate, clock()));
      }
    }
  });

  return { generated };
}

async function findOccurrence(
  session: RepositorySession,
  ruleId: EntityId,
  scheduledDate: CivilDate,
): Promise<RecurringOccurrence | null> {
  const row = await session.getFirstAsync<RecurringOccurrenceRow>(
    `SELECT id, recurring_rule_id, scheduled_date, transaction_id, created_at
     FROM recurring_occurrences
     WHERE recurring_rule_id = ? AND scheduled_date = ?;`,
    ruleId,
    scheduledDate,
  );
  return row ? mapRecurringOccurrence(row) : null;
}

async function insertDueOccurrence(
  session: RepositorySession,
  rule: RecurringRule,
  scheduledDate: CivilDate,
  timestamp: string,
): Promise<DueOccurrence> {
  await session.runAsync(
    `INSERT INTO transactions (kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?);`,
    rule.kind,
    rule.accountId,
    rule.categoryId,
    rule.name,
    rule.description,
    rule.amountCents,
    scheduledDate,
    timestamp,
    timestamp,
  );
  const transactionRow = await session.getFirstAsync<TransactionRow>(
    `SELECT ${transactionColumns} FROM transactions WHERE id = last_insert_rowid();`,
  );
  if (!transactionRow) throw new Error('Generated transaction was not found.');
  const transaction = mapTransaction(transactionRow);

  await session.runAsync(
    'INSERT INTO recurring_occurrences (recurring_rule_id, scheduled_date, transaction_id, created_at) VALUES (?, ?, ?, ?);',
    rule.id,
    scheduledDate,
    transaction.id,
    timestamp,
  );
  const occurrenceRow = await session.getFirstAsync<RecurringOccurrenceRow>(
    'SELECT id, recurring_rule_id, scheduled_date, transaction_id, created_at FROM recurring_occurrences WHERE id = last_insert_rowid();',
  );
  if (!occurrenceRow) throw new Error('Generated recurring occurrence was not found.');

  return { occurrence: mapRecurringOccurrence(occurrenceRow), transaction };
}
function normalized(input: RecurringRuleInput): Required<Omit<RecurringRuleInput, 'categoryId' | 'description' | 'chargeMonth' | 'endDate'>> & { categoryId: EntityId | null; description: string | null; chargeMonth: number | null; endDate: CivilDate | null } {
  const name = validateRequiredText(input.name); const categoryId = input.categoryId ?? null; const chargeMonth = input.chargeMonth ?? null; const endDate = input.endDate ?? null;
  if (!name.ok || !validId(input.accountId) || !Number.isSafeInteger(input.amountCents) || !parseCivilDate(input.startDate).ok || (endDate !== null && !parseCivilDate(endDate).ok) || (categoryId !== null && !validId(categoryId))) throw new Error('Invalid recurring rule input.');
  if (endDate !== null && endDate < input.startDate) throw new Error('Invalid recurring rule date range.');
  if (input.kind === 'expense' ? input.amountCents >= 0 || categoryId === null : input.amountCents <= 0 || categoryId !== null) throw new Error('Invalid recurring rule amount or category.');
  if ((input.frequency === 'weekly' && (input.chargeDay < 1 || input.chargeDay > 7 || chargeMonth !== null)) || (input.frequency === 'monthly' && (input.chargeDay < 1 || input.chargeDay > 31 || chargeMonth !== null)) || (input.frequency === 'yearly' && (input.chargeDay < 1 || input.chargeDay > 31 || chargeMonth === null || chargeMonth < 1 || chargeMonth > 12))) throw new Error('Invalid recurring schedule.');
  return { ...input, name: name.value, description: normalizeOptionalText(input.description), categoryId, chargeMonth, endDate };
}
function validId(value: number): boolean { return Number.isSafeInteger(value) && value > 0; }

async function assertActiveAccount(db: RepositoryDatabase, accountId: number): Promise<void> {
  const account = await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE id = ? AND is_archived = 0;', accountId);
  if (!account) throw new Error('Archived or missing account cannot receive recurring rules.');
}
