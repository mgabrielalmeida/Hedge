import { SQLiteProvider } from 'expo-sqlite';
import { Stack } from 'expo-router';

import { DATABASE_NAME, initializeDatabase } from '@/db/database';
import { ThemeProvider } from '@/theme/ThemeProvider';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </SQLiteProvider>
  );
}
