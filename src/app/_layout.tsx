import { SQLiteProvider } from 'expo-sqlite';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router/js-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Easing } from 'react-native';

import { DATABASE_NAME, initializeDatabase } from '@/db/database';
import {
  BootstrapScreen,
  SECONDARY_SCREEN_TRANSITION_DURATION,
  useReducedMotion,
} from '@/components';
import {
  completeSecondaryScreenTransition,
} from '@/components/screenTransition';
import { useRecurringProcessing } from '@/features/transactions/useRecurringProcessing';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

function DatabaseContent({ onReady }: { onReady: () => void }) {
  const { hasFailed, isInitialProcessingComplete, retry } = useRecurringProcessing();
  const reduceMotion = useReducedMotion();
  const { isDark, tokens } = useTheme();
  useEffect(() => {
    if (isInitialProcessingComplete && !hasFailed) onReady();
  }, [hasFailed, isInitialProcessingComplete, onReady]);

  if (hasFailed) {
    return <BootstrapScreen isDark={isDark} message="Não foi possível processar as recorrências vencidas. Seus dados não foram alterados; tente novamente." onRetry={retry} tokens={tokens} title="Falha ao atualizar recorrências" />;
  }

  return isInitialProcessingComplete ? (
    <Stack
      screenListeners={{
        transitionEnd: completeSecondaryScreenTransition,
      }}
      screenOptions={{
        animation: reduceMotion === false ? 'slide_from_right' : 'none',
        cardOverlayEnabled: false,
        cardShadowEnabled: false,
        cardStyle: { backgroundColor: tokens.background },
        detachPreviousScreen: false,
        headerShown: false,
        transitionSpec: reduceMotion === false
          ? {
            close: {
              animation: 'timing',
              config: {
                duration: SECONDARY_SCREEN_TRANSITION_DURATION,
                easing: Easing.out(Easing.cubic),
              },
            },
            open: {
              animation: 'timing',
              config: {
                duration: SECONDARY_SCREEN_TRANSITION_DURATION,
                easing: Easing.out(Easing.cubic),
              },
            },
          }
          : undefined,
      }}
    />
  ) : null;
}

function AppBootstrap() {
  const { isDark, isReady: isThemeReady, tokens } = useTheme();
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState<Error | null>(null);
  const [databaseAttempt, setDatabaseAttempt] = useState(0);
  const markDatabaseReady = useCallback(() => setIsDatabaseReady(true), []);
  const handleDatabaseError = useCallback((error: Error) => setDatabaseError(error), []);
  const retryDatabase = useCallback(() => {
    setDatabaseError(null);
    setIsDatabaseReady(false);
    setDatabaseAttempt((attempt) => attempt + 1);
  }, []);

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
        message="Não foi possível preparar o armazenamento local. Tente novamente; se a falha continuar, feche e abra o aplicativo."
        onRetry={retryDatabase}
        title="Não foi possível abrir o Hedge"
        tokens={tokens}
      />
    );
  }

  return (
    <>
      <NavigationBar hidden={false} style={isDark ? 'dark' : 'light'} />
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
        key={databaseAttempt}
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
