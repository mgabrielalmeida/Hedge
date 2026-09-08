import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Button,
  Card,
  getAccountIconSymbol,
  resolveThemeColorValue,
  scheduleAfterSecondaryTransition,
  Screen,
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
  const { tokens } = useTheme();
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

  if (accounts === null) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={tokens.primary} size="large" />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen style={styles.centered}>
        <Text variant="title">Não foi possível carregar suas contas</Text>
        <Button label="Tentar novamente" onPress={() => void loadAccounts()} style={{ marginTop: tokens.spacing.lg }} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View>
          <Text variant="heading">Suas contas</Text>
        </View>
        <View style={styles.list}>
          {accounts.map((account) => (
            <Pressable
              accessibilityLabel={`Editar conta ${account.name}`}
              accessibilityRole="button"
              key={account.id}
              onPress={() => onEditAccount(account.id)}
            >
              <AccountCard account={account} />
            </Pressable>
          ))}
        </View>
        <Button label="Adicionar conta" onPress={onCreateAccount} />
      </View>
    </Screen>
  );
}

function AccountCard({ account }: { account: Account }) {
  const { tokens } = useTheme();
  const symbol = getAccountIconSymbol(account.iconValue);

  return (
    <Card>
      <View style={styles.accountRow}>
        <View style={[
          styles.indicator,
          {
            backgroundColor: resolveThemeColorValue(account.colorValue, account.themeColorIndex, tokens.primary),
            borderRadius: tokens.radius.md,
          },
        ]}>
          <Text style={{ color: tokens.onPrimary }}>{symbol}</Text>
        </View>
        <View style={styles.accountText}>
          <Text variant="title">{account.name}</Text>
          <Text tone="muted" variant="caption">{account.institutionName}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  accountRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  accountText: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 24, justifyContent: 'center' },
  indicator: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  list: { gap: 12 },
});
