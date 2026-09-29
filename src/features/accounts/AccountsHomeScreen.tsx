import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Button,
  Card,
  EntityVisual,
  FormFeedback,
  getIconDisplayValue,
  PressableCard,
  resolveThemeColorValue,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  Text,
  useReducedMotion,
  useSuccessFeedback,
} from '@/components';
import { listAccounts, listArchivedAccounts, unarchiveAccount } from '@/db/repositories';
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
  const { showSuccess } = useSuccessFeedback();
  const [accounts, setAccounts] = useState<readonly Account[] | null>(null);
  const [archivedAccounts, setArchivedAccounts] = useState<readonly Account[] | null>(null);
  const [error, setError] = useState(false);
  const [unarchiveError, setUnarchiveError] = useState<string | null>(null);
  const [unarchivingAccountId, setUnarchivingAccountId] = useState<number | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const [loadedAccounts, loadedArchivedAccounts] = await Promise.all([
        listAccounts(database),
        listArchivedAccounts(database),
      ]);
      setAccounts(loadedAccounts);
      setArchivedAccounts(loadedArchivedAccounts);
      setError(false);
      if (loadedAccounts.length === 0 && loadedArchivedAccounts.length === 0) {
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

  if (accounts === null || archivedAccounts === null) return <ScreenState message="Buscando suas contas…" status="loading" title="Carregando contas" />;

  function confirmUnarchive(account: Account) {
    Alert.alert(
      `Desarquivar “${account.name}”?`,
      'A conta voltará a aparecer e aceitar lançamentos e transferências. As recorrências pausadas no arquivamento continuarão pausadas; retome cada uma no Histórico e escolha como tratar o período sem lançamentos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desarquivar', onPress: () => void unarchive(account) },
      ],
    );
  }

  async function unarchive(account: Account) {
    setUnarchivingAccountId(account.id);
    setUnarchiveError(null);
    try {
      const restored = await unarchiveAccount(database, account.id);
      if (!restored) throw new Error('Account was not archived.');
      await loadAccounts();
      showSuccess('Conta desarquivada. As recorrências continuam pausadas.');
    } catch {
      setUnarchiveError('Não foi possível desarquivar a conta. Tente novamente.');
    } finally {
      setUnarchivingAccountId(null);
    }
  }

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
        {archivedAccounts.length > 0 ? (
          <View style={styles.archivedSection}>
            <Text variant="title">Contas arquivadas</Text>
            <Text tone="muted">Desarquivar devolve a conta às telas do aplicativo. As recorrências pausadas permanecem assim até você retomá-las no Histórico.</Text>
            {unarchiveError ? <FormFeedback message={unarchiveError} title="Não foi possível desarquivar" /> : null}
            <View style={styles.list}>
              {archivedAccounts.map((account) => (
                <Card key={account.id}>
                  <View style={styles.archivedAccount}>
                    <AccountCard account={account} />
                    <Button
                      disabled={unarchivingAccountId !== null}
                      label={unarchivingAccountId === account.id ? 'Desarquivando…' : 'Desarquivar'}
                      onPress={() => confirmUnarchive(account)}
                      variant="secondary"
                    />
                  </View>
                </Card>
              ))}
            </View>
          </View>
        ) : null}
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
        <EntityVisual backgroundColor={resolveThemeColorValue(account.backgroundColorValue, account.backgroundThemeColorIndex, tokens.primaryContainer)} iconColor={resolveThemeColorValue(account.colorValue, account.themeColorIndex, tokens.primary)} iconValue={getIconDisplayValue(account.iconValue)} />
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
  archivedAccount: { gap: 12 },
  archivedSection: { gap: 12 },
  content: { gap: 24 },
  list: { gap: 12 },
});
