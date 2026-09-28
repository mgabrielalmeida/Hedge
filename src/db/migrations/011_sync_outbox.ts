import type { Migration } from './migration';

export const syncOutboxMigration: Migration = {
  version: 11,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE sync_confirmed_entities (
        entity_kind TEXT NOT NULL CHECK (entity_kind IN ('account', 'category', 'transaction', 'recurring_rule', 'recurring_occurrence')),
        entity_sync_id TEXT NOT NULL CHECK (length(trim(entity_sync_id)) > 0),
        operation TEXT NOT NULL CHECK (operation IN ('upsert', 'tombstone')),
        version INTEGER NOT NULL CHECK (version >= 0),
        payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (entity_kind, entity_sync_id)
      ) STRICT;

      CREATE TABLE sync_outbox (
        command_id TEXT PRIMARY KEY CHECK (length(trim(command_id)) > 0),
        entity_kind TEXT NOT NULL CHECK (entity_kind IN ('account', 'category', 'transaction', 'recurring_rule', 'recurring_occurrence')),
        entity_sync_id TEXT NOT NULL CHECK (length(trim(entity_sync_id)) > 0),
        operation TEXT NOT NULL CHECK (operation IN ('upsert', 'tombstone')),
        expected_version INTEGER CHECK (expected_version IS NULL OR expected_version >= 0),
        depends_on_json TEXT NOT NULL CHECK (json_valid(depends_on_json) AND json_type(depends_on_json) = 'array'),
        payload_json TEXT NOT NULL CHECK (json_valid(payload_json) AND json_type(payload_json) = 'object'),
        state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'leased', 'rejected')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        lease_token TEXT,
        lease_expires_at TEXT,
        rejection_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK ((state = 'leased') = (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
        CHECK ((state = 'rejected') = (rejection_code IS NOT NULL))
      ) STRICT;

      CREATE INDEX sync_outbox_ready ON sync_outbox(state, created_at, command_id);
      CREATE INDEX sync_outbox_by_entity ON sync_outbox(entity_kind, entity_sync_id, created_at, command_id);

      CREATE TABLE sync_receipts (
        command_id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
        entity_version INTEGER CHECK (entity_version IS NULL OR entity_version >= 0),
        rejection_code TEXT,
        received_at TEXT NOT NULL,
        CHECK (
          (status = 'accepted' AND entity_version IS NOT NULL AND rejection_code IS NULL) OR
          (status = 'rejected' AND entity_version IS NULL AND rejection_code IS NOT NULL)
        )
      ) STRICT;

      CREATE TABLE sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        cursor_value TEXT,
        updated_at TEXT NOT NULL
      ) STRICT;

      INSERT INTO sync_state (id, cursor_value, updated_at)
      VALUES (1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

      CREATE TABLE sync_applied_events (
        event_id TEXT PRIMARY KEY CHECK (length(trim(event_id)) > 0),
        cursor_value TEXT NOT NULL CHECK (length(trim(cursor_value)) > 0),
        applied_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE sync_conflicts (
        id INTEGER PRIMARY KEY,
        command_id TEXT NOT NULL UNIQUE,
        entity_kind TEXT NOT NULL,
        entity_sync_id TEXT NOT NULL,
        reason TEXT NOT NULL CHECK (reason IN ('version_mismatch', 'dependency_rejected', 'generation_closed')),
        command_json TEXT NOT NULL CHECK (json_valid(command_json)),
        current_event_json TEXT NOT NULL CHECK (json_valid(current_event_json)),
        created_at TEXT NOT NULL,
        resolved_at TEXT
      ) STRICT;

      INSERT INTO sync_outbox (
        command_id, entity_kind, entity_sync_id, operation, expected_version,
        depends_on_json, payload_json, created_at, updated_at
      )
      SELECT lower(hex(randomblob(16))), 'account', sync_id,
        CASE WHEN deleted_at IS NULL THEN 'upsert' ELSE 'tombstone' END,
        sync_version, json_array(),
        json_object(
          'name', name, 'institutionName', institution_name, 'iconValue', icon_value,
          'colorValue', color_value, 'themeColorIndex', theme_color_index,
          'isArchived', is_archived, 'archivedAt', archived_at,
          'createdAt', created_at, 'updatedAt', updated_at
        ),
        updated_at, updated_at
      FROM accounts;

      INSERT INTO sync_outbox (
        command_id, entity_kind, entity_sync_id, operation, expected_version,
        depends_on_json, payload_json, created_at, updated_at
      )
      SELECT lower(hex(randomblob(16))), 'category', sync_id,
        CASE WHEN deleted_at IS NULL THEN 'upsert' ELSE 'tombstone' END,
        sync_version, json_array(),
        json_object(
          'name', name, 'monthlyBudgetCents', monthly_budget_cents,
          'iconValue', icon_value, 'colorValue', color_value,
          'themeColorIndex', theme_color_index, 'createdAt', created_at, 'updatedAt', updated_at
        ),
        updated_at, updated_at
      FROM categories;

      INSERT INTO sync_outbox (
        command_id, entity_kind, entity_sync_id, operation, expected_version,
        depends_on_json, payload_json, created_at, updated_at
      )
      SELECT lower(hex(randomblob(16))), 'recurring_rule', r.sync_id,
        CASE WHEN r.deleted_at IS NULL THEN 'upsert' ELSE 'tombstone' END,
        r.sync_version,
        json_array(
          (SELECT command_id FROM sync_outbox WHERE entity_kind = 'account' AND entity_sync_id = a.sync_id ORDER BY created_at DESC, command_id DESC LIMIT 1),
          CASE WHEN c.sync_id IS NULL THEN NULL ELSE (SELECT command_id FROM sync_outbox WHERE entity_kind = 'category' AND entity_sync_id = c.sync_id ORDER BY created_at DESC, command_id DESC LIMIT 1) END
        ),
        json_object(
          'kind', r.kind, 'accountSyncId', a.sync_id, 'categorySyncId', c.sync_id,
          'name', r.name, 'description', r.description, 'amountCents', r.amount_cents,
          'frequency', r.frequency, 'chargeDay', r.charge_day, 'chargeMonth', r.charge_month,
          'startDate', r.start_date, 'endDate', r.end_date, 'isActive', r.is_active,
          'deletedAt', r.deleted_at, 'createdAt', r.created_at, 'updatedAt', r.updated_at
        ),
        r.updated_at, r.updated_at
      FROM recurring_rules r
      JOIN accounts a ON a.id = r.account_id
      LEFT JOIN categories c ON c.id = r.category_id;

      INSERT INTO sync_outbox (
        command_id, entity_kind, entity_sync_id, operation, expected_version,
        depends_on_json, payload_json, created_at, updated_at
      )
      SELECT lower(hex(randomblob(16))), 'transaction', t.sync_id,
        CASE WHEN t.deleted_at IS NULL THEN 'upsert' ELSE 'tombstone' END,
        t.sync_version,
        json_array(
          (SELECT command_id FROM sync_outbox WHERE entity_kind = 'account' AND entity_sync_id = a.sync_id ORDER BY created_at DESC, command_id DESC LIMIT 1),
          CASE WHEN d.sync_id IS NULL THEN NULL ELSE (SELECT command_id FROM sync_outbox WHERE entity_kind = 'account' AND entity_sync_id = d.sync_id ORDER BY created_at DESC, command_id DESC LIMIT 1) END,
          CASE WHEN c.sync_id IS NULL THEN NULL ELSE (SELECT command_id FROM sync_outbox WHERE entity_kind = 'category' AND entity_sync_id = c.sync_id ORDER BY created_at DESC, command_id DESC LIMIT 1) END
        ),
        json_object(
          'kind', t.kind, 'accountSyncId', a.sync_id, 'destinationAccountSyncId', d.sync_id,
          'categorySyncId', c.sync_id, 'name', t.name, 'description', t.description,
          'amountCents', t.amount_cents, 'transactionDate', t.transaction_date,
          'createdAt', t.created_at, 'updatedAt', t.updated_at
        ),
        t.updated_at, t.updated_at
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      LEFT JOIN accounts d ON d.id = t.destination_account_id
      LEFT JOIN categories c ON c.id = t.category_id;

      INSERT INTO sync_outbox (
        command_id, entity_kind, entity_sync_id, operation, expected_version,
        depends_on_json, payload_json, created_at, updated_at
      )
      SELECT lower(hex(randomblob(16))), 'recurring_occurrence', o.sync_id,
        CASE WHEN o.deleted_at IS NULL THEN 'upsert' ELSE 'tombstone' END,
        o.sync_version,
        json_array(
          (SELECT command_id FROM sync_outbox WHERE entity_kind = 'recurring_rule' AND entity_sync_id = r.sync_id ORDER BY created_at DESC, command_id DESC LIMIT 1),
          CASE WHEN t.sync_id IS NULL THEN NULL ELSE (SELECT command_id FROM sync_outbox WHERE entity_kind = 'transaction' AND entity_sync_id = t.sync_id ORDER BY created_at DESC, command_id DESC LIMIT 1) END
        ),
        json_object(
          'recurringRuleSyncId', r.sync_id, 'scheduledDate', o.scheduled_date,
          'transactionSyncId', t.sync_id, 'createdAt', o.created_at
        ),
        o.created_at, o.created_at
      FROM recurring_occurrences o
      JOIN recurring_rules r ON r.id = o.recurring_rule_id
      LEFT JOIN transactions t ON t.id = o.transaction_id;

      UPDATE sync_outbox
      SET depends_on_json = (
        SELECT json_group_array(value)
        FROM json_each(sync_outbox.depends_on_json)
        WHERE value IS NOT NULL
      );
    `);
  },
};
