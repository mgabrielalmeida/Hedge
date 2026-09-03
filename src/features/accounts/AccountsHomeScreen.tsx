import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Screen, Text } from '@/components';
import { listAccounts } from '@/db/repositories';
import type { Account } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

type AccountsHomeScreenProps = {
  onCreateAccount: () => void;
  onManageCategories: () => void;
  onNoAccounts: () => void;
};

export function AccountsHomeScreen({ onCreateAccount, onManageCategories, onNoAccounts }: AccountsHomeScreenProps) {
  const database = useSQLiteContext();
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

  useFocusEffect(useCallback(() => {
    void loadAccounts();
  }, [loadAccounts]));

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
          <Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>
            Escolha uma conta quando registrar seus próximos lançamentos.
          </Text>
        </View>
        <View style={styles.list}>
          {accounts.map((account) => <AccountCard account={account} key={account.id} />)}
        </View>
        <Button label="Adicionar conta" onPress={onCreateAccount} />
        <Button label="Gerenciar categorias" onPress={onManageCategories} variant="secondary" />
      </View>
    </Screen>
  );
}

function AccountCard({ account }: { account: Account }) {
  const { tokens } = useTheme();
  const symbol = account.visualType === 'icon' ? iconSymbol(account.visualValue) : '';

  return (
    <Card>
      <View style={styles.accountRow}>
        <View style={[
          styles.indicator,
          {
            backgroundColor: account.visualType === 'color' ? account.visualValue : tokens.primary,
            borderRadius: tokens.radius.md,
          },
        ]}>
          {symbol ? <Text style={{ color: tokens.onPrimary }}>{symbol}</Text> : null}
        </View>
        <View style={styles.accountText}>
          <Text variant="title">{account.name}</Text>
          <Text tone="muted" variant="caption">{account.institutionName}</Text>
        </View>
      </View>
    </Card>
  );
}

function iconSymbol(value: string): string {
  return ({
    bank: '🏦', wallet: '👛', card: '💳', cash: '💵', savings: '🐷', coins: '🪙',
    mobile: '📱', home: '🏠', work: '💼', star: '★',
  } as Record<string, string>)[value] ?? '•';
}

const styles = StyleSheet.create({
  accountRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  accountText: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 24, justifyContent: 'center' },
  indicator: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  list: { gap: 12 },
});
