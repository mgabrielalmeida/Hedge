import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { asSyncIdentifier, type SyncCommand, type SyncEvent } from '@/domain/sync/contracts';

import { initializeDatabase } from '../database';
import { createAccount, updateAccount } from '../repositories/accounts';
import { createCategory, updateCategory } from '../repositories/categories';
import { createRecurringRule, createDueOccurrence, processDueRecurringRules } from '../repositories/recurring';
import { createTransaction, deleteTransaction } from '../repositories/transactions';
import { TestDatabase, createTestDatabase } from '../testDatabase';
import {
  acquireOutboxLease,
  applySyncEvent,
  listSyncConflictReviews,
  recordSyncConflict,
  resolveSyncConflict,
} from './outbox';
import { reconcileOnce } from './reconcile';
import { SimulatedSyncTransport } from './simulatedTransport';

const first = '2026-09-28T10:00:00.000Z';
const second = '2026-09-28T10:01:00.000Z';
const third = '2026-09-28T10:02:00.000Z';

describe('local outbox and reconciliation', () => {
  let database: TestDatabase;

  beforeEach(async () => {
    database = createTestDatabase();
    await initializeDatabase(database);
  });

  afterEach(() => database.close());

  it('records compound financial mutations and their dependencies atomically', async () => {
    const source = await createAccount(database, accountInput('Source', 20_000), () => first);
    const destination = await createAccount(database, accountInput('Destination', 0), () => first);
    const category = await createCategory(database, { name: 'Travel', monthlyBudgetCents: 50_000 }, () => first);
    const transfer = await createTransaction(database, {
      kind: 'transfer', accountId: source.id, destinationAccountId: destination.id,
      name: 'Reserve', amountCents: -5_000, transactionDate: '2026-09-28',
    }, () => second);
    const rule = await createRecurringRule(database, {
      kind: 'expense', accountId: source.id, categoryId: category.id, name: 'Monthly trip',
      amountCents: -1_000, frequency: 'monthly', chargeDay: 28, startDate: '2026-09-01',
    }, () => second);
    await createDueOccurrence(database, rule.id, '2026-09-28', () => third);
    await deleteTransaction(database, transfer.id, () => third);

    const rows = await database.getAllAsync<{
      entity_kind: string; operation: string; depends_on_json: string; payload_json: string;
    }>(`SELECT entity_kind, operation, depends_on_json, payload_json FROM sync_outbox
        WHERE entity_kind IN ('account', 'transaction', 'recurring_rule', 'recurring_occurrence');`);

    expect(rows.filter((row) => row.entity_kind === 'account')).toHaveLength(2);
    expect(rows.some((row) => row.entity_kind === 'transaction' && row.operation === 'tombstone')).toBe(true);
    expect(rows.some((row) => row.entity_kind === 'recurring_rule' && JSON.parse(row.depends_on_json).length >= 2)).toBe(true);
    expect(rows.some((row) => row.entity_kind === 'recurring_occurrence' && JSON.parse(row.payload_json).scheduledDate === '2026-09-28')).toBe(true);
  });

  it('rolls back financial data when its outbox command cannot be persisted', async () => {
    const account = await createAccount(database, accountInput('Atomic', 0), () => first);
    await database.execAsync(`
      CREATE TRIGGER reject_transaction_outbox
      BEFORE INSERT ON sync_outbox WHEN NEW.entity_kind = 'transaction'
      BEGIN SELECT RAISE(ABORT, 'simulated outbox failure'); END;
    `);

    await expect(createTransaction(database, {
      kind: 'income', accountId: account.id, name: 'Must roll back',
      amountCents: 1_000, transactionDate: '2026-09-28',
    }, () => second)).rejects.toThrow('simulated outbox failure');
    await expect(database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM transactions WHERE name = 'Must roll back';`,
    )).resolves.toEqual({ count: 0 });
  });

  it('keeps commands after a database restart and recovers an expired lease', async () => {
    database.close();
    const directory = mkdtempSync(join(tmpdir(), 'hedge-outbox-restart-'));
    const filename = join(directory, 'profile.db');
    try {
      database = new TestDatabase(filename);
      await initializeDatabase(database);
      await createCategory(database, { name: 'Persistent', monthlyBudgetCents: 100 }, () => first);
      const firstLease = await acquireOutboxLease(database, first, second, 50);
      expect(firstLease.commands.some((command) => command.entity.kind === 'category' && command.payload.name === 'Persistent')).toBe(true);
      database.close();

      database = new TestDatabase(filename);
      await initializeDatabase(database);
      const recovered = await acquireOutboxLease(database, third, '2026-09-28T10:03:00.000Z', 50);
      expect(recovered.commands.some((command) => command.entity.kind === 'category' && command.payload.name === 'Persistent')).toBe(true);
    } finally {
      database.close();
      database = createTestDatabase();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('retries a lost response without duplicating server effects or local events', async () => {
    await createCategory(database, { name: 'Retry', monthlyBudgetCents: 100 }, () => first);
    const transport = new SimulatedSyncTransport({ dropPushResponse: true, duplicateEvents: true });

    await expect(reconcileOnce(database, transport, () => second)).rejects.toThrow('lost push response');
    transport.setFaults({ duplicateEvents: true, reverseEvents: true });
    await expect(reconcileOnce(database, transport, () => third)).resolves.toEqual(expect.objectContaining({ conflicts: 0 }));

    const receipts = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_receipts;');
    const events = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_applied_events;');
    const confirmed = await database.getAllAsync<{ entity_kind: string; entity_sync_id: string }>(
      'SELECT entity_kind, entity_sync_id FROM sync_confirmed_entities;',
    );
    expect(receipts?.count).toBe(6);
    expect(events?.count).toBe(6);
    expect(new Set(confirmed.map((item) => `${item.entity_kind}:${item.entity_sync_id}`)).size).toBe(6);
    await expect(database.getFirstAsync<{ cursor_value: string }>('SELECT cursor_value FROM sync_state WHERE id = 1;'))
      .resolves.toEqual({ cursor_value: 'cursor-6' });
  });

  it('resumes an interrupted and reordered push from the persisted commands', async () => {
    await createCategory(database, { name: 'Interrupted', monthlyBudgetCents: 100 }, () => first);
    const transport = new SimulatedSyncTransport({ interruptAfterCommands: 2, reverseCommands: true });

    await expect(reconcileOnce(database, transport, () => second)).rejects.toThrow('transport interruption');
    transport.setFaults({ reverseEvents: true, duplicateEvents: true });
    await expect(reconcileOnce(database, transport, () => third)).resolves.toEqual(expect.objectContaining({ conflicts: 0 }));

    await expect(database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox;'))
      .resolves.toEqual({ count: 0 });
    await expect(database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_applied_events;'))
      .resolves.toEqual({ count: 6 });
  });

  it('rebases pending work over downloads without overwriting the local proposal', async () => {
    const account = await createAccount(database, accountInput('Original', 0), () => first);
    const transport = new SimulatedSyncTransport();
    await reconcileOnce(database, transport, () => second);
    await updateAccount(database, account.id, {
      name: 'Local proposal', institutionName: 'Bank', iconValue: 'bank', colorValue: '#123456', themeColorIndex: null,
    }, () => third);
    const identity = await database.getFirstAsync<{ sync_id: string }>('SELECT sync_id FROM accounts WHERE id = ?;', account.id);
    const remote: SyncEvent = {
      eventId: asSyncIdentifier('remote-event-2')!,
      cursor: { value: asSyncIdentifier('remote-cursor-2')! },
      entity: { kind: 'account', syncId: asSyncIdentifier(identity!.sync_id)! },
      operation: 'upsert', version: 2,
      payload: {
        name: 'Remote value', institutionName: 'Bank', iconValue: 'bank', colorValue: '#654321',
        themeColorIndex: null, isArchived: 0, archivedAt: null, createdAt: first, updatedAt: third,
      },
    };

    await expect(applySyncEvent(database, remote, third)).resolves.toBe(true);
    await expect(database.getFirstAsync<{ name: string }>('SELECT name FROM accounts WHERE id = ?;', account.id))
      .resolves.toEqual({ name: 'Local proposal' });
    await expect(database.getFirstAsync<{ expected_version: number }>(
      `SELECT expected_version FROM sync_outbox WHERE entity_kind = 'account' AND entity_sync_id = ?;`, identity!.sync_id,
    )).resolves.toEqual({ expected_version: 2 });
  });

  it('preserves a rejected proposal while independent commands continue', async () => {
    const firstCategory = await createCategory(database, { name: 'Conflicting', monthlyBudgetCents: 100 }, () => first);
    const transport = new SimulatedSyncTransport();
    await reconcileOnce(database, transport, () => second);
    await updateCategory(database, firstCategory.id, { name: 'Conflicting local', monthlyBudgetCents: 200 }, () => third);
    await createCategory(database, { name: 'Independent', monthlyBudgetCents: 300 }, () => third);
    await database.runAsync(
      `UPDATE sync_outbox SET expected_version = 0
       WHERE entity_kind = 'category' AND payload_json LIKE '%Conflicting local%';`,
    );

    const result = await reconcileOnce(database, transport, () => '2026-09-28T10:03:00.000Z');
    expect(result.conflicts).toBe(1);
    await expect(database.getFirstAsync<{ state: string; rejection_code: string }>(
      `SELECT state, rejection_code FROM sync_outbox WHERE payload_json LIKE '%Conflicting local%';`,
    )).resolves.toEqual({ state: 'rejected', rejection_code: 'version_mismatch' });
    await expect(database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM sync_outbox WHERE payload_json LIKE '%Independent%';`,
    )).resolves.toEqual({ count: 0 });
    await expect(database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_conflicts;'))
      .resolves.toEqual({ count: 1 });
    await expect(database.getFirstAsync<{ name: string }>('SELECT name FROM categories WHERE id = ?;', firstCategory.id))
      .resolves.toEqual({ name: 'Conflicting local' });

    const [review] = await listSyncConflictReviews(database);
    expect(review).toEqual(expect.objectContaining({ reviewKind: 'concurrent_edit' }));
    await resolveSyncConflict(database, review.id, 'accept_remote', '2026-09-28T10:04:00.000Z');
    await expect(database.getFirstAsync<{ name: string }>('SELECT name FROM categories WHERE id = ?;', firstCategory.id))
      .resolves.toEqual({ name: 'Conflicting' });
    await expect(listSyncConflictReviews(database)).resolves.toEqual([]);
  });

  it('retries a reviewed local proposal with the current remote version', async () => {
    const category = await createCategory(database, { name: 'Remote base', monthlyBudgetCents: 100 }, () => first);
    const transport = new SimulatedSyncTransport();
    await reconcileOnce(database, transport, () => second);
    await updateCategory(database, category.id, { name: 'Keep local', monthlyBudgetCents: 200 }, () => third);
    await database.runAsync(
      `UPDATE sync_outbox SET expected_version = 0
       WHERE entity_kind = 'category' AND payload_json LIKE '%Keep local%';`,
    );
    await reconcileOnce(database, transport, () => '2026-09-28T10:03:00.000Z');

    const [review] = await listSyncConflictReviews(database);
    await resolveSyncConflict(database, review.id, 'keep_local', '2026-09-28T10:04:00.000Z');
    await expect(database.getFirstAsync<{ expected_version: number; state: string }>(
      `SELECT expected_version, state FROM sync_outbox
       WHERE entity_kind = 'category' AND payload_json LIKE '%Keep local%';`,
    )).resolves.toEqual({ expected_version: 1, state: 'pending' });
    await expect(reconcileOnce(database, transport, () => '2026-09-28T10:05:00.000Z'))
      .resolves.toEqual(expect.objectContaining({ conflicts: 0 }));
    await expect(listSyncConflictReviews(database)).resolves.toEqual([]);
  });

  it('classifies edit, deletion, archive, and category conflicts for explicit review', async () => {
    const cases: readonly [SyncCommand, SyncEvent][] = [
      conflictPair('edit', 'category', 'upsert', { name: 'Local' }, 'upsert', { name: 'Remote' }),
      conflictPair('delete', 'transaction', 'tombstone', {}, 'upsert', { name: 'Remote' }),
      conflictPair('archive', 'account', 'upsert', { isArchived: 1 }, 'upsert', { isArchived: 0 }),
      conflictPair(
        'category',
        'transaction',
        'upsert',
        { categorySyncId: 'category-local' },
        'upsert',
        { categorySyncId: 'category-remote' },
      ),
    ];
    for (const [command, current] of cases) {
      await recordSyncConflict(database, command, current, 'version_mismatch', third);
    }

    expect((await listSyncConflictReviews(database)).map((review) => review.reviewKind)).toEqual([
      'concurrent_edit',
      'concurrent_delete',
      'concurrent_archive',
      'concurrent_category',
    ]);
  });

  it('deduplicates an occurrence generated independently by two simulated devices', async () => {
    const other = createTestDatabase();
    try {
      await initializeDatabase(other);
      for (const target of [database, other]) {
        await target.runAsync("DELETE FROM sync_outbox WHERE entity_kind = 'category';");
        await target.runAsync(
          `INSERT INTO accounts (
             id, sync_id, name, institution_name, visual_type, visual_value, icon_value, color_value
           ) VALUES (100, 'shared-account', 'Shared', 'Bank', 'icon', 'bank', 'bank', '#123456');`,
        );
        await target.runAsync(
          `INSERT INTO recurring_rules (
             id, sync_id, kind, account_id, name, amount_cents, frequency, charge_day, start_date
           ) VALUES (100, 'shared-rule', 'income', 100, 'Shared recurrence', 500, 'monthly', 29, '2026-09-01');`,
        );
        await processDueRecurringRules(target, '2026-09-29', () => third);
      }

      const identities = await Promise.all([database, other].map((target) => target.getFirstAsync<{
        occurrence_sync_id: string;
        transaction_sync_id: string;
      }>(
        `SELECT o.sync_id AS occurrence_sync_id, t.sync_id AS transaction_sync_id
         FROM recurring_occurrences o JOIN transactions t ON t.id = o.transaction_id
         WHERE o.recurring_rule_id = 100;`,
      )));
      expect(identities[0]).toEqual(identities[1]);
      expect(identities[0]).toEqual({
        occurrence_sync_id: 'shared-rule:2026-09-29',
        transaction_sync_id: 'shared-rule:2026-09-29:transaction',
      });

      const transport = new SimulatedSyncTransport();
      await reconcileOnce(database, transport, () => '2026-09-28T10:03:00.000Z');
      await reconcileOnce(other, transport, () => '2026-09-28T10:04:00.000Z');
      const server = await transport.pull(null);
      expect(server.events.filter((event) => event.entity.kind === 'recurring_occurrence')).toHaveLength(1);
      expect(server.events.filter((event) => event.entity.kind === 'transaction'
        && event.entity.syncId === 'shared-rule:2026-09-29:transaction')).toHaveLength(1);
    } finally {
      other.close();
    }
  });
});

function accountInput(name: string, initialBalanceCents: number) {
  return {
    name, institutionName: 'Bank', iconValue: 'bank', colorValue: '#123456', themeColorIndex: null,
    initialBalanceCents, openingBalanceDate: '2026-09-28',
  } as const;
}

function conflictPair(
  id: string,
  kind: SyncCommand['entity']['kind'],
  localOperation: SyncCommand['operation'],
  localPayload: SyncCommand['payload'],
  remoteOperation: SyncEvent['operation'],
  remotePayload: SyncEvent['payload'],
): [SyncCommand, SyncEvent] {
  const entity = { kind, syncId: asSyncIdentifier(`entity-${id}`)! };
  return [{
    commandId: asSyncIdentifier(`command-${id}`)!,
    entity,
    operation: localOperation,
    expectedVersion: 1,
    dependsOn: [],
    payload: localPayload,
  }, {
    eventId: asSyncIdentifier(`event-${id}`)!,
    cursor: { value: asSyncIdentifier(`cursor-${id}`)! },
    entity,
    operation: remoteOperation,
    version: 2,
    payload: remotePayload,
  }];
}
