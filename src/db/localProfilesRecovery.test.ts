import {
  loadActiveDatabaseName,
  registerLocalProfile,
  restoreLocalProfileBackup,
  type LocalRecoveryDependencies,
  type ProfileDatabase,
  type ProfileStorage,
} from './localProfiles';
import { copyPreparedBackupToDatabase, prepareBackupRestore } from './backup';

jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000099' }));
jest.mock('./backup', () => ({ copyPreparedBackupToDatabase: jest.fn(), prepareBackupRestore: jest.fn() }));

const mockedPrepare = jest.mocked(prepareBackupRestore);
const mockedCopy = jest.mocked(copyPreparedBackupToDatabase);

describe('local backup recovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the previous registry selection when isolated recovery is interrupted', async () => {
    const storage = createStorage();
    const active = await registerLocalProfile(profileDatabase('profile-a', 'ledger-a'), 'hedge.db', 'Principal', storage);
    const before = storage.contents();
    const prepared = { database: { closeAsync: jest.fn().mockResolvedValue(undefined) }, preferences: {}, profile: {}, isLinkedToProfile: true };
    mockedPrepare.mockResolvedValue(prepared as never);
    mockedCopy.mockRejectedValue(new Error('copy interrupted'));
    const dependencies = recoveryDependencies(storage);

    await expect(restoreLocalProfileBackup(active, new Uint8Array([1]), dependencies)).rejects.toThrow('copy interrupted');
    expect(storage.contents()).toEqual(before);
    await expect(loadActiveDatabaseName(storage)).resolves.toBe('hedge.db');
    expect(prepared.database.closeAsync).toHaveBeenCalled();
  });

  it('switches only after a linked backup becomes a verified new generation', async () => {
    const storage = createStorage();
    const active = await registerLocalProfile(profileDatabase('profile-a', 'ledger-a'), 'hedge.db', 'Principal', storage);
    const prepared = { database: { closeAsync: jest.fn().mockResolvedValue(undefined) }, preferences: { restored: true }, profile: {}, isLinkedToProfile: true };
    mockedPrepare.mockResolvedValue(prepared as never);
    mockedCopy.mockResolvedValue({ profileId: 'profile-a', ledgerId: 'ledger-a', generation: 2 });
    const dependencies = recoveryDependencies(storage);

    const restored = await restoreLocalProfileBackup(active, new Uint8Array([1]), dependencies);

    expect(restored.generation).toBe(2);
    expect(restored.databaseName).not.toBe('hedge.db');
    await expect(loadActiveDatabaseName(storage)).resolves.toBe(restored.databaseName);
    expect(dependencies.savePreferences).toHaveBeenCalledWith(prepared.preferences);
  });
});

function recoveryDependencies(storage: ProfileStorage): LocalRecoveryDependencies {
  return {
    initialize: jest.fn(),
    loadPreferences: jest.fn().mockResolvedValue({ current: true }),
    open: jest.fn().mockResolvedValue({ closeAsync: jest.fn().mockResolvedValue(undefined) }),
    savePreferences: jest.fn().mockResolvedValue(undefined),
    storage,
  } as never;
}

function createStorage(): ProfileStorage & { contents: () => Readonly<Record<string, string>> } {
  const values = new Map<string, string>();
  return {
    contents: () => Object.fromEntries(values),
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
  };
}

function profileDatabase(profileId: string, ledgerId: string): ProfileDatabase {
  return {
    getFirstAsync: jest.fn(async () => ({ profile_id: profileId, ledger_id: ledgerId, generation: 1 })),
  } as unknown as ProfileDatabase;
}
