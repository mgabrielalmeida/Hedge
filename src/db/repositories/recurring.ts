import { isRecurringRuleDueOn, normalizeOptionalText, parseCivilDate, validateRequiredText } from '@/domain';
import type { Cents, CivilDate, EntityId, RecurringRule } from '@/domain';

import { type Clock, type RepositoryDatabase, systemClock } from './database';
import { mapRecurringOccurrence, mapRecurringRule, mapTransaction, type RecurringOccurrenceRow, type RecurringRuleRow, type TransactionRow } from './rows';

const ruleColumns = 'id, kind, account_id, category_id, name, description, amount_cents, frequency, charge_day, charge_month, start_date, end_date, is_active, deleted_at, created_at, updated_at';
const transactionColumns = 'id, kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at';

export type RecurringRuleInput = {
  readonly kind: 'expense' | 'income'; readonly accountId: EntityId; readonly categoryId?: EntityId | null;
  readonly name: string; readonly description?: string | null; readonly amountCents: Cents;
  readonly frequency: 'weekly' | 'monthly' | 'yearly'; readonly chargeDay: number; readonly chargeMonth?: number | null;
  readonly startDate: CivilDate; readonly endDate?: CivilDate | null;
};

export async function listRecurringRules(db: RepositoryDatabase, activeOnly = false): Promise<readonly RecurringRule[]> {
  const rows = await db.getAllAsync<RecurringRuleRow>(`SELECT ${ruleColumns} FROM recurring_rules ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY id DESC;`);
  return rows.map(mapRecurringRule);
}
export async function findRecurringRuleById(db: RepositoryDatabase, id: number): Promise<RecurringRule | null> {
  const row = await db.getFirstAsync<RecurringRuleRow>(`SELECT ${ruleColumns} FROM recurring_rules WHERE id = ?;`, id);
  return row ? mapRecurringRule(row) : null;
}
export async function createRecurringRule(db: RepositoryDatabase, input: RecurringRuleInput, clock: Clock = systemClock): Promise<RecurringRule> {
  const rule = normalized(input); const timestamp = clock();
  await db.runAsync(`INSERT INTO recurring_rules (kind, account_id, category_id, name, description, amount_cents, frequency, charge_day, charge_month, start_date, end_date, is_active, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?);`, rule.kind, rule.accountId, rule.categoryId, rule.name, rule.description, rule.amountCents, rule.frequency, rule.chargeDay, rule.chargeMonth, rule.startDate, rule.endDate, timestamp, timestamp);
  const row = await db.getFirstAsync<RecurringRuleRow>(`SELECT ${ruleColumns} FROM recurring_rules WHERE id = last_insert_rowid();`);
  if (!row) throw new Error('Created recurring rule was not found.'); return mapRecurringRule(row);
}
export async function updateRecurringRule(db: RepositoryDatabase, id: number, input: RecurringRuleInput, clock: Clock = systemClock): Promise<RecurringRule | null> {
  const rule = normalized(input);
  await db.runAsync(`UPDATE recurring_rules SET kind = ?, account_id = ?, category_id = ?, name = ?, description = ?, amount_cents = ?, frequency = ?, charge_day = ?, charge_month = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ? AND is_active = 1;`, rule.kind, rule.accountId, rule.categoryId, rule.name, rule.description, rule.amountCents, rule.frequency, rule.chargeDay, rule.chargeMonth, rule.startDate, rule.endDate, clock(), id);
  return findRecurringRuleById(db, id);
}
export async function deleteRecurringRule(db: RepositoryDatabase, id: number, clock: Clock = systemClock): Promise<boolean> {
  const existing = await findRecurringRuleById(db, id); if (!existing || !existing.isActive) return false;
  const timestamp = clock();
  await db.runAsync('UPDATE recurring_rules SET is_active = 0, deleted_at = ?, updated_at = ? WHERE id = ?;', timestamp, timestamp, id); return true;
}
export async function createDueOccurrence(db: RepositoryDatabase, ruleId: EntityId, scheduledDate: CivilDate, clock: Clock = systemClock) {
  if (!validId(ruleId) || !parseCivilDate(scheduledDate).ok) throw new Error('Invalid recurring occurrence.');
  const timestamp = clock(); let generatedTransaction: ReturnType<typeof mapTransaction> | null = null; let occurrence: ReturnType<typeof mapRecurringOccurrence> | null = null;
  await db.withExclusiveTransactionAsync(async (session) => {
    const ruleRow = await session.getFirstAsync<RecurringRuleRow>(`SELECT ${ruleColumns} FROM recurring_rules WHERE id = ?;`, ruleId);
    if (!ruleRow) throw new Error('Recurring rule was not found.');
    const rule = mapRecurringRule(ruleRow);
    if (!rule.isActive || !isRecurringRuleDueOn(rule, scheduledDate)) throw new Error('Recurring rule is not due.');
    await session.runAsync(`INSERT INTO transactions (kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?);`, rule.kind, rule.accountId, rule.categoryId, rule.name, rule.description, rule.amountCents, scheduledDate, timestamp, timestamp);
    const transactionRow = await session.getFirstAsync<TransactionRow>(`SELECT ${transactionColumns} FROM transactions WHERE id = last_insert_rowid();`);
    if (!transactionRow) throw new Error('Generated transaction was not found.'); generatedTransaction = mapTransaction(transactionRow);
    await session.runAsync('INSERT INTO recurring_occurrences (recurring_rule_id, scheduled_date, transaction_id, created_at) VALUES (?, ?, ?, ?);', rule.id, scheduledDate, generatedTransaction.id, timestamp);
    const occurrenceRow = await session.getFirstAsync<RecurringOccurrenceRow>('SELECT id, recurring_rule_id, scheduled_date, transaction_id, created_at FROM recurring_occurrences WHERE id = last_insert_rowid();');
    if (!occurrenceRow) throw new Error('Generated recurring occurrence was not found.'); occurrence = mapRecurringOccurrence(occurrenceRow);
  });
  if (!generatedTransaction || !occurrence) throw new Error('Recurring occurrence creation did not complete.');
  return { occurrence, transaction: generatedTransaction };
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
