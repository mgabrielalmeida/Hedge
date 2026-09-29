import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { initializeDatabase } from './database';
import {
  createLocalProfile,
  listLocalProfiles,
  loadActiveDatabaseName,
  prepareLocalProfileSwitch,
  registerLocalProfile,
  restoreLocalProfileBackup,
  type LocalProfile,
} from './localProfiles';

type LocalProfileContextValue = {
  readonly activeProfile: LocalProfile | null;
  readonly createProfile: (displayName: string) => Promise<LocalProfile>;
  readonly profiles: readonly LocalProfile[];
  readonly restoreBackup: (backupBytes: Uint8Array) => Promise<void>;
  readonly switchProfile: (profileId: string) => Promise<void>;
};

const LocalProfileContext = createContext<LocalProfileContextValue | null>(null);

export function DatabaseProvider({ children, onError }: {
  readonly children: ReactNode;
  readonly onError?: (error: Error) => void;
}) {
  const [databaseName, setDatabaseName] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<LocalProfile | null>(null);
  const [profiles, setProfiles] = useState<readonly LocalProfile[]>([]);

  useEffect(() => {
    let isCurrent = true;
    loadActiveDatabaseName()
      .then((name) => { if (isCurrent) setDatabaseName(name); })
      .catch((error: unknown) => {
        if (isCurrent) onError?.(asError(error));
      });
    return () => { isCurrent = false; };
  }, [onError]);

  const initializeActiveDatabase = useCallback(async (database: SQLiteDatabase) => {
    if (!databaseName) throw new Error('No local profile database was selected.');
    await initializeDatabase(database, { createRecoveryCopy: true, databaseName });
    const registered = await registerLocalProfile(database, databaseName);
    setActiveProfile(registered);
    setProfiles(await listLocalProfiles());
  }, [databaseName]);

  const switchProfile = useCallback(async (profileId: string) => {
    const profile = await prepareLocalProfileSwitch(profileId);
    setProfiles((current) => current.map((item) => item.profileId === profileId ? profile : item));
    if (profile.databaseName === databaseName) {
      setActiveProfile(profile);
      return;
    }
    setActiveProfile(null);
    setDatabaseName(profile.databaseName);
  }, [databaseName]);

  const createProfile = useCallback(async (displayName: string) => {
    const profile = await createLocalProfile(displayName);
    setProfiles((current) => [...current, profile]);
    return profile;
  }, []);

  const restoreBackup = useCallback(async (backupBytes: Uint8Array) => {
    if (!activeProfile) throw new Error('No active local profile is available for restoration.');
    const restored = await restoreLocalProfileBackup(activeProfile, backupBytes);
    setProfiles((current) => current.map((profile) => (
      profile.profileId === restored.profileId ? restored : profile
    )));
    setActiveProfile(null);
    setDatabaseName(restored.databaseName);
  }, [activeProfile]);

  const value = useMemo<LocalProfileContextValue>(() => ({
    activeProfile,
    createProfile,
    profiles,
    restoreBackup,
    switchProfile,
  }), [activeProfile, createProfile, profiles, restoreBackup, switchProfile]);

  if (!databaseName) return null;
  return (
    <LocalProfileContext.Provider value={value}>
      <SQLiteProvider
        databaseName={databaseName}
        key={databaseName}
        onError={onError}
        onInit={initializeActiveDatabase}
      >
        {children}
      </SQLiteProvider>
    </LocalProfileContext.Provider>
  );
}

export function useDatabase() {
  return useSQLiteContext();
}

export function useLocalProfile() {
  const value = useContext(LocalProfileContext);
  if (!value) throw new Error('useLocalProfile must be used inside DatabaseProvider.');
  return value;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Could not load the local profile.');
}
