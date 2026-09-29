import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import AsyncStorage from 'expo-sqlite/kv-store';

import {
  copyPreparedBackupToDatabase,
  prepareBackupRestore,
} from './backup';
import { DATABASE_NAME, initializeDatabase } from './database';
import { loadThemePreferences, saveThemePreferences, type ThemePreferences } from './preferences';

const LOCAL_PROFILES_KEY = 'database.localProfiles.v1';
const DEFAULT_PROFILE_NAME = 'Perfil local';

export type LocalProfile = {
  readonly profileId: string;
  readonly ledgerId: string;
  readonly generation: number;
  readonly databaseName: string;
  readonly displayName: string;
};

type LocalProfileRow = {
  profile_id: string;
  ledger_id: string;
  generation: number;
};

type LocalProfileRegistry = {
  readonly activeDatabaseName: string;
  readonly profiles: readonly LocalProfile[];
};

export type ProfileStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

export type ProfileDatabase = SQLiteDatabase;

export type ProfileDependencies = {
  readonly initialize: (database: ProfileDatabase, databaseName: string) => Promise<void>;
  readonly open: (databaseName: string) => Promise<ProfileDatabase>;
  readonly storage: ProfileStorage;
};

export type LocalRecoveryDependencies = ProfileDependencies & {
  readonly loadPreferences: () => Promise<ThemePreferences>;
  readonly savePreferences: (preferences: ThemePreferences) => Promise<void>;
};

const defaultDependencies: ProfileDependencies = {
  initialize: async (database, databaseName) => initializeDatabase(database, {
    createRecoveryCopy: true,
    databaseName,
  }),
  open: async (databaseName) => openDatabaseAsync(databaseName, { useNewConnection: true }),
  storage: AsyncStorage,
};

const defaultRecoveryDependencies: LocalRecoveryDependencies = {
  ...defaultDependencies,
  loadPreferences: loadThemePreferences,
  savePreferences: saveThemePreferences,
};

export async function loadActiveDatabaseName(
  storage: ProfileStorage = AsyncStorage,
): Promise<string> {
  return (await loadRegistry(storage)).activeDatabaseName;
}

export async function listLocalProfiles(
  storage: ProfileStorage = AsyncStorage,
): Promise<readonly LocalProfile[]> {
  return (await loadRegistry(storage)).profiles;
}

export async function registerLocalProfile(
  database: ProfileDatabase,
  databaseName: string,
  displayName?: string,
  storage: ProfileStorage = AsyncStorage,
): Promise<LocalProfile> {
  const identity = await readLocalProfile(database);
  const registry = await loadRegistry(storage);
  const existing = registry.profiles.find((item) => item.databaseName === databaseName);
  const profile = {
    ...identity,
    databaseName,
    displayName: validateDisplayName(displayName ?? existing?.displayName ?? DEFAULT_PROFILE_NAME),
  };
  const conflict = registry.profiles.find(
    (item) => item.profileId === profile.profileId && item.databaseName !== databaseName,
  );
  if (conflict) throw new Error('A local profile identity is already assigned to another database.');

  const profiles = existing
    ? registry.profiles.map((item) => item.databaseName === databaseName ? profile : item)
    : [...registry.profiles, profile];
  await saveRegistry({ ...registry, profiles }, storage);
  return profile;
}

export async function createLocalProfile(
  displayName: string,
  dependencies: ProfileDependencies = defaultDependencies,
): Promise<LocalProfile> {
  const databaseName = `hedge-profile-${randomUUID()}.db`;
  const database = await dependencies.open(databaseName);
  try {
    await dependencies.initialize(database, databaseName);
    return await registerLocalProfile(
      database,
      databaseName,
      displayName,
      dependencies.storage,
    );
  } finally {
    await database.closeAsync();
  }
}

/**
 * Restores into an unregistered database file and changes the registry only
 * after that file has been migrated and verified. The previous generation is
 * deliberately kept untouched for interrupted-recovery safety.
 */
export async function restoreLocalProfileBackup(
  activeProfile: LocalProfile,
  backupBytes: Uint8Array,
  dependencies: LocalRecoveryDependencies = defaultRecoveryDependencies,
): Promise<LocalProfile> {
  const prepared = await prepareBackupRestore(backupBytes, activeProfile);
  const databaseName = `hedge-profile-${randomUUID()}.db`;
  let database: ProfileDatabase | null = null;
  let restored: LocalProfile | null = null;
  let currentPreferences: ThemePreferences;
  try {
    currentPreferences = await dependencies.loadPreferences();
    database = await dependencies.open(databaseName);
    const nextGeneration = prepared.isLinkedToProfile ? activeProfile.generation + 1 : 1;
    const identity = await copyPreparedBackupToDatabase(
      prepared,
      database,
      databaseName,
      nextGeneration,
    );
    if (prepared.isLinkedToProfile && (
      identity.profileId !== activeProfile.profileId || identity.ledgerId !== activeProfile.ledgerId
    )) {
      throw new Error('Restored profile identity does not match the active profile.');
    }
    restored = { ...identity, databaseName, displayName: activeProfile.displayName };
    await dependencies.savePreferences(prepared.preferences);
  } finally {
    await database?.closeAsync();
    await prepared.database.closeAsync();
  }
  if (!restored) throw new Error('The restored local profile could not be prepared.');

  const registry = await loadRegistry(dependencies.storage);
  try {
    const profiles = prepared.isLinkedToProfile
      ? registry.profiles.map((profile) => profile.profileId === activeProfile.profileId ? restored! : profile)
      : [...registry.profiles, restored];
    await saveRegistry({ activeDatabaseName: databaseName, profiles }, dependencies.storage);
  } catch (error) {
    await dependencies.savePreferences(currentPreferences);
    throw error;
  }
  return restored;
}

export async function prepareLocalProfileSwitch(
  profileId: string,
  dependencies: ProfileDependencies = defaultDependencies,
): Promise<LocalProfile> {
  const registry = await loadRegistry(dependencies.storage);
  const stored = registry.profiles.find((profile) => profile.profileId === profileId);
  if (!stored) throw new Error('Local profile was not found.');

  const database = await dependencies.open(stored.databaseName);
  let profile: LocalProfile | null = null;
  try {
    await dependencies.initialize(database, stored.databaseName);
    await assertDatabaseIntegrity(database);
    const identity = await readLocalProfile(database);
    if (identity.profileId !== profileId) {
      throw new Error('Local profile identity does not match its registry entry.');
    }
    profile = { ...identity, databaseName: stored.databaseName, displayName: stored.displayName };
  } finally {
    await database.closeAsync();
  }
  if (!profile) throw new Error('Local profile could not be prepared.');

  await saveRegistry({
    activeDatabaseName: stored.databaseName,
    profiles: registry.profiles.map((item) => item.profileId === profileId ? profile : item),
  }, dependencies.storage);
  return profile;
}

export async function readLocalProfile(database: ProfileDatabase): Promise<Omit<LocalProfile, 'databaseName' | 'displayName'>> {
  const row = await database.getFirstAsync<LocalProfileRow>(
    'SELECT profile_id, ledger_id, generation FROM local_profile WHERE id = 1;',
  );
  if (!row || !isIdentifier(row.profile_id) || !isIdentifier(row.ledger_id)
    || !Number.isSafeInteger(row.generation) || row.generation < 1) {
    throw new Error('Local profile metadata is missing or invalid.');
  }
  return { profileId: row.profile_id, ledgerId: row.ledger_id, generation: row.generation };
}

async function assertDatabaseIntegrity(database: ProfileDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check;');
  if (row?.quick_check !== 'ok') {
    throw new Error('Local profile database failed its integrity check.');
  }
}

async function loadRegistry(storage: ProfileStorage): Promise<LocalProfileRegistry> {
  const raw = await storage.getItem(LOCAL_PROFILES_KEY);
  if (raw === null) return { activeDatabaseName: DATABASE_NAME, profiles: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isRegistry(parsed)) return parsed;
  } catch {
    // The explicit error below prevents silently opening the wrong profile.
  }
  throw new Error('The local profile registry is invalid.');
}

async function saveRegistry(registry: LocalProfileRegistry, storage: ProfileStorage): Promise<void> {
  await storage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(registry));
}

function isRegistry(value: unknown): value is LocalProfileRegistry {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LocalProfileRegistry>;
  if (typeof candidate.activeDatabaseName !== 'string'
    || !isDatabaseName(candidate.activeDatabaseName)
    || !Array.isArray(candidate.profiles)) return false;

  const profiles = candidate.profiles;
  if (!profiles.every((profile) => isLocalProfile(profile))) return false;
  if (new Set(profiles.map((item) => item.profileId)).size !== profiles.length) return false;
  if (new Set(profiles.map((item) => item.databaseName)).size !== profiles.length) return false;
  if (new Set(profiles.map((item) => item.ledgerId)).size !== profiles.length) return false;
  return profiles.length === 0
    ? candidate.activeDatabaseName === DATABASE_NAME
    : profiles.some((item) => item.databaseName === candidate.activeDatabaseName);
}

function isLocalProfile(value: unknown): value is LocalProfile {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LocalProfile>;
  return typeof item.profileId === 'string' && isIdentifier(item.profileId)
    && typeof item.databaseName === 'string' && isDatabaseName(item.databaseName)
    && typeof item.displayName === 'string' && item.displayName.trim().length > 0
    && item.displayName.length <= 80
    && typeof item.ledgerId === 'string' && isIdentifier(item.ledgerId)
    && typeof item.generation === 'number'
    && Number.isSafeInteger(item.generation) && item.generation > 0;
}

function isIdentifier(value: string): boolean {
  return value.trim().length > 0 && value.length <= 200;
}

function isDatabaseName(value: string): boolean {
  return /^hedge(?:-profile-[0-9a-f-]+)?\.db$/i.test(value);
}

function validateDisplayName(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 80) throw new Error('Invalid local profile name.');
  return name;
}
