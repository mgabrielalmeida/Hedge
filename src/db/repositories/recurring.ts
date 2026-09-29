import { isRecurringRuleDueOn, listRecurringRuleDatesDueBy, normalizeOptionalText, parseCivilDate, validateRequiredText } from '@/domain';
import type {
  Cents,
  CivilDate,
  EntityId,
  RecurringOccurrence,
  RecurringRule,
  Transaction,
  YearMonth,
} from '@/domain';
import { recurringOccurrenceSyncId, recurringTransactionSyncId } from '@/domain/sync/recurrenceIdentity';
import { getCivilDateInTimeZone, isValidTimeZone } from '@/utils/financialTimeZone';

import {
  type Clock,
  type RepositoryDatabase,
  type RepositorySession,
  systemClock,
} from './database';
import { enqueueFinancialAccountMutations } from './financialVersions';
import { mapRecurringOccurrence, mapRecurringRule, mapTransaction, type RecurringOccurrenceRow, type RecurringRuleRow, type TransactionRow } from './rows';
import { enqueueEntityMutation } from '../sync/outbox';

const ruleColumns = 'id, kind, account_id, category_id, name, description, amount_cents, frequency, charge_day, charge_month, start_date, end_date, is_active, deleted_at, created_at, updated_at';
const transactionColumns = 'id, kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at';
type SyncRecurringRuleRow = RecurringRuleRow & { sync_id: string };

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
  readonly affectedAccountIds: readonly EntityId[];
  readonly affectedCategoryIds: readonly EntityId[];
  readonly generated: readonly DueOccurrence[];
};

export async function listRecurringRules(db: RepositoryDatabase, activeOnly = false): Promise<readonly RecurringRule[]> {
  const rows = await db.getAllAsync<RecurringRuleRow>(`SELECT r.${ruleColumns.replaceAll(', ', ', r.')} FROM recurring_rules r JOIN accounts a ON a.id = r.account_id AND a.is_archived = 0 AND a.deleted_at IS NULL WHERE ${activeOnly ? 'r.is_active = 1 AND r.deleted_at IS NULL' : '1 = 1'} ORDER BY r.id DESC;`);
  return rows.map(mapRecurringRule);
}
export async function listRecurringOccurrencesForMonth(
  db: RepositoryDatabase,
  month: YearMonth,
): Promise<readonly RecurringOccurrence[]> {
  if (!parseCivilDate(`${month}-01`).ok) throw new Error('Invalid year month.');
  const [year, monthNumber] = month.split('-').map(Number);
  const nextMonth = monthNumber === 12
    ? `${String(year + 1).padStart(4, '0')}-01-01`
    : `${String(year).padStart(4, '0')}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  const rows = await db.getAllAsync<RecurringOccurrenceRow>(
    'SELECT id, recurring_rule_id, scheduled_date, transaction_id, created_at FROM recurring_occurrences WHERE deleted_at IS NULL AND scheduled_date >= ? AND scheduled_date < ? ORDER BY scheduled_date, id;',
    `${month}-01`,
    nextMonth,
  );
  return rows.map(mapRecurringOccurrence);
}
export async function findRecurringRuleById(db: RepositoryDatabase, id: number): Promise<RecurringRule | null> {
  const row = await db.getFirstAsync<RecurringRuleRow>(`SELECT r.${ruleColumns.replaceAll(', ', ', r.')} FROM recurring_rules r JOIN accounts a ON a.id = r.account_id AND a.is_archived = 0 AND a.deleted_at IS NULL WHERE r.id = ?;`, id);
  return row ? mapRecurringRule(row) : null;
}
export async function createRecurringRule(db: RepositoryDatabase, input: RecurringRuleInput, clock: Clock = systemClock): Promise<RecurringRule> {
  const rule = normalized(input); const timestamp = clock();
  await assertActiveAccount(db, rule.accountId);
  let created: RecurringRule | null = null;
  await db.withExclusiveTransactionAsync(async (session) => {
    const row = await session.getFirstAsync<RecurringRuleRow>(`INSERT INTO recurring_rules (kind, account_id, category_id, name, description, amount_cents, frequency, charge_day, charge_month, start_date, end_date, is_active, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?) RETURNING ${ruleColumns};`, rule.kind, rule.accountId, rule.categoryId, rule.name, rule.description, rule.amountCents, rule.frequency, rule.chargeDay, rule.chargeMonth, rule.startDate, rule.endDate, timestamp, timestamp);
    if (!row) throw new Error('Created recurring rule was not found.');
    created = mapRecurringRule(row);
    await enqueueEntityMutation(session, 'recurring_rule', row.id, timestamp);
  });
  if (!created) throw new Error('Recurring rule creation did not complete.');
  return created;
}
export async function updateRecurringRule(db: RepositoryDatabase, id: number, input: RecurringRuleInput, clock: Clock = systemClock): Promise<RecurringRule | null> {
  const existing = await findRecurringRuleById(db, id);
  if (!existing?.isActive) return null;
  const rule = normalized(input);
  await assertActiveAccount(db, rule.accountId);
  const timestamp = clock();
  await db.withExclusiveTransactionAsync(async (session) => {
    await session.runAsync(`UPDATE recurring_rules SET kind = ?, account_id = ?, category_id = ?, name = ?, description = ?, amount_cents = ?, frequency = ?, charge_day = ?, charge_month = ?, start_date = ?, end_date = ?, updated_at = ? WHERE id = ? AND is_active = 1 AND deleted_at IS NULL;`, rule.kind, rule.accountId, rule.categoryId, rule.name, rule.description, rule.amountCents, rule.frequency, rule.chargeDay, rule.chargeMonth, rule.startDate, rule.endDate, timestamp, id);
    await session.runAsync(
      `DELETE FROM recurrence_processing_checkpoints
       WHERE recurring_rule_sync_id = (SELECT sync_id FROM recurring_rules WHERE id = ?);`,
      id,
    );
    await enqueueEntityMutation(session, 'recurring_rule', id, timestamp);
  });
  return findRecurringRuleById(db, id);
}
export async function deleteRecurringRule(db: RepositoryDatabase, id: number, clock: Clock = systemClock): Promise<boolean> {
  const existing = await findRecurringRuleById(db, id); if (!existing || !existing.isActive) return false;
  const timestamp = clock();
  await db.withExclusiveTransactionAsync(async (session) => {
    await session.runAsync('UPDATE recurring_rules SET is_active = 0, deleted_at = ?, updated_at = ? WHERE id = ?;', timestamp, timestamp, id);
    await enqueueEntityMutation(session, 'recurring_rule', id, timestamp);
  });
  return true;
}
export async function pauseRecurringRule(db: RepositoryDatabase, id: number, clock: Clock = systemClock): Promise<boolean> {
  const existing = await findRecurringRuleById(db, id);
  if (!existing?.isActive) return false;
  const timestamp = clock();
  await db.withExclusiveTransactionAsync(async (session) => {
    await session.runAsync('UPDATE recurring_rules SET is_active = 0, deleted_at = NULL, updated_at = ? WHERE id = ? AND is_active = 1;', timestamp, id);
    await enqueueEntityMutation(session, 'recurring_rule', id, timestamp);
  });
  return true;
}
export async function resumeRecurringRule(db: RepositoryDatabase, id: number, clock: Clock = systemClock): Promise<boolean> {
  const existing = await findRecurringRuleById(db, id);
  if (!existing || existing.isActive || existing.deletedAt !== null) return false;
  const timestamp = clock();
  await db.withExclusiveTransactionAsync(async (session) => {
    await session.runAsync('UPDATE recurring_rules SET is_active = 1, updated_at = ? WHERE id = ? AND is_active = 0 AND deleted_at IS NULL;', timestamp, id);
    await enqueueEntityMutation(session, 'recurring_rule', id, timestamp);
  });
  return true;
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
    const ruleRow = await session.getFirstAsync<SyncRecurringRuleRow>(`SELECT r.${ruleColumns.replaceAll(', ', ', r.')}, r.sync_id FROM recurring_rules r JOIN accounts a ON a.id = r.account_id AND a.is_archived = 0 AND a.deleted_at IS NULL WHERE r.id = ?;`, ruleId);
    if (!ruleRow) throw new Error('Recurring rule was not found.');
    const rule = mapRecurringRule(ruleRow);
    if (!rule.isActive || !isRecurringRuleDueOn(rule, scheduledDate)) throw new Error('Recurring rule is not due.');
    const existingOccurrence = await findOccurrence(session, rule.id, scheduledDate);
    if (existingOccurrence) throw new Error('Recurring occurrence was already processed.');
    created = await insertDueOccurrence(session, rule, ruleRow.sync_id, scheduledDate, clock());
  });
  if (!created) throw new Error('Recurring occurrence creation did not complete.');
  return created;
}

export async function processDueRecurringRules(
  db: RepositoryDatabase,
  scheduledDate: CivilDate,
  clock: Clock = systemClock,
  batchSize = 100,
): Promise<RecurringProcessingResult> {
  if (!parseCivilDate(scheduledDate).ok) throw new Error('Invalid recurring processing date.');
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error('Invalid recurring processing batch size.');

  const financialTimeZone = await getLedgerFinancialTimeZone(db);
  const startedAt = clock();
  const batchId = await beginOrResumeProcessingBatch(db, scheduledDate, financialTimeZone, startedAt);
  const rows = await db.getAllAsync<SyncRecurringRuleRow>(
    `SELECT r.${ruleColumns.replaceAll(', ', ', r.')}, r.sync_id
     FROM recurring_rules r
     JOIN accounts a ON a.id = r.account_id AND a.is_archived = 0 AND a.deleted_at IS NULL
     WHERE r.is_active = 1 AND r.deleted_at IS NULL AND r.start_date <= ? ORDER BY r.id;`,
    scheduledDate,
  );
  const checkpoints = await readProcessingCheckpoints(db);
  const pending = rows.flatMap((row) => {
    const rule = mapRecurringRule(row);
    const processedThrough = checkpoints.get(row.sync_id);
    return listRecurringRuleDatesDueBy(rule, scheduledDate)
      .filter((occurrenceDate) => processedThrough === undefined || occurrenceDate > processedThrough)
      .map((occurrenceDate) => ({ occurrenceDate, rule, ruleSyncId: row.sync_id }));
  });
  const generated: DueOccurrence[] = [];
  try {
    for (let offset = 0; offset < pending.length; offset += batchSize) {
      const batch = pending.slice(offset, offset + batchSize);
      await db.withExclusiveTransactionAsync(async (session) => {
        for (const item of batch) {
          if (!await findOccurrence(session, item.rule.id, item.occurrenceDate)) {
            generated.push(await insertDueOccurrence(
              session,
              item.rule,
              item.ruleSyncId,
              item.occurrenceDate,
              clock(),
            ));
          }
          await advanceProcessingCheckpoint(session, item.ruleSyncId, item.occurrenceDate, batchId, clock());
        }
      });
    }
    await db.withExclusiveTransactionAsync(async (session) => {
      for (const row of rows) {
        await advanceProcessingCheckpoint(session, row.sync_id, scheduledDate, batchId, clock());
      }
      const completedAt = clock();
      await session.runAsync(
        `UPDATE recurrence_processing_batches
         SET state = 'completed', updated_at = ?, completed_at = ? WHERE batch_id = ?;`,
        completedAt,
        completedAt,
        batchId,
      );
    });
  } catch (error) {
    await db.runAsync(
      `UPDATE recurrence_processing_batches
       SET state = 'interrupted', updated_at = ? WHERE batch_id = ?;`,
      clock(),
      batchId,
    );
    throw error;
  }

  return {
    affectedAccountIds: [...new Set(pending.map((item) => item.rule.accountId))],
    affectedCategoryIds: [...new Set(pending.flatMap((item) => item.rule.categoryId === null ? [] : [item.rule.categoryId]))],
    generated,
  };
}

export async function processDueRecurringRulesAt(
  db: RepositoryDatabase,
  instant: Date,
  clock: Clock = systemClock,
  batchSize = 100,
): Promise<RecurringProcessingResult> {
  const financialTimeZone = await getLedgerFinancialTimeZone(db);
  return processDueRecurringRules(db, getCivilDateInTimeZone(instant, financialTimeZone), clock, batchSize);
}

export async function getLedgerFinancialTimeZone(db: RepositorySession): Promise<string> {
  const row = await db.getFirstAsync<{ financial_timezone: string | null }>(
    'SELECT financial_timezone FROM local_profile WHERE id = 1;',
  );
  if (!isValidTimeZone(row?.financial_timezone)) throw new Error('Ledger financial timezone is unavailable.');
  return row.financial_timezone;
}

async function findOccurrence(
  session: RepositorySession,
  ruleId: EntityId,
  scheduledDate: CivilDate,
): Promise<RecurringOccurrence | null> {
  const row = await session.getFirstAsync<RecurringOccurrenceRow>(
    `SELECT id, recurring_rule_id, scheduled_date, transaction_id, created_at
     FROM recurring_occurrences
     WHERE deleted_at IS NULL AND recurring_rule_id = ? AND scheduled_date = ?;`,
    ruleId,
    scheduledDate,
  );
  return row ? mapRecurringOccurrence(row) : null;
}

async function insertDueOccurrence(
  session: RepositorySession,
  rule: RecurringRule,
  ruleSyncId: string,
  scheduledDate: CivilDate,
  timestamp: string,
): Promise<DueOccurrence> {
  const transactionRow = await session.getFirstAsync<TransactionRow>(
    `INSERT INTO transactions (sync_id, kind, account_id, destination_account_id, category_id, name, description, amount_cents, transaction_date, created_at, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?) RETURNING ${transactionColumns};`,
    recurringTransactionSyncId(ruleSyncId, scheduledDate),
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
  if (!transactionRow) throw new Error('Generated transaction was not found.');
  const transaction = mapTransaction(transactionRow);
  await enqueueFinancialAccountMutations(session, [transaction.accountId], timestamp);
  await enqueueEntityMutation(session, 'transaction', transaction.id, timestamp);

  const occurrenceRow = await session.getFirstAsync<RecurringOccurrenceRow>(
    'INSERT INTO recurring_occurrences (sync_id, recurring_rule_id, scheduled_date, transaction_id, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id, recurring_rule_id, scheduled_date, transaction_id, created_at;',
    recurringOccurrenceSyncId(ruleSyncId, scheduledDate),
    rule.id,
    scheduledDate,
    transaction.id,
    timestamp,
  );
  if (!occurrenceRow) throw new Error('Generated recurring occurrence was not found.');
  await enqueueEntityMutation(session, 'recurring_occurrence', occurrenceRow.id, timestamp);

  return { occurrence: mapRecurringOccurrence(occurrenceRow), transaction };
}

async function beginOrResumeProcessingBatch(
  db: RepositoryDatabase,
  processingDate: CivilDate,
  financialTimeZone: string,
  timestamp: string,
): Promise<string> {
  let batchId: string | null = null;
  await db.withExclusiveTransactionAsync(async (session) => {
    const existing = await session.getFirstAsync<{ batch_id: string }>(
      `SELECT batch_id FROM recurrence_processing_batches
       WHERE processing_date = ? AND financial_timezone = ?;`,
      processingDate,
      financialTimeZone,
    );
    if (existing) {
      batchId = existing.batch_id;
      await session.runAsync(
        `UPDATE recurrence_processing_batches
         SET state = 'running', updated_at = ?, completed_at = NULL WHERE batch_id = ?;`,
        timestamp,
        existing.batch_id,
      );
      return;
    }
    const created = await session.getFirstAsync<{ batch_id: string }>(
      `INSERT INTO recurrence_processing_batches (
         batch_id, processing_date, financial_timezone, state, started_at, updated_at
       ) VALUES (lower(hex(randomblob(16))), ?, ?, 'running', ?, ?) RETURNING batch_id;`,
      processingDate,
      financialTimeZone,
      timestamp,
      timestamp,
    );
    if (!created) throw new Error('Recurring processing batch was not created.');
    batchId = created.batch_id;
  });
  if (batchId === null) throw new Error('Recurring processing batch was not prepared.');
  return batchId;
}

async function readProcessingCheckpoints(
  db: RepositorySession,
): Promise<ReadonlyMap<string, CivilDate>> {
  const result = new Map<string, CivilDate>();
  const rows = await db.getAllAsync<{ recurring_rule_sync_id: string; processed_through: CivilDate }>(
    'SELECT recurring_rule_sync_id, processed_through FROM recurrence_processing_checkpoints;',
  );
  for (const row of rows) result.set(row.recurring_rule_sync_id, row.processed_through);
  return result;
}

async function advanceProcessingCheckpoint(
  db: RepositorySession,
  ruleSyncId: string,
  processedThrough: CivilDate,
  batchId: string,
  timestamp: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO recurrence_processing_checkpoints (
       recurring_rule_sync_id, processed_through, batch_id, updated_at
     ) VALUES (?, ?, ?, ?)
     ON CONFLICT(recurring_rule_sync_id) DO UPDATE SET
       processed_through = CASE
         WHEN excluded.processed_through > recurrence_processing_checkpoints.processed_through
           THEN excluded.processed_through
         ELSE recurrence_processing_checkpoints.processed_through
       END,
       batch_id = excluded.batch_id,
       updated_at = excluded.updated_at;`,
    ruleSyncId,
    processedThrough,
    batchId,
    timestamp,
  );
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
  const account = await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE id = ? AND is_archived = 0 AND deleted_at IS NULL;', accountId);
  if (!account) throw new Error('Archived or missing account cannot receive recurring rules.');
}
