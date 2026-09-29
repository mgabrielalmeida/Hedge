import type { Migration } from './migration';

export const financialConflictsMigration: Migration = {
  version: 12,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE local_profile ADD COLUMN financial_timezone TEXT
        CHECK (financial_timezone IS NULL OR length(trim(financial_timezone)) > 0);

      CREATE TRIGGER local_profile_keep_financial_timezone
      BEFORE UPDATE OF financial_timezone ON local_profile
      WHEN OLD.financial_timezone IS NOT NULL AND OLD.financial_timezone <> NEW.financial_timezone
      BEGIN SELECT RAISE(ABORT, 'financial timezone is immutable'); END;

      ALTER TABLE accounts ADD COLUMN financial_version INTEGER NOT NULL DEFAULT 0
        CHECK (financial_version >= 0);

      UPDATE accounts
      SET financial_version = (
        SELECT COUNT(*)
        FROM transactions t
        WHERE t.deleted_at IS NULL
          AND (t.account_id = accounts.id OR t.destination_account_id = accounts.id)
      );

      CREATE TRIGGER transactions_increment_financial_version_after_insert
      AFTER INSERT ON transactions WHEN NEW.deleted_at IS NULL
      BEGIN
        UPDATE accounts SET financial_version = financial_version + 1
        WHERE id = NEW.account_id OR id = NEW.destination_account_id;
      END;

      CREATE TRIGGER transactions_increment_financial_version_after_update
      AFTER UPDATE OF kind, account_id, destination_account_id, amount_cents, deleted_at ON transactions
      WHEN OLD.deleted_at IS NULL OR NEW.deleted_at IS NULL
      BEGIN
        UPDATE accounts SET financial_version = financial_version + 1
        WHERE id = OLD.account_id OR id = OLD.destination_account_id
           OR id = NEW.account_id OR id = NEW.destination_account_id;
      END;

      CREATE TRIGGER transactions_increment_financial_version_after_delete
      AFTER DELETE ON transactions WHEN OLD.deleted_at IS NULL
      BEGIN
        UPDATE accounts SET financial_version = financial_version + 1
        WHERE id = OLD.account_id OR id = OLD.destination_account_id;
      END;

      DROP TRIGGER transactions_keep_sync_id;

      CREATE TEMP TABLE recurring_transaction_identity_updates AS
      SELECT t.id AS transaction_id, t.sync_id AS old_sync_id,
        r.sync_id || ':' || o.scheduled_date || ':transaction' AS new_sync_id
      FROM transactions t
      JOIN recurring_occurrences o ON o.transaction_id = t.id
      JOIN recurring_rules r ON r.id = o.recurring_rule_id;

      UPDATE transactions
      SET sync_id = (SELECT new_sync_id FROM recurring_transaction_identity_updates u WHERE u.transaction_id = transactions.id)
      WHERE id IN (SELECT transaction_id FROM recurring_transaction_identity_updates);

      UPDATE sync_outbox
      SET entity_sync_id = (SELECT new_sync_id FROM recurring_transaction_identity_updates u WHERE u.old_sync_id = sync_outbox.entity_sync_id)
      WHERE entity_kind = 'transaction'
        AND entity_sync_id IN (SELECT old_sync_id FROM recurring_transaction_identity_updates);

      UPDATE sync_outbox
      SET payload_json = json_set(
        payload_json,
        '$.transactionSyncId',
        (SELECT new_sync_id FROM recurring_transaction_identity_updates u
         WHERE u.old_sync_id = json_extract(sync_outbox.payload_json, '$.transactionSyncId'))
      )
      WHERE entity_kind = 'recurring_occurrence'
        AND json_extract(payload_json, '$.transactionSyncId') IN (
          SELECT old_sync_id FROM recurring_transaction_identity_updates
        );

      UPDATE sync_confirmed_entities
      SET entity_sync_id = (SELECT new_sync_id FROM recurring_transaction_identity_updates u WHERE u.old_sync_id = sync_confirmed_entities.entity_sync_id)
      WHERE entity_kind = 'transaction'
        AND entity_sync_id IN (SELECT old_sync_id FROM recurring_transaction_identity_updates);

      UPDATE sync_confirmed_entities
      SET payload_json = json_set(
        payload_json,
        '$.transactionSyncId',
        (SELECT new_sync_id FROM recurring_transaction_identity_updates u
         WHERE u.old_sync_id = json_extract(sync_confirmed_entities.payload_json, '$.transactionSyncId'))
      )
      WHERE entity_kind = 'recurring_occurrence'
        AND json_extract(payload_json, '$.transactionSyncId') IN (
          SELECT old_sync_id FROM recurring_transaction_identity_updates
        );

      UPDATE sync_conflicts
      SET entity_sync_id = (SELECT new_sync_id FROM recurring_transaction_identity_updates u WHERE u.old_sync_id = sync_conflicts.entity_sync_id),
        command_json = json_set(
          command_json,
          '$.entity.syncId',
          (SELECT new_sync_id FROM recurring_transaction_identity_updates u WHERE u.old_sync_id = sync_conflicts.entity_sync_id)
        ),
        current_event_json = json_set(
          current_event_json,
          '$.entity.syncId',
          (SELECT new_sync_id FROM recurring_transaction_identity_updates u WHERE u.old_sync_id = sync_conflicts.entity_sync_id)
        )
      WHERE entity_kind = 'transaction'
        AND entity_sync_id IN (SELECT old_sync_id FROM recurring_transaction_identity_updates);

      UPDATE sync_conflicts
      SET command_json = json_set(
          command_json,
          '$.payload.transactionSyncId',
          COALESCE(
            (SELECT new_sync_id FROM recurring_transaction_identity_updates u
             WHERE u.old_sync_id = json_extract(sync_conflicts.command_json, '$.payload.transactionSyncId')),
            json_extract(command_json, '$.payload.transactionSyncId')
          )
        ),
        current_event_json = json_set(
          current_event_json,
          '$.payload.transactionSyncId',
          COALESCE(
            (SELECT new_sync_id FROM recurring_transaction_identity_updates u
             WHERE u.old_sync_id = json_extract(sync_conflicts.current_event_json, '$.payload.transactionSyncId')),
            json_extract(current_event_json, '$.payload.transactionSyncId')
          )
        )
      WHERE entity_kind = 'recurring_occurrence'
        AND (
          json_extract(command_json, '$.payload.transactionSyncId') IN (SELECT old_sync_id FROM recurring_transaction_identity_updates)
          OR json_extract(current_event_json, '$.payload.transactionSyncId') IN (SELECT old_sync_id FROM recurring_transaction_identity_updates)
        );

      DROP TABLE recurring_transaction_identity_updates;

      CREATE TRIGGER transactions_keep_sync_id
      BEFORE UPDATE OF sync_id ON transactions
      WHEN OLD.sync_id IS NOT NULL AND (NEW.sync_id IS NULL OR OLD.sync_id <> NEW.sync_id)
      BEGIN SELECT RAISE(ABORT, 'transactions.sync_id is immutable'); END;

      CREATE TABLE recurrence_processing_batches (
        batch_id TEXT PRIMARY KEY CHECK (length(trim(batch_id)) > 0),
        processing_date TEXT NOT NULL CHECK (
          length(processing_date) = 10 AND
          processing_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        financial_timezone TEXT NOT NULL CHECK (length(trim(financial_timezone)) > 0),
        state TEXT NOT NULL CHECK (state IN ('running', 'interrupted', 'completed')),
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      ) STRICT;

      CREATE UNIQUE INDEX recurrence_processing_batches_by_date
        ON recurrence_processing_batches(processing_date, financial_timezone);

      CREATE TABLE recurrence_processing_checkpoints (
        recurring_rule_sync_id TEXT PRIMARY KEY CHECK (length(trim(recurring_rule_sync_id)) > 0),
        processed_through TEXT NOT NULL CHECK (
          length(processed_through) = 10 AND
          processed_through GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        ),
        batch_id TEXT NOT NULL REFERENCES recurrence_processing_batches(batch_id) ON DELETE RESTRICT,
        updated_at TEXT NOT NULL
      ) STRICT;

      ALTER TABLE sync_conflicts ADD COLUMN review_kind TEXT NOT NULL DEFAULT 'concurrent_edit'
        CHECK (review_kind IN ('concurrent_edit', 'concurrent_delete', 'concurrent_archive', 'concurrent_category'));
      ALTER TABLE sync_conflicts ADD COLUMN resolution TEXT
        CHECK (resolution IS NULL OR resolution IN ('keep_local', 'accept_remote'));

      UPDATE sync_conflicts
      SET review_kind = CASE
        WHEN json_extract(command_json, '$.operation') = 'tombstone'
          OR json_extract(current_event_json, '$.operation') = 'tombstone'
          THEN 'concurrent_delete'
        WHEN entity_kind = 'account'
          AND json_extract(command_json, '$.payload.isArchived')
            IS NOT json_extract(current_event_json, '$.payload.isArchived')
          THEN 'concurrent_archive'
        WHEN entity_kind IN ('transaction', 'recurring_rule')
          AND json_extract(command_json, '$.payload.categorySyncId')
            IS NOT json_extract(current_event_json, '$.payload.categorySyncId')
          THEN 'concurrent_category'
        ELSE 'concurrent_edit'
      END;

      UPDATE sync_outbox
      SET payload_json = json_set(
        payload_json,
        '$.financialVersion',
        (SELECT financial_version FROM accounts WHERE sync_id = sync_outbox.entity_sync_id)
      )
      WHERE entity_kind = 'account';

      UPDATE sync_confirmed_entities
      SET payload_json = json_set(
        payload_json,
        '$.financialVersion',
        COALESCE((SELECT financial_version FROM accounts WHERE sync_id = sync_confirmed_entities.entity_sync_id), 0)
      )
      WHERE entity_kind = 'account';
    `);
  },
};
