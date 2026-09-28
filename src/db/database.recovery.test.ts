import { backupDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';

import { initializeDatabase, recoveryDatabaseName } from './database';
import { runMigrations } from './migrate';

jest.mock('expo-sqlite', () => ({
  backupDatabaseAsync: jest.fn(),
  openDatabaseAsync: jest.fn(),
}));
jest.mock('./migrate', () => ({ runMigrations: jest.fn() }));

const mockedBackup = jest.mocked(backupDatabaseAsync);
const mockedOpen = jest.mocked(openDatabaseAsync);
const mockedMigrate = jest.mocked(runMigrations);

describe('pre-identity recovery copy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('copies a legacy database to a durable recovery file before migrating it', async () => {
    const events: string[] = [];
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 8 }),
    };
    const recovery = {
      closeAsync: jest.fn(async () => { events.push('closed'); }),
      getFirstAsync: jest.fn(async () => ({ quick_check: 'ok' })),
    };
    mockedOpen.mockImplementation(async () => {
      events.push('opened');
      return recovery as never;
    });
    mockedBackup.mockImplementation(async () => { events.push('copied'); });
    mockedMigrate.mockImplementation(async () => { events.push('migrated'); });

    await initializeDatabase(database as never, {
      createRecoveryCopy: true,
      databaseName: 'hedge.db',
    });

    expect(mockedOpen).toHaveBeenCalledWith(
      'hedge.pre-global-identity.v8.recovery.db',
      { useNewConnection: true },
    );
    expect(mockedBackup).toHaveBeenCalledWith({
      destDatabase: recovery,
      sourceDatabase: database,
    });
    expect(recovery.getFirstAsync).toHaveBeenCalledWith('PRAGMA quick_check;');
    expect(events).toEqual(['opened', 'copied', 'closed', 'migrated']);
  });

  it('does not create a recovery file for a new or already migrated database', async () => {
    for (const version of [0, 9, 10]) {
      const database = {
        execAsync: jest.fn().mockResolvedValue(undefined),
        getFirstAsync: jest.fn().mockResolvedValue({ user_version: version }),
      };
      await initializeDatabase(database as never, {
        createRecoveryCopy: true,
        databaseName: 'hedge.db',
      });
    }

    expect(mockedOpen).not.toHaveBeenCalled();
  });

  it('derives a profile-specific recovery name without changing directories', () => {
    expect(recoveryDatabaseName('hedge-profile-abc.db'))
      .toBe('hedge-profile-abc.pre-global-identity.v8.recovery.db');
  });
});
