import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  FormFeedback,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  useReducedMotion,
  useSuccessFeedback,
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
  const { showSuccess } = useSuccessFeedback();
  const [data, setData] = useState<AccountEditorData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [account, currentBalanceCents] = await Promise.all([
        findAccountById(database, accountId),
        getAccountBalance(database, accountId),
      ]);
      if (!account || currentBalanceCents === null) {
        setLoadError('Conta não encontrada.');
        return;
      }
      setData({ account, currentBalanceCents });
    } catch {
      setLoadError('Não foi possível carregar a conta.');
    }
  }, [accountId, database]);

  useEffect(() => {
    const cancel = scheduleAfterSecondaryTransition(() => {
      void load();
    }, reduceMotion === false);
    return cancel;
  }, [load, reduceMotion]);

  if (loadError) {
    return (
      <ScreenState actionLabel={loadError === 'Conta não encontrada.' ? 'Voltar' : 'Tentar novamente'} message={loadError} onAction={loadError === 'Conta não encontrada.' ? onDone : () => void load()} onSecondaryAction={loadError === 'Conta não encontrada.' ? undefined : onDone} secondaryActionLabel={loadError === 'Conta não encontrada.' ? undefined : 'Voltar'} status={loadError === 'Conta não encontrada.' ? 'notFound' : 'error'} />
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
            {feedback ? <FormFeedback message={feedback} title="Não foi possível arquivar" /> : null}
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
                  { text: 'Arquivar', style: 'destructive', onPress: () => void archiveAccount(database, accountId).then(() => { showSuccess('Conta arquivada.'); onDone(); }).catch(() => setFeedback('A conta não foi arquivada. Tente novamente ou volte sem fazer alterações.')) },
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
