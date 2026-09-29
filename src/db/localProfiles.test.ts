import {
  loadActiveDatabaseName,
  prepareLocalProfileSwitch,
  registerLocalProfile,
  type ProfileDatabase,
  type ProfileDependencies,
  type ProfileStorage,
} from './localProfiles';

describe('local profile registry', () => {
  it('keeps the current selection when the destination cannot be prepared', async () => {
    const storage = createStorage();
    await registerLocalProfile(
      profileDatabase('profile-a', 'ledger-a'),
      'hedge.db',
      'Principal',
      storage,
    );
    await registerLocalProfile(
      profileDatabase('profile-b', 'ledger-b'),
      'hedge-profile-00000000-0000-4000-8000-000000000001.db',
      'Reserva',
      storage,
    );
    const before = storage.contents();
    const destination = profileDatabase('profile-b', 'ledger-b');
    const dependencies: ProfileDependencies = {
      initialize: jest.fn().mockRejectedValue(new Error('migration failed')),
      open: jest.fn().mockResolvedValue(destination),
      storage,
    };

    await expect(prepareLocalProfileSwitch('profile-b', dependencies))
      .rejects.toThrow('migration failed');

    expect(storage.contents()).toEqual(before);
    expect(destination.closeAsync).toHaveBeenCalled();
    await expect(loadActiveDatabaseName(storage)).resolves.toBe('hedge.db');
  });

  it('commits the selection only after validating the destination identity', async () => {
    const storage = createStorage();
    await registerLocalProfile(
      profileDatabase('profile-a', 'ledger-a'),
      'hedge.db',
      'Principal',
      storage,
    );
    const targetName = 'hedge-profile-00000000-0000-4000-8000-000000000001.db';
    await registerLocalProfile(
      profileDatabase('profile-b', 'ledger-b'),
      targetName,
      'Reserva',
      storage,
    );
    const events: string[] = [];
    const destination = profileDatabase('profile-b', 'ledger-b', events);
    const dependencies: ProfileDependencies = {
      initialize: jest.fn(async () => { events.push('initialized'); }),
      open: jest.fn(async () => { events.push('opened'); return destination; }),
      storage: {
        getItem: storage.getItem,
        setItem: jest.fn(async (key: string, value: string) => {
          events.push('selected');
          await storage.setItem(key, value);
        }),
      },
    };

    await expect(prepareLocalProfileSwitch('profile-b', dependencies)).resolves.toEqual({
      databaseName: targetName,
      displayName: 'Reserva',
      generation: 1,
      ledgerId: 'ledger-b',
      profileId: 'profile-b',
    });

    expect(events).toEqual(['opened', 'initialized', 'closed', 'selected']);
    await expect(loadActiveDatabaseName(storage)).resolves.toBe(targetName);
  });

  it('rejects a registry identity that does not match the opened database', async () => {
    const storage = createStorage();
    await registerLocalProfile(
      profileDatabase('profile-a', 'ledger-a'),
      'hedge.db',
      'Principal',
      storage,
    );
    const targetName = 'hedge-profile-00000000-0000-4000-8000-000000000001.db';
    await registerLocalProfile(
      profileDatabase('profile-b', 'ledger-b'),
      targetName,
      'Reserva',
      storage,
    );
    const before = storage.contents();
    const dependencies: ProfileDependencies = {
      initialize: jest.fn().mockResolvedValue(undefined),
      open: jest.fn().mockResolvedValue(profileDatabase('different', 'ledger-b')),
      storage,
    };

    await expect(prepareLocalProfileSwitch('profile-b', dependencies))
      .rejects.toThrow('does not match');
    expect(storage.contents()).toEqual(before);
  });

  it('rejects a database with the same profile id but a different ledger or generation', async () => {
    const storage = createStorage();
    const targetName = 'hedge-profile-00000000-0000-4000-8000-000000000001.db';
    await registerLocalProfile(profileDatabase('profile-a', 'ledger-a'), 'hedge.db', 'Principal', storage);
    await registerLocalProfile(profileDatabase('profile-b', 'ledger-b'), targetName, 'Reserva', storage);
    const before = storage.contents();
    const replacement = profileDatabase('profile-b', 'another-ledger');
    const dependencies: ProfileDependencies = {
      initialize: jest.fn().mockResolvedValue(undefined),
      open: jest.fn().mockResolvedValue(replacement),
      storage,
    };

    await expect(prepareLocalProfileSwitch('profile-b', dependencies)).rejects.toThrow('does not match');
    expect(storage.contents()).toEqual(before);
  });

  it('rejects a corrupted registry instead of opening an ambiguous profile', async () => {
    const duplicated = {
      activeDatabaseName: 'hedge.db',
      profiles: [
        profileRecord('profile-a', 'ledger-a', 'hedge.db'),
        profileRecord('profile-a', 'ledger-b', 'hedge-profile-00000000-0000-4000-8000-000000000001.db'),
      ],
    };
    const storage = createStorage({
      'database.localProfiles.v1': JSON.stringify(duplicated),
    });

    await expect(loadActiveDatabaseName(storage)).rejects.toThrow('registry is invalid');
  });
});

function createStorage(initial: Readonly<Record<string, string>> = {}): ProfileStorage & { contents: () => Readonly<Record<string, string>> } {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    contents: () => Object.fromEntries(values),
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
  };
}

function profileRecord(profileId: string, ledgerId: string, databaseName: string) {
  return {
    databaseName,
    displayName: 'Perfil',
    generation: 1,
    ledgerId,
    profileId,
  };
}

function profileDatabase(
  profileId: string,
  ledgerId: string,
  events: string[] = [],
): ProfileDatabase {
  return {
    closeAsync: jest.fn(async () => { events.push('closed'); }),
    getFirstAsync: jest.fn(async (source: string) => source.includes('quick_check')
      ? { quick_check: 'ok' }
      : {
        generation: 1,
        ledger_id: ledgerId,
        profile_id: profileId,
      }),
  } as unknown as ProfileDatabase;
}
