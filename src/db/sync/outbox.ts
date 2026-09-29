import {
  asSyncIdentifier,
  isSyncCommand,
  isSyncEvent,
  isSyncReceipt,
  type SyncCommand,
  type SyncConflictResolution,
  type SyncConflictReviewKind,
  type SyncEntityKind,
  type SyncEvent,
  type SyncOperation,
  type SyncPayload,
  type SyncReceipt,
} from '@/domain/sync/contracts';

import type { RepositoryDatabase, RepositorySession } from '../repositories/database';

type OutboxRow = {
  command_id: string;
  entity_kind: SyncEntityKind;
  entity_sync_id: string;
  operation: SyncOperation;
  expected_version: number | null;
  depends_on_json: string;
  payload_json: string;
};

type EntitySnapshot = {
  readonly syncId: string;
  readonly version: number;
  readonly operation: SyncOperation;
  readonly payload: SyncPayload;
  readonly dependencySyncIds: readonly string[];
};

export type OutboxLease = {
  readonly token: string;
  readonly commands: readonly SyncCommand[];
};

export async function enqueueEntityMutation(
  db: RepositorySession,
  entityKind: SyncEntityKind,
  localId: number,
  timestamp: string,
): Promise<void> {
  const snapshot = await readEntitySnapshot(db, entityKind, localId);
  if (!snapshot) throw new Error(`Cannot enqueue missing ${entityKind}.`);

  const dependencies = await resolveDependencies(db, snapshot.dependencySyncIds);
  const pending = await db.getFirstAsync<{ command_id: string }>(
    `SELECT command_id FROM sync_outbox
     WHERE entity_kind = ? AND entity_sync_id = ? AND state = 'pending'
     ORDER BY created_at DESC, command_id DESC LIMIT 1;`,
    entityKind,
    snapshot.syncId,
  );
  const payloadJson = JSON.stringify(snapshot.payload);
  const dependenciesJson = JSON.stringify(dependencies);

  if (pending) {
    await db.runAsync(
      `UPDATE sync_outbox
       SET operation = ?, expected_version = ?, depends_on_json = ?, payload_json = ?, updated_at = ?
       WHERE command_id = ?;`,
      snapshot.operation,
      snapshot.version,
      dependenciesJson,
      payloadJson,
      timestamp,
      pending.command_id,
    );
    return;
  }

  const leased = await db.getFirstAsync<{ command_id: string; expected_version: number | null }>(
    `SELECT command_id, expected_version FROM sync_outbox
     WHERE entity_kind = ? AND entity_sync_id = ? AND state = 'leased'
     ORDER BY created_at DESC, command_id DESC LIMIT 1;`,
    entityKind,
    snapshot.syncId,
  );
  const chainedDependencies = leased
    ? [...new Set([...dependencies, leased.command_id])]
    : dependencies;
  const expectedVersion = leased?.expected_version === null || leased?.expected_version === undefined
    ? snapshot.version
    : leased.expected_version + 1;

  await db.runAsync(
    `INSERT INTO sync_outbox (
       command_id, entity_kind, entity_sync_id, operation, expected_version,
       depends_on_json, payload_json, created_at, updated_at
     ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?);`,
    entityKind,
    snapshot.syncId,
    snapshot.operation,
    expectedVersion,
    JSON.stringify(chainedDependencies),
    payloadJson,
    timestamp,
    timestamp,
  );
}

export async function acquireOutboxLease(
  db: RepositoryDatabase,
  now: string,
  expiresAt: string,
  limit = 50,
): Promise<OutboxLease> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid outbox lease limit.');
  let lease: OutboxLease = { token: '', commands: [] };
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `UPDATE sync_outbox
       SET state = 'pending', lease_token = NULL, lease_expires_at = NULL
       WHERE state = 'leased' AND lease_expires_at <= ?;`,
      now,
    );
    const tokenRow = await transaction.getFirstAsync<{ token: string }>('SELECT lower(hex(randomblob(16))) AS token;');
    if (!tokenRow) throw new Error('Could not create outbox lease token.');
    const rows = await transaction.getAllAsync<OutboxRow>(
      `SELECT command_id, entity_kind, entity_sync_id, operation, expected_version, depends_on_json, payload_json
       FROM sync_outbox WHERE state = 'pending'
       ORDER BY created_at, command_id LIMIT ?;`,
      limit,
    );
    for (const row of rows) {
      await transaction.runAsync(
        `UPDATE sync_outbox
         SET state = 'leased', lease_token = ?, lease_expires_at = ?, attempt_count = attempt_count + 1, updated_at = ?
         WHERE command_id = ? AND state = 'pending';`,
        tokenRow.token,
        expiresAt,
        now,
        row.command_id,
      );
    }
    lease = { token: tokenRow.token, commands: rows.map(mapCommand) };
  });
  return lease;
}

export async function releaseOutboxLease(
  db: RepositoryDatabase,
  token: string,
  now: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE sync_outbox
     SET state = 'pending', lease_token = NULL, lease_expires_at = NULL, updated_at = ?
     WHERE state = 'leased' AND lease_token = ?;`,
    now,
    token,
  );
}

export async function applySyncReceipt(
  db: RepositoryDatabase,
  receipt: SyncReceipt,
  receivedAt: string,
): Promise<void> {
  if (!isSyncReceipt(receipt)) throw new Error('Invalid sync receipt.');
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<{ command_id: string }>(
      'SELECT command_id FROM sync_receipts WHERE command_id = ?;',
      receipt.commandId,
    );
    if (existing) return;
    const command = await transaction.getFirstAsync<OutboxRow>(
      `SELECT command_id, entity_kind, entity_sync_id, operation, expected_version, depends_on_json, payload_json
       FROM sync_outbox WHERE command_id = ?;`,
      receipt.commandId,
    );
    if (!command) return;

    await transaction.runAsync(
      `INSERT INTO sync_receipts (command_id, status, entity_version, rejection_code, received_at)
       VALUES (?, ?, ?, ?, ?);`,
      receipt.commandId,
      receipt.status,
      receipt.entityVersion,
      receipt.rejectionCode,
      receivedAt,
    );
    if (receipt.status === 'rejected') {
      await transaction.runAsync(
        `UPDATE sync_outbox SET state = 'rejected', lease_token = NULL, lease_expires_at = NULL,
         rejection_code = ?, updated_at = ? WHERE command_id = ?;`,
        receipt.rejectionCode,
        receivedAt,
        receipt.commandId,
      );
      return;
    }

    const entityVersion = receipt.entityVersion;
    if (entityVersion === null) throw new Error('Accepted receipt is missing an entity version.');
    await transaction.runAsync(
      `INSERT INTO sync_confirmed_entities (
         entity_kind, entity_sync_id, operation, version, payload_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(entity_kind, entity_sync_id) DO UPDATE SET
         operation = excluded.operation, version = excluded.version,
         payload_json = excluded.payload_json, updated_at = excluded.updated_at
       WHERE excluded.version >= sync_confirmed_entities.version;`,
      command.entity_kind,
      command.entity_sync_id,
      command.operation,
      entityVersion,
      command.payload_json,
      receivedAt,
    );
    await setLocalVersion(transaction, command.entity_kind, command.entity_sync_id, entityVersion);
    await transaction.runAsync('DELETE FROM sync_outbox WHERE command_id = ?;', receipt.commandId);
    await rebasePendingCommands(transaction, command.entity_kind, command.entity_sync_id, entityVersion);
  });
}

export async function applySyncEvent(
  db: RepositoryDatabase,
  event: SyncEvent,
  appliedAt: string,
): Promise<boolean> {
  if (!isSyncEvent(event)) throw new Error('Invalid sync event.');
  let applied = false;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const duplicate = await transaction.getFirstAsync<{ event_id: string }>(
      'SELECT event_id FROM sync_applied_events WHERE event_id = ?;',
      event.eventId,
    );
    if (duplicate) return;
    const confirmed = await transaction.getFirstAsync<{ version: number }>(
      `SELECT version FROM sync_confirmed_entities WHERE entity_kind = ? AND entity_sync_id = ?;`,
      event.entity.kind,
      event.entity.syncId,
    );
    if (confirmed && event.version < confirmed.version) {
      await rememberEvent(transaction, event, appliedAt);
      return;
    }

    await transaction.runAsync(
      `INSERT INTO sync_confirmed_entities (
         entity_kind, entity_sync_id, operation, version, payload_json, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(entity_kind, entity_sync_id) DO UPDATE SET
         operation = excluded.operation, version = excluded.version,
         payload_json = excluded.payload_json, updated_at = excluded.updated_at;`,
      event.entity.kind,
      event.entity.syncId,
      event.operation,
      event.version,
      JSON.stringify(event.payload),
      appliedAt,
    );
    const pending = await transaction.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM sync_outbox
       WHERE entity_kind = ? AND entity_sync_id = ? AND state IN ('pending', 'leased', 'rejected');`,
      event.entity.kind,
      event.entity.syncId,
    );
    if ((pending?.count ?? 0) === 0) {
      await projectConfirmedEvent(transaction, event, appliedAt);
    } else {
      await rebasePendingCommands(transaction, event.entity.kind, event.entity.syncId, event.version);
    }
    await rememberEvent(transaction, event, appliedAt);
    applied = true;
  });
  return applied;
}

export async function recordSyncConflict(
  db: RepositoryDatabase,
  command: SyncCommand,
  current: SyncEvent,
  reason: 'version_mismatch' | 'dependency_rejected' | 'generation_closed',
  createdAt: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_conflicts (
       command_id, entity_kind, entity_sync_id, reason, command_json, current_event_json,
       review_kind, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(command_id) DO NOTHING;`,
    command.commandId,
    command.entity.kind,
    command.entity.syncId,
    reason,
    JSON.stringify(command),
    JSON.stringify(current),
    classifyConflictReview(command, current),
    createdAt,
  );
}

export type SyncConflictReview = {
  readonly id: number;
  readonly command: SyncCommand;
  readonly current: SyncEvent;
  readonly reason: 'version_mismatch' | 'dependency_rejected' | 'generation_closed';
  readonly reviewKind: SyncConflictReviewKind;
  readonly createdAt: string;
};

export async function listSyncConflictReviews(db: RepositorySession): Promise<readonly SyncConflictReview[]> {
  const rows = await db.getAllAsync<{
    id: number;
    reason: SyncConflictReview['reason'];
    command_json: string;
    current_event_json: string;
    review_kind: SyncConflictReviewKind;
    created_at: string;
  }>(
    `SELECT id, reason, command_json, current_event_json, review_kind, created_at
     FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY created_at, id;`,
  );
  return rows.map((row) => {
    const command = JSON.parse(row.command_json) as unknown;
    const current = JSON.parse(row.current_event_json) as unknown;
    if (!isSyncCommand(command) || !isSyncEvent(current)) throw new Error('Invalid persisted sync conflict.');
    return {
      id: row.id,
      command,
      current,
      reason: row.reason,
      reviewKind: row.review_kind,
      createdAt: row.created_at,
    };
  });
}

export async function resolveSyncConflict(
  db: RepositoryDatabase,
  conflictId: number,
  resolution: SyncConflictResolution,
  resolvedAt: string,
): Promise<void> {
  if (!Number.isSafeInteger(conflictId) || conflictId <= 0) throw new Error('Invalid sync conflict id.');
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const row = await transaction.getFirstAsync<{
      command_id: string;
      command_json: string;
      current_event_json: string;
    }>('SELECT command_id, command_json, current_event_json FROM sync_conflicts WHERE id = ? AND resolved_at IS NULL;', conflictId);
    if (!row) throw new Error('Sync conflict is unavailable for review.');
    const command = JSON.parse(row.command_json) as unknown;
    const current = JSON.parse(row.current_event_json) as unknown;
    if (!isSyncCommand(command) || !isSyncEvent(current)) throw new Error('Invalid persisted sync conflict.');

    if (resolution === 'accept_remote') {
      await transaction.runAsync('DELETE FROM sync_outbox WHERE command_id = ?;', row.command_id);
      await rewriteOutboxDependencies(transaction, row.command_id, null);
      await projectConfirmedEvent(transaction, current, resolvedAt);
    } else if (resolution === 'keep_local') {
      const persisted = await transaction.getFirstAsync<OutboxRow & { created_at: string }>(
        `SELECT command_id, entity_kind, entity_sync_id, operation, expected_version,
          depends_on_json, payload_json, created_at
         FROM sync_outbox WHERE command_id = ? AND state = 'rejected';`,
        row.command_id,
      );
      if (!persisted) throw new Error('Rejected local proposal is unavailable.');
      const identity = await transaction.getFirstAsync<{ command_id: string }>(
        'SELECT lower(hex(randomblob(16))) AS command_id;',
      );
      if (!identity) throw new Error('Could not create a replacement sync command.');
      await transaction.runAsync(
        `INSERT INTO sync_outbox (
           command_id, entity_kind, entity_sync_id, operation, expected_version,
           depends_on_json, payload_json, state, attempt_count, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?);`,
        identity.command_id,
        persisted.entity_kind,
        persisted.entity_sync_id,
        persisted.operation,
        current.version,
        persisted.depends_on_json,
        persisted.payload_json,
        persisted.created_at,
        resolvedAt,
      );
      await rewriteOutboxDependencies(transaction, row.command_id, identity.command_id);
      await transaction.runAsync('DELETE FROM sync_outbox WHERE command_id = ?;', row.command_id);
    } else {
      throw new Error('Invalid sync conflict resolution.');
    }
    await transaction.runAsync(
      'UPDATE sync_conflicts SET resolution = ?, resolved_at = ? WHERE id = ?;',
      resolution,
      resolvedAt,
      conflictId,
    );
  });
}

export async function updateSyncCursor(
  db: RepositoryDatabase,
  cursorValue: string | null,
  updatedAt: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE sync_state SET cursor_value = ?, updated_at = ? WHERE id = 1;',
    cursorValue,
    updatedAt,
  );
}

async function resolveDependencies(db: RepositorySession, syncIds: readonly string[]): Promise<string[]> {
  const dependencies: string[] = [];
  for (const syncId of [...new Set(syncIds)]) {
    const row = await db.getFirstAsync<{ command_id: string }>(
      `SELECT command_id FROM sync_outbox
       WHERE entity_sync_id = ? AND state IN ('pending', 'leased')
       ORDER BY created_at DESC, command_id DESC LIMIT 1;`,
      syncId,
    );
    if (row) dependencies.push(row.command_id);
  }
  return dependencies;
}

function classifyConflictReview(command: SyncCommand, current: SyncEvent): SyncConflictReviewKind {
  if (command.operation === 'tombstone' || current.operation === 'tombstone') return 'concurrent_delete';
  if (
    command.entity.kind === 'account'
    && command.payload.isArchived !== current.payload.isArchived
  ) return 'concurrent_archive';
  if (
    (command.entity.kind === 'transaction' || command.entity.kind === 'recurring_rule')
    && command.payload.categorySyncId !== current.payload.categorySyncId
  ) return 'concurrent_category';
  return 'concurrent_edit';
}

async function rewriteOutboxDependencies(
  db: RepositorySession,
  oldCommandId: string,
  replacementCommandId: string | null,
): Promise<void> {
  const rows = await db.getAllAsync<{ command_id: string; depends_on_json: string }>(
    'SELECT command_id, depends_on_json FROM sync_outbox WHERE depends_on_json LIKE ?;',
    `%${oldCommandId}%`,
  );
  for (const row of rows) {
    const dependencies = JSON.parse(row.depends_on_json) as unknown;
    if (!Array.isArray(dependencies)) throw new Error('Invalid persisted outbox dependency.');
    const rewritten = dependencies.flatMap((dependency) => {
      if (dependency !== oldCommandId) return [dependency];
      return replacementCommandId === null ? [] : [replacementCommandId];
    });
    await db.runAsync(
      'UPDATE sync_outbox SET depends_on_json = ? WHERE command_id = ?;',
      JSON.stringify([...new Set(rewritten)]),
      row.command_id,
    );
  }
}

async function readEntitySnapshot(
  db: RepositorySession,
  kind: SyncEntityKind,
  id: number,
): Promise<EntitySnapshot | null> {
  switch (kind) {
    case 'account': {
      const row = await db.getFirstAsync<Record<string, string | number | null>>(
        `SELECT sync_id, sync_version, deleted_at, name, institution_name, icon_value, color_value,
          theme_color_index, is_archived, archived_at, financial_version, created_at, updated_at
         FROM accounts WHERE id = ?;`, id,
      );
      return row && snapshot(row, [], {
        name: row.name, institutionName: row.institution_name, iconValue: row.icon_value,
        colorValue: row.color_value, themeColorIndex: row.theme_color_index,
        isArchived: row.is_archived, archivedAt: row.archived_at,
        financialVersion: row.financial_version,
        createdAt: row.created_at, updatedAt: row.updated_at,
      });
    }
    case 'category': {
      const row = await db.getFirstAsync<Record<string, string | number | null>>(
        `SELECT sync_id, sync_version, deleted_at, name, monthly_budget_cents, icon_value,
          color_value, theme_color_index, created_at, updated_at FROM categories WHERE id = ?;`, id,
      );
      return row && snapshot(row, [], {
        name: row.name, monthlyBudgetCents: row.monthly_budget_cents, iconValue: row.icon_value,
        colorValue: row.color_value, themeColorIndex: row.theme_color_index,
        createdAt: row.created_at, updatedAt: row.updated_at,
      });
    }
    case 'transaction': {
      const row = await db.getFirstAsync<Record<string, string | number | null>>(
        `SELECT t.sync_id, t.sync_version, t.deleted_at, t.kind, a.sync_id AS account_sync_id,
          d.sync_id AS destination_account_sync_id, c.sync_id AS category_sync_id,
          t.name, t.description, t.amount_cents, t.transaction_date, t.created_at, t.updated_at
         FROM transactions t JOIN accounts a ON a.id = t.account_id
         LEFT JOIN accounts d ON d.id = t.destination_account_id
         LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?;`, id,
      );
      const deps = row ? [row.account_sync_id, row.destination_account_sync_id, row.category_sync_id].filter(isString) : [];
      return row && snapshot(row, deps, {
        kind: row.kind, accountSyncId: row.account_sync_id,
        destinationAccountSyncId: row.destination_account_sync_id, categorySyncId: row.category_sync_id,
        name: row.name, description: row.description, amountCents: row.amount_cents,
        transactionDate: row.transaction_date, createdAt: row.created_at, updatedAt: row.updated_at,
      });
    }
    case 'recurring_rule': {
      const row = await db.getFirstAsync<Record<string, string | number | null>>(
        `SELECT r.sync_id, r.sync_version, r.deleted_at, r.kind, a.sync_id AS account_sync_id,
          c.sync_id AS category_sync_id, r.name, r.description, r.amount_cents, r.frequency,
          r.charge_day, r.charge_month, r.start_date, r.end_date, r.is_active, r.created_at, r.updated_at
         FROM recurring_rules r JOIN accounts a ON a.id = r.account_id
         LEFT JOIN categories c ON c.id = r.category_id WHERE r.id = ?;`, id,
      );
      const deps = row ? [row.account_sync_id, row.category_sync_id].filter(isString) : [];
      return row && snapshot(row, deps, {
        kind: row.kind, accountSyncId: row.account_sync_id, categorySyncId: row.category_sync_id,
        name: row.name, description: row.description, amountCents: row.amount_cents,
        frequency: row.frequency, chargeDay: row.charge_day, chargeMonth: row.charge_month,
        startDate: row.start_date, endDate: row.end_date, isActive: row.is_active,
        deletedAt: row.deleted_at, createdAt: row.created_at, updatedAt: row.updated_at,
      });
    }
    case 'recurring_occurrence': {
      const row = await db.getFirstAsync<Record<string, string | number | null>>(
        `SELECT o.sync_id, o.sync_version, o.deleted_at, r.sync_id AS recurring_rule_sync_id,
          t.sync_id AS transaction_sync_id, o.scheduled_date, o.created_at
         FROM recurring_occurrences o JOIN recurring_rules r ON r.id = o.recurring_rule_id
         LEFT JOIN transactions t ON t.id = o.transaction_id WHERE o.id = ?;`, id,
      );
      const deps = row ? [row.recurring_rule_sync_id, row.transaction_sync_id].filter(isString) : [];
      return row && snapshot(row, deps, {
        recurringRuleSyncId: row.recurring_rule_sync_id, transactionSyncId: row.transaction_sync_id,
        scheduledDate: row.scheduled_date, createdAt: row.created_at,
      });
    }
  }
}

function snapshot(
  row: Record<string, string | number | null>,
  dependencySyncIds: readonly string[],
  payload: SyncPayload,
): EntitySnapshot {
  if (!isString(row.sync_id) || typeof row.sync_version !== 'number') throw new Error('Invalid local sync identity.');
  return {
    syncId: row.sync_id,
    version: row.sync_version,
    operation: row.deleted_at === null ? 'upsert' : 'tombstone',
    payload,
    dependencySyncIds,
  };
}

function mapCommand(row: OutboxRow): SyncCommand {
  const commandId = asSyncIdentifier(row.command_id);
  const syncId = asSyncIdentifier(row.entity_sync_id);
  const dependsOn = JSON.parse(row.depends_on_json) as unknown;
  const payload = JSON.parse(row.payload_json) as SyncPayload;
  if (!commandId || !syncId || !Array.isArray(dependsOn)) throw new Error('Invalid persisted outbox command.');
  const dependencies = dependsOn.map(asSyncIdentifier);
  if (dependencies.some((item) => item === null)) throw new Error('Invalid persisted outbox dependency.');
  return {
    commandId,
    entity: { kind: row.entity_kind, syncId },
    operation: row.operation,
    expectedVersion: row.expected_version,
    dependsOn: dependencies as NonNullable<(typeof dependencies)[number]>[],
    payload,
  };
}

async function rebasePendingCommands(
  db: RepositorySession,
  kind: SyncEntityKind,
  syncId: string,
  confirmedVersion: number,
): Promise<void> {
  const rows = await db.getAllAsync<{ command_id: string }>(
    `SELECT command_id FROM sync_outbox
     WHERE entity_kind = ? AND entity_sync_id = ? AND state IN ('pending', 'leased')
     ORDER BY created_at, command_id;`,
    kind,
    syncId,
  );
  for (let index = 0; index < rows.length; index += 1) {
    await db.runAsync(
      'UPDATE sync_outbox SET expected_version = ? WHERE command_id = ?;',
      confirmedVersion + index,
      rows[index].command_id,
    );
  }
}

async function rememberEvent(db: RepositorySession, event: SyncEvent, appliedAt: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO sync_applied_events (event_id, cursor_value, applied_at) VALUES (?, ?, ?);',
    event.eventId,
    event.cursor.value,
    appliedAt,
  );
}

async function setLocalVersion(
  db: RepositorySession,
  kind: SyncEntityKind,
  syncId: string,
  version: number,
): Promise<void> {
  const table = tableFor(kind);
  await db.runAsync(`UPDATE ${table} SET sync_version = ? WHERE sync_id = ?;`, version, syncId);
}

async function projectConfirmedEvent(db: RepositorySession, event: SyncEvent, timestamp: string): Promise<void> {
  const syncId = event.entity.syncId;
  if (event.operation === 'tombstone') {
    const table = tableFor(event.entity.kind);
    if (event.entity.kind === 'recurring_rule') {
      await db.runAsync(`UPDATE ${table} SET is_active = 0, deleted_at = ?, sync_version = ? WHERE sync_id = ?;`, timestamp, event.version, syncId);
    } else {
      await db.runAsync(`UPDATE ${table} SET deleted_at = ?, sync_version = ? WHERE sync_id = ?;`, timestamp, event.version, syncId);
    }
    return;
  }
  const p = event.payload as Record<string, string | number | boolean | null>;
  switch (event.entity.kind) {
    case 'account':
      await db.runAsync(
        `INSERT INTO accounts (sync_id, sync_version, name, institution_name, visual_type, visual_value,
          icon_value, color_value, theme_color_index, is_archived, archived_at, deleted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'icon', ?, ?, ?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT(sync_id) DO UPDATE SET sync_version = excluded.sync_version, name = excluded.name,
          institution_name = excluded.institution_name, visual_value = excluded.visual_value,
          icon_value = excluded.icon_value, color_value = excluded.color_value,
          theme_color_index = excluded.theme_color_index, is_archived = excluded.is_archived,
          archived_at = excluded.archived_at, deleted_at = NULL, updated_at = excluded.updated_at;`,
        syncId, event.version, p.name as string, p.institutionName as string, p.iconValue as string,
        p.iconValue as string, p.colorValue as string, p.themeColorIndex as number | null,
        asBooleanInteger(p.isArchived), p.archivedAt as string | null, p.createdAt as string, p.updatedAt as string,
      );
      return;
    case 'category':
      await db.runAsync(
        `INSERT INTO categories (sync_id, sync_version, name, monthly_budget_cents, visual_type, visual_value,
          icon_value, color_value, theme_color_index, deleted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'icon', ?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT(sync_id) DO UPDATE SET sync_version = excluded.sync_version, name = excluded.name,
          monthly_budget_cents = excluded.monthly_budget_cents, visual_value = excluded.visual_value,
          icon_value = excluded.icon_value, color_value = excluded.color_value,
          theme_color_index = excluded.theme_color_index, deleted_at = NULL, updated_at = excluded.updated_at;`,
        syncId, event.version, p.name as string, p.monthlyBudgetCents as number, p.iconValue as string,
        p.iconValue as string, p.colorValue as string, p.themeColorIndex as number | null,
        p.createdAt as string, p.updatedAt as string,
      );
      return;
    case 'transaction': {
      const accountId = await localId(db, 'accounts', p.accountSyncId);
      const destinationId = await optionalLocalId(db, 'accounts', p.destinationAccountSyncId);
      const categoryId = await optionalLocalId(db, 'categories', p.categorySyncId);
      await db.runAsync(
        `INSERT INTO transactions (sync_id, sync_version, kind, account_id, destination_account_id,
          category_id, name, description, amount_cents, transaction_date, deleted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT(sync_id) DO UPDATE SET sync_version = excluded.sync_version, kind = excluded.kind,
          account_id = excluded.account_id, destination_account_id = excluded.destination_account_id,
          category_id = excluded.category_id, name = excluded.name, description = excluded.description,
          amount_cents = excluded.amount_cents, transaction_date = excluded.transaction_date,
          deleted_at = NULL, updated_at = excluded.updated_at;`,
        syncId, event.version, p.kind as string, accountId, destinationId, categoryId,
        p.name as string, p.description as string | null, p.amountCents as number,
        p.transactionDate as string, p.createdAt as string, p.updatedAt as string,
      );
      return;
    }
    case 'recurring_rule': {
      const accountId = await localId(db, 'accounts', p.accountSyncId);
      const categoryId = await optionalLocalId(db, 'categories', p.categorySyncId);
      await db.runAsync(
        `INSERT INTO recurring_rules (sync_id, sync_version, kind, account_id, category_id, name,
          description, amount_cents, frequency, charge_day, charge_month, start_date, end_date,
          is_active, deleted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
         ON CONFLICT(sync_id) DO UPDATE SET sync_version = excluded.sync_version, kind = excluded.kind,
          account_id = excluded.account_id, category_id = excluded.category_id, name = excluded.name,
          description = excluded.description, amount_cents = excluded.amount_cents,
          frequency = excluded.frequency, charge_day = excluded.charge_day,
          charge_month = excluded.charge_month, start_date = excluded.start_date,
          end_date = excluded.end_date, is_active = excluded.is_active, deleted_at = NULL,
          updated_at = excluded.updated_at;`,
        syncId, event.version, p.kind as string, accountId, categoryId, p.name as string,
        p.description as string | null, p.amountCents as number, p.frequency as string,
        p.chargeDay as number, p.chargeMonth as number | null, p.startDate as string,
        p.endDate as string | null, asBooleanInteger(p.isActive), p.createdAt as string, p.updatedAt as string,
      );
      await db.runAsync(
        'DELETE FROM recurrence_processing_checkpoints WHERE recurring_rule_sync_id = ?;',
        syncId,
      );
      return;
    }
    case 'recurring_occurrence': {
      const ruleId = await localId(db, 'recurring_rules', p.recurringRuleSyncId);
      const transactionId = await optionalLocalId(db, 'transactions', p.transactionSyncId);
      await db.runAsync(
        `INSERT INTO recurring_occurrences (sync_id, sync_version, recurring_rule_id, scheduled_date,
          transaction_id, deleted_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?)
         ON CONFLICT(sync_id) DO UPDATE SET sync_version = excluded.sync_version,
          recurring_rule_id = excluded.recurring_rule_id, scheduled_date = excluded.scheduled_date,
          transaction_id = excluded.transaction_id, deleted_at = NULL;`,
        syncId, event.version, ruleId, p.scheduledDate as string, transactionId, p.createdAt as string,
      );
    }
  }
}

async function localId(db: RepositorySession, table: string, syncId: unknown): Promise<number> {
  if (!isString(syncId)) throw new Error('Missing synchronized relation.');
  const row = await db.getFirstAsync<{ id: number }>(`SELECT id FROM ${table} WHERE sync_id = ?;`, syncId);
  if (!row) throw new Error(`Synchronized relation ${syncId} is unavailable.`);
  return row.id;
}

async function optionalLocalId(db: RepositorySession, table: string, syncId: unknown): Promise<number | null> {
  return syncId === null ? null : localId(db, table, syncId);
}

function tableFor(kind: SyncEntityKind): string {
  return {
    account: 'accounts', category: 'categories', transaction: 'transactions',
    recurring_rule: 'recurring_rules', recurring_occurrence: 'recurring_occurrences',
  }[kind];
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function asBooleanInteger(value: unknown): number {
  return value === true || value === 1 ? 1 : 0;
}
