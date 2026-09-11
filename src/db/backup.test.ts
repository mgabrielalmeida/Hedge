import { backupDatabaseAsync, deserializeDatabaseAsync } from 'expo-sqlite';

import { initializeDatabase } from './database';
import { BackupError, createBackupBytes, restoreBackupBytes } from './backup';
import { runMigrations } from './migrate';
import {
  loadThemePreferences,
  saveThemePreferences,
  type ThemePreferences,
} from './preferences';

jest.mock('expo-sqlite', () => ({
  backupDatabaseAsync: jest.fn(),
  deserializeDatabaseAsync: jest.fn(),
}));
jest.mock('./database', () => ({ initializeDatabase: jest.fn() }));
jest.mock('./migrate', () => ({ runMigrations: jest.fn() }));
jest.mock('./migrations', () => ({ migrations: Array.from({ length: 7 }) }));
jest.mock('./preferences', () => {
  const actual = jest.requireActual('./preferences');
  return {
    ...actual,
    loadThemePreferences: jest.fn(),
    saveThemePreferences: jest.fn(),
  };
});

const preferences: ThemePreferences = {
  appearance: 'dark',
  customTheme: { primary: '#A23E2D', secondary: '#70458A' },
  hideBalances: true,
  themeName: 'custom',
};

const mockedDeserialize = jest.mocked(deserializeDatabaseAsync);
const mockedBackup = jest.mocked(backupDatabaseAsync);
const mockedInitialize = jest.mocked(initializeDatabase);
const mockedRunMigrations = jest.mocked(runMigrations);
const mockedLoadPreferences = jest.mocked(loadThemePreferences);
const mockedSavePreferences = jest.mocked(saveThemePreferences);

describe('backup database orchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLoadPreferences.mockResolvedValue(preferences);
    mockedSavePreferences.mockResolvedValue();
    mockedInitialize.mockResolvedValue();
    mockedRunMigrations.mockResolvedValue();
    mockedBackup.mockResolvedValue();
  });

  it('exports a serialized database with versioned metadata and preferences', async () => {
    const sourceBytes = new Uint8Array([1, 2]);
    const outputBytes = new Uint8Array([3, 4]);
    const database = { serializeAsync: jest.fn().mockResolvedValue(sourceBytes) };
    const backupDatabase = {
      closeAsync: jest.fn().mockResolvedValue(undefined),
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 7 }),
      runAsync: jest.fn().mockResolvedValue(undefined),
      serializeAsync: jest.fn().mockResolvedValue(outputBytes),
    };
    mockedDeserialize.mockResolvedValue(backupDatabase as never);
    const createdAt = new Date('2026-09-11T12:00:00.000Z');

    await expect(createBackupBytes(database as never, createdAt)).resolves.toBe(outputBytes);

    expect(mockedDeserialize).toHaveBeenCalledWith(sourceBytes);
    expect(backupDatabase.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO __hedge_backup_metadata_v1'),
      'com.hedge.backup',
      1,
      createdAt.toISOString(),
      7,
      JSON.stringify(preferences),
    );
    expect(backupDatabase.closeAsync).toHaveBeenCalled();
  });

  it('validates, migrates and restores both database and preferences', async () => {
    const incoming = createIncomingBackup();
    const currentBytes = new Uint8Array([9]);
    const database = { serializeAsync: jest.fn().mockResolvedValue(currentBytes) };
    mockedDeserialize.mockResolvedValue(incoming as never);

    await expect(restoreBackupBytes(database as never, new Uint8Array([1]))).resolves.toEqual(preferences);

    expect(incoming.execAsync).toHaveBeenCalledWith('DROP TABLE __hedge_backup_metadata_v1;');
    expect(mockedRunMigrations).toHaveBeenCalledWith(incoming);
    expect(mockedBackup).toHaveBeenCalledWith({
      destDatabase: database,
      sourceDatabase: incoming,
    });
    expect(mockedInitialize).toHaveBeenCalledWith(database);
    expect(mockedSavePreferences).toHaveBeenCalledWith(preferences);
    expect(incoming.closeAsync).toHaveBeenCalled();
  });

  it('restores the previous state when applying preferences fails', async () => {
    const incoming = createIncomingBackup();
    const rollback = { closeAsync: jest.fn().mockResolvedValue(undefined) };
    const currentBytes = new Uint8Array([9]);
    const database = { serializeAsync: jest.fn().mockResolvedValue(currentBytes) };
    mockedDeserialize
      .mockResolvedValueOnce(incoming as never)
      .mockResolvedValueOnce(rollback as never);
    mockedSavePreferences
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce();

    await expect(
      restoreBackupBytes(database as never, new Uint8Array([1])),
    ).rejects.toEqual(expect.objectContaining({ code: 'restore-failed' }));

    expect(mockedBackup).toHaveBeenNthCalledWith(2, {
      destDatabase: database,
      sourceDatabase: rollback,
    });
    expect(mockedSavePreferences).toHaveBeenLastCalledWith(preferences);
    expect(rollback.closeAsync).toHaveBeenCalled();
  });

  it('rejects backups created by a newer format before changing data', async () => {
    const incoming = createIncomingBackup({ format_version: 2 });
    mockedDeserialize.mockResolvedValue(incoming as never);

    await expect(
      restoreBackupBytes({} as never, new Uint8Array([1])),
    ).rejects.toEqual(expect.objectContaining<Partial<BackupError>>({ code: 'newer-backup' }));

    expect(mockedBackup).not.toHaveBeenCalled();
    expect(incoming.closeAsync).toHaveBeenCalled();
  });
});

function createIncomingBackup(overrides: Partial<Record<string, unknown>> = {}) {
  const metadata = {
    created_at: '2026-09-11T12:00:00.000Z',
    format: 'com.hedge.backup',
    format_version: 1,
    preferences_json: JSON.stringify(preferences),
    schema_version: 7,
    ...overrides,
  };

  return {
    closeAsync: jest.fn().mockResolvedValue(undefined),
    execAsync: jest.fn().mockResolvedValue(undefined),
    getFirstAsync: jest.fn(async (source: string) => {
      if (source.includes('quick_check')) return { quick_check: 'ok' };
      if (source.includes('user_version')) return { user_version: 7 };
      return metadata;
    }),
  };
}
