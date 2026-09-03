import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { BootstrapScreen } from '@/components';
import { listAccounts } from '@/db/repositories';
import { FirstAccessScreen } from '@/features/accounts/FirstAccessScreen';
import { useTheme } from '@/theme/ThemeProvider';

export default function OnboardingRoute() {
  const database = useSQLiteContext();
  const router = useRouter();
  const { isDark, tokens } = useTheme();
  const [hasExistingAccount, setHasExistingAccount] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  const checkAccounts = useCallback(async () => {
    try {
      const accounts = await listAccounts(database);
      setHasExistingAccount(accounts.length > 0);
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
      router.replace('/');
    }
  }, [hasExistingAccount, router]);

  if (failed) {
    return <BootstrapScreen isDark={isDark} message="Não foi possível abrir suas contas. Feche e abra o aplicativo novamente." title="Erro ao abrir o Hedge" tokens={tokens} />;
  }

  if (hasExistingAccount !== false) {
    return <BootstrapScreen isDark={isDark} isLoading message="Verificando suas contas…" title="Hedge" tokens={tokens} />;
  }

  return <FirstAccessScreen onFinish={() => router.replace('/')} />;
}
