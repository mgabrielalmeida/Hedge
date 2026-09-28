import type { Migration } from './migration';

export const localProfileMigration: Migration = {
  version: 10,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE local_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        profile_id TEXT NOT NULL UNIQUE CHECK (length(trim(profile_id)) > 0),
        ledger_id TEXT NOT NULL UNIQUE CHECK (length(trim(ledger_id)) > 0),
        generation INTEGER NOT NULL DEFAULT 1 CHECK (generation > 0),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      INSERT INTO local_profile (id, profile_id, ledger_id, generation)
      VALUES (1, lower(hex(randomblob(16))), lower(hex(randomblob(16))), 1);

      CREATE TRIGGER local_profile_keep_identity
      BEFORE UPDATE OF profile_id, ledger_id ON local_profile
      WHEN OLD.profile_id <> NEW.profile_id OR OLD.ledger_id <> NEW.ledger_id
      BEGIN SELECT RAISE(ABORT, 'local profile identity is immutable'); END;

      CREATE TRIGGER local_profile_singleton_insert
      BEFORE INSERT ON local_profile WHEN NEW.id <> 1
      BEGIN SELECT RAISE(ABORT, 'local profile must be a singleton'); END;

      CREATE TRIGGER local_profile_prevent_delete
      BEFORE DELETE ON local_profile
      BEGIN SELECT RAISE(ABORT, 'local profile cannot be deleted'); END;
    `);
  },
};
