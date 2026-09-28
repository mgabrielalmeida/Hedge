import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import type { ReactNode } from 'react';

import { DATABASE_NAME, initializeDatabase } from './database';

export function DatabaseProvider({ children, onError }: {
  readonly children: ReactNode;
  readonly onError?: (error: Error) => void;
}) {
  return <SQLiteProvider databaseName={DATABASE_NAME} onError={onError} onInit={initializeDatabase}>{children}</SQLiteProvider>;
}

export function useDatabase() {
  return useSQLiteContext();
}
