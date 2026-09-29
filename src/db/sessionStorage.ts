import AsyncStorage from 'expo-sqlite/kv-store';

/**
 * Narrow adapter for the non-financial key/value storage used by encrypted
 * sessions. Keeping this import in `src/db` preserves the database boundary.
 */
export type SessionStorage = Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;

export const sessionStorage: SessionStorage = AsyncStorage;
