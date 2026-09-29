import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { BootstrapScreen } from '@/components';
import { listAccounts, listArchivedAccounts } from '@/db/repositories';
import { FirstAccessScreen } from '@/features/accounts/FirstAccessScreen';
import { useTheme } from '@/theme/ThemeProvider';

export default function OnboardingRoute() {
  const database = useSQLiteContext();
  const router = useRouter();
  const { isDark, tokens } = useTheme();
  const [hasExistingAccount, setHasExistingAccount] = useState<boolean | null>(null);
  const [hasArchivedAccount, setHasArchivedAccount] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  const checkAccounts = useCallback(async () => {
    try {
      const [accounts, archivedAccounts] = await Promise.all([
        listAccounts(database),
        listArchivedAccounts(database),
      ]);
      setHasExistingAccount(accounts.length > 0);
      setHasArchivedAccount(archivedAccounts.length > 0);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [database]);

  useFocusEffect(useCallback(() => {
    void checkAccounts();
  }, [checkAccounts]));

  useEffect(() => {
    if (hasExistingAccount) {
      router.replace('/' as never);
      return;
    }
    if (hasArchivedAccount) {
      router.replace('/accounts' as never);
    }
  }, [hasArchivedAccount, hasExistingAccount, router]);

  if (failed) {
    return <BootstrapScreen isDark={isDark} message="Não foi possível abrir suas contas. Tente novamente; se a falha continuar, feche e abra o aplicativo." onRetry={() => void checkAccounts()} title="Erro ao abrir o Hedge" tokens={tokens} />;
  }

  if (hasExistingAccount !== false || hasArchivedAccount !== false) {
    return <BootstrapScreen isDark={isDark} isLoading message="Verificando suas contas…" title="Hedge" tokens={tokens} />;
  }

  return <FirstAccessScreen onFinish={() => router.replace('/' as never)} />;
}
