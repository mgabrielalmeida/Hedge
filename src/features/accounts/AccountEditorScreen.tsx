import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  scheduleAfterSecondaryTransition,
  Screen,
  Text,
  useReducedMotion,
} from '@/components';
import { findAccountById, getAccountBalance } from '@/db/repositories';
import type { Account, Cents } from '@/domain';

import { AccountForm } from './AccountForm';

type AccountEditorScreenProps = {
  accountId: number;
  onDone: () => void;
};

type AccountEditorData = {
  account: Account;
  currentBalanceCents: Cents;
};

export function AccountEditorScreen({ accountId, onDone }: AccountEditorScreenProps) {
  const database = useSQLiteContext();
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<AccountEditorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const cancel = scheduleAfterSecondaryTransition(() => {
      void Promise.all([
        findAccountById(database, accountId),
        getAccountBalance(database, accountId),
      ]).then(([account, currentBalanceCents]) => {
        if (!active) return;
        if (!account || currentBalanceCents === null) {
          setError('Conta não encontrada.');
          return;
        }
        setData({ account, currentBalanceCents });
      }).catch(() => {
        if (active) setError('Não foi possível carregar a conta.');
      });
    }, reduceMotion === false);
    return () => {
      active = false;
      cancel();
    };
  }, [accountId, database, reduceMotion]);

  if (error) {
    return (
      <Screen style={styles.centered}>
        <Text tone="negative">{error}</Text>
        <Button label="Voltar" onPress={onDone} style={styles.back} variant="ghost" />
      </Screen>
    );
  }

  if (!data) {
    return <Screen style={styles.centered}><Text tone="muted">Carregando conta…</Text></Screen>;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading">Editar conta</Text>
        <Card elevated>
          <View style={styles.form}>
            <AccountForm
              account={data.account}
              currentBalanceCents={data.currentBalanceCents}
              onSaved={onDone}
            />
            <Button label="Cancelar" onPress={onDone} variant="ghost" />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 8 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  content: { gap: 20, paddingVertical: 24 },
  form: { gap: 8 },
});
