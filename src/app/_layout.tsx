import { SQLiteProvider } from 'expo-sqlite';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';

import { DATABASE_NAME, initializeDatabase } from '@/db/database';
import { BootstrapScreen } from '@/components/BootstrapScreen';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

function DatabaseContent({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

function AppBootstrap() {
  const { isDark, isReady: isThemeReady, tokens } = useTheme();
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState<Error | null>(null);
  const markDatabaseReady = useCallback(() => setIsDatabaseReady(true), []);
  const handleDatabaseError = useCallback((error: Error) => setDatabaseError(error), []);

  if (!isThemeReady) {
    return (
      <BootstrapScreen
        isDark={isDark}
        isLoading
        message="Carregando suas preferências…"
        title="Hedge"
        tokens={tokens}
      />
    );
  }

  if (databaseError) {
    return (
      <BootstrapScreen
        isDark={isDark}
        message="Não foi possível preparar o armazenamento local. Feche e abra o aplicativo novamente."
        title="Não foi possível abrir o Hedge"
        tokens={tokens}
      />
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!isDatabaseReady ? (
        <BootstrapScreen
          isDark={isDark}
          isLoading
          message="Preparando seu armazenamento local…"
          title="Hedge"
          tokens={tokens}
        />
      ) : null}
      <SQLiteProvider
        databaseName={DATABASE_NAME}
        onError={handleDatabaseError}
        onInit={initializeDatabase}
      >
        <DatabaseContent onReady={markDatabaseReady} />
      </SQLiteProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppBootstrap />
    </ThemeProvider>
  );
}
