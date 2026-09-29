import { backupDatabaseAsync, deserializeDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';

import {
  BackupError,
  copyPreparedBackupToDatabase,
  createBackupBytes,
  prepareBackupRestore,
} from './backup';
import { initializeDatabase } from './database';
import { runMigrations } from './migrate';
import { loadThemePreferences, type ThemePreferences } from './preferences';

jest.mock('expo-sqlite', () => ({ backupDatabaseAsync: jest.fn(), deserializeDatabaseAsync: jest.fn(), openDatabaseAsync: jest.fn() }));
jest.mock('./database', () => ({ initializeDatabase: jest.fn() }));
jest.mock('./migrate', () => ({ runMigrations: jest.fn() }));
jest.mock('./migrations', () => ({ migrations: Array.from({ length: 12 }) }));
jest.mock('./preferences', () => ({ ...jest.requireActual('./preferences'), loadThemePreferences: jest.fn() }));

const preferences: ThemePreferences = {
  appearance: 'dark', customTheme: { primary: '#A23E2D', secondary: '#70458A' }, hideBalances: true, themeName: 'custom',
};
const mockBackup = jest.mocked(backupDatabaseAsync);
const mockDeserialize = jest.mocked(deserializeDatabaseAsync);
const mockOpen = jest.mocked(openDatabaseAsync);
const mockInitialize = jest.mocked(initializeDatabase);
const mockMigrations = jest.mocked(runMigrations);
const mockPreferences = jest.mocked(loadThemePreferences);

describe('backup isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBackup.mockResolvedValue(); mockInitialize.mockResolvedValue(); mockMigrations.mockResolvedValue(); mockPreferences.mockResolvedValue(preferences);
  });

  it('exports financial data without queue, cursor, receipts, conflicts, or session data', async () => {
    const backup = fakeDatabase([{ user_version: 12 }, profile('profile-a', 'ledger-a', 2)]);
    backup.serializeAsync = jest.fn().mockResolvedValue(new Uint8Array([1]));
    mockOpen.mockResolvedValue(backup as never);

    await createBackupBytes({} as never, new Date('2026-09-29T12:00:00.000Z'));

    expect(backup.execAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM sync_outbox'));
    expect(backup.execAsync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM sync_conflicts'));
    expect(backup.execAsync).toHaveBeenCalledWith(expect.stringContaining('UPDATE sync_state SET cursor_value = NULL'));
    expect(backup.runAsync).toHaveBeenCalledWith(expect.stringContaining('profile_id, ledger_id, generation'),
      'com.hedge.backup', 2, '2026-09-29T12:00:00.000Z', 12, JSON.stringify(preferences), 'profile-a', 'ledger-a', 2);
  });

  it('rejects a newer or malformed backup before any destination is copied', async () => {
    const incoming = fakeIncoming({ format_version: 3 });
    mockDeserialize.mockResolvedValue(incoming as never);

    await expect(prepareBackupRestore(new Uint8Array([1]))).rejects.toEqual(expect.objectContaining<Partial<BackupError>>({ code: 'newer-backup' }));
    expect(mockBackup).not.toHaveBeenCalled();
    expect(incoming.closeAsync).toHaveBeenCalled();
  });

  it('copies only a prepared, verified backup to an isolated destination generation', async () => {
    const incoming = fakeIncoming();
    mockDeserialize.mockResolvedValue(incoming as never);
    const prepared = await prepareBackupRestore(new Uint8Array([1]), { profileId: 'profile-a', ledgerId: 'ledger-a', generation: 1 });
    const destination = fakeDatabase([{ quick_check: 'ok' }, profile('profile-a', 'ledger-a', 2)]);

    await expect(copyPreparedBackupToDatabase(prepared, destination as never, 'hedge-profile-00000000-0000-4000-8000-000000000001.db', 2))
      .resolves.toEqual({ profileId: 'profile-a', ledgerId: 'ledger-a', generation: 2 });

    expect(mockBackup).toHaveBeenCalledWith({ destDatabase: destination, sourceDatabase: incoming });
    expect(mockInitialize).toHaveBeenCalledWith(destination, expect.objectContaining({ createRecoveryCopy: true }));
    expect(destination.runAsync).toHaveBeenCalledWith(expect.stringContaining('generation = ?'), 2);
    await prepared.database.closeAsync();
  });
});

function profile(profileId: string, ledgerId: string, generation: number) {
  return { profile_id: profileId, ledger_id: ledgerId, generation };
}

function fakeIncoming(overrides: Partial<Record<string, unknown>> = {}) {
  const metadata = { created_at: '2026-09-29T12:00:00.000Z', format: 'com.hedge.backup', format_version: 2, preferences_json: JSON.stringify(preferences), schema_version: 12, ...overrides };
  return fakeDatabase([{ quick_check: 'ok' }, metadata, profile('profile-a', 'ledger-a', 1), { user_version: 12 }, metadata, profile('profile-a', 'ledger-a', 1), { quick_check: 'ok' }, profile('profile-a', 'ledger-a', 1)]);
}

function fakeDatabase(responses: unknown[]) {
  return {
    closeAsync: jest.fn().mockResolvedValue(undefined),
    execAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn(async () => responses.shift() ?? null),
    runAsync: jest.fn().mockResolvedValue(undefined),
  } as { closeAsync: jest.Mock; execAsync: jest.Mock; getFirstAsync: jest.Mock; runAsync: jest.Mock; serializeAsync?: jest.Mock };
}
