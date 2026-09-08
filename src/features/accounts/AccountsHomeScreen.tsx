import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Button,
  EntityVisual,
  getIconDisplayValue,
  PressableCard,
  resolveThemeColorValue,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  Text,
  useReducedMotion,
} from '@/components';
import { listAccounts } from '@/db/repositories';
import type { Account } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

type AccountsHomeScreenProps = {
  onCreateAccount: () => void;
  onEditAccount: (id: number) => void;
  onNoAccounts: () => void;
};

export function AccountsHomeScreen({ onCreateAccount, onEditAccount, onNoAccounts }: AccountsHomeScreenProps) {
  const database = useSQLiteContext();
  const reduceMotion = useReducedMotion();
  const [accounts, setAccounts] = useState<readonly Account[] | null>(null);
  const [error, setError] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const loadedAccounts = await listAccounts(database);
      setAccounts(loadedAccounts);
      setError(false);
      if (loadedAccounts.length === 0) {
        onNoAccounts();
      }
    } catch {
      setError(true);
    }
  }, [database, onNoAccounts]);

  useFocusEffect(useCallback(() => (
    scheduleAfterSecondaryTransition(() => void loadAccounts(), reduceMotion === false)
  ), [loadAccounts, reduceMotion]));

  if (error) {
    return (
      <ScreenState actionLabel="Tentar novamente" message="Não foi possível carregar suas contas." onAction={() => void loadAccounts()} status="error" />
    );
  }

  if (accounts === null) return <ScreenState message="Buscando suas contas…" status="loading" title="Carregando contas" />;

  return (
    <ScrollableScreen>
      <View style={styles.content}>
        <ScreenHeader title="Suas contas" />
        <View style={styles.list}>
          {accounts.map((account) => (
            <PressableCard
              accessibilityLabel={`Editar conta ${account.name}`}
              key={account.id}
              onPress={() => onEditAccount(account.id)}
            >
              <AccountCard account={account} />
            </PressableCard>
          ))}
        </View>
        <Button label="Adicionar conta" onPress={onCreateAccount} />
      </View>
    </ScrollableScreen>
  );
}

function AccountCard({ account }: { account: Account }) {
  const { tokens } = useTheme();
  return (
    <View>
      <View style={styles.accountRow}>
        <EntityVisual color={resolveThemeColorValue(account.colorValue, account.themeColorIndex, tokens.primary)} iconValue={getIconDisplayValue(account.iconValue)} />
        <View style={styles.accountText}>
          <Text variant="title">{account.name}</Text>
          <Text tone="muted" variant="caption">{account.institutionName}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accountRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  accountText: { flex: 1 },
  content: { gap: 24 },
  list: { gap: 12 },
});
