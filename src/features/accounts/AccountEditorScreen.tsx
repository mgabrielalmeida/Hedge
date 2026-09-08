import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  useReducedMotion,
} from '@/components';
import { archiveAccount, findAccountById, getAccountBalance } from '@/db/repositories';
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
      <ScreenState actionLabel="Voltar" message={error} onAction={onDone} status="error" />
    );
  }

  if (!data) {
    return <ScreenState message="Buscando os dados da conta…" status="loading" title="Carregando conta" />;
  }

  return (
    <ScrollableScreen>
        <ScreenHeader onBack={onDone} title="Editar conta" />
        <Card elevated>
          <View style={styles.form}>
            <AccountForm
              account={data.account}
              currentBalanceCents={data.currentBalanceCents}
              onSaved={onDone}
            />
            <Button
              label="Arquivar conta"
              onPress={() => Alert.alert(
                'Arquivar esta conta?',
                'O histórico e as transferências serão preservados, mas a conta deixará de aparecer no aplicativo. Novos lançamentos serão bloqueados e recorrências associadas serão desativadas.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Arquivar', style: 'destructive', onPress: () => void archiveAccount(database, accountId).then(onDone).catch(() => setError('Não foi possível arquivar a conta.')) },
                ],
              )}
              variant="destructive"
            />
            <Button label="Cancelar" onPress={onDone} variant="ghost" />
          </View>
        </Card>
    </ScrollableScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8 },
});
