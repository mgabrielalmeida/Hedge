import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  DatePickerField,
  FadeSelection,
  MoneyField,
  scheduleAfterSecondaryTransition,
  Screen,
  Text,
  useReducedMotion,
} from '@/components';
import {
  createTransaction,
  deleteTransaction,
  findTransactionById,
  listAccounts,
  updateTransaction,
} from '@/db/repositories';
import {
  formatBrazilianMoneyInput,
  parseCivilDate,
  parseMoneyInput,
  validateNotFuture,
} from '@/domain';
import type { Account, TransferTransaction } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';
import { getLocalCivilDate } from '@/utils/localCivilDate';

type TransferScreenProps = {
  deferInitialLoad?: boolean;
  onDone: () => void;
  transactionId?: number;
};

export function TransferScreen({ deferInitialLoad = true, onDone, transactionId }: TransferScreenProps) {
  const db = useSQLiteContext();
  const reduceMotion = useReducedMotion();
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState<number | null>(null);
  const [destinationAccountId, setDestinationAccountId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalCivilDate());
  const [existing, setExisting] = useState<TransferTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const cancel = scheduleAfterSecondaryTransition(() => {
      void Promise.all([
        listAccounts(db),
        transactionId ? findTransactionById(db, transactionId) : Promise.resolve(null),
      ])
        .then(([loadedAccounts, item]) => {
          if (!active) return;
          setAccounts(loadedAccounts);
          if (item?.kind === 'transfer') {
            setExisting(item);
            setSourceAccountId(item.accountId);
            setDestinationAccountId(item.destinationAccountId);
            setAmount(formatBrazilianMoneyInput(Math.abs(item.amountCents)));
            setDate(item.transactionDate);
          } else if (!transactionId && loadedAccounts.length >= 2) {
            setSourceAccountId(loadedAccounts[0].id);
            setDestinationAccountId(loadedAccounts[1].id);
          }
        })
        .catch(() => {
          if (active) setLoadFailed(true);
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    }, deferInitialLoad && reduceMotion === false);
    return () => {
      active = false;
      cancel();
    };
  }, [db, deferInitialLoad, reduceMotion, transactionId]);

  function selectSource(id: number) {
    setSourceAccountId(id);
    if (destinationAccountId === id) setDestinationAccountId(null);
  }

  function selectDestination(id: number) {
    setDestinationAccountId(id);
    if (sourceAccountId === id) setSourceAccountId(null);
  }

  async function save() {
    const money = parseMoneyInput(amount.replace(/\./g, ''));
    const civil = parseCivilDate(date);
    const dateIsAllowed = civil.ok && validateNotFuture(civil.value, getLocalCivilDate()).ok;

    if (
      !money.ok ||
      money.value <= 0 ||
      !civil.ok ||
      !dateIsAllowed ||
      sourceAccountId === null ||
      destinationAccountId === null ||
      sourceAccountId === destinationAccountId
    ) {
      setError('Preencha origem, destino, valor maior que zero e uma data que não seja futura.');
      return;
    }

    setSaving(true);
    try {
      const input = {
        kind: 'transfer',
        accountId: sourceAccountId,
        destinationAccountId,
        categoryId: null,
        name: existing?.name ?? 'Transferência',
        description: existing?.description ?? null,
        amountCents: -money.value,
        transactionDate: civil.value,
      } as const;
      if (existing) await updateTransaction(db, existing.id, input);
      else await createTransaction(db, input);
      onDone();
    } catch {
      setError('Não foi possível salvar a transferência.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    try {
      await deleteTransaction(db, existing.id);
      onDone();
    } catch {
      setError('Não foi possível excluir a transferência.');
    }
  }

  if (isLoading) {
    return <Screen style={styles.center}><Text tone="muted">Carregando transferência…</Text></Screen>;
  }

  if (loadFailed) {
    return <Screen style={styles.center}><Text tone="negative">Não foi possível carregar as contas.</Text></Screen>;
  }

  if (accounts.length < 2) {
    return (
      <Screen>
        <View style={styles.unavailable}>
          <Text variant="heading">Nova transferência</Text>
          <Card>
            <Text variant="title">São necessárias duas contas</Text>
            <Text tone="muted">Cadastre outra conta antes de transferir dinheiro.</Text>
          </Card>
          <Button label="Voltar" onPress={onDone} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading">{existing ? 'Editar' : 'Nova'} transferência</Text>
        <Card elevated>
          <View style={styles.form}>
            {error ? <Text tone="negative">{error}</Text> : null}
            <AccountChoices
              accounts={accounts}
              label="Origem"
              onSelect={selectSource}
              selectedId={sourceAccountId}
            />
            <AccountChoices
              accounts={accounts}
              label="Destino"
              onSelect={selectDestination}
              selectedId={destinationAccountId}
            />
            <MoneyField label="Valor" onChangeText={setAmount} value={amount} placeholder="0,00" />
            <DatePickerField
              label="Data"
              onChange={setDate}
              value={date}
            />
            <Button disabled={saving} label={saving ? 'Salvando…' : 'Salvar'} onPress={() => void save()} />
            {existing ? (
              <Button
                label="Excluir transferência"
                onPress={() => Alert.alert(
                  'Excluir transferência?',
                  'Esta ação remove a transferência e atualiza o saldo das duas contas.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Excluir', style: 'destructive', onPress: () => void remove() },
                  ],
                )}
                variant="destructive"
              />
            ) : null}
            <Button label="Cancelar" onPress={onDone} variant="ghost" />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function AccountChoices({
  accounts,
  label,
  onSelect,
  selectedId,
}: {
  accounts: readonly Account[];
  label: string;
  onSelect: (id: number) => void;
  selectedId: number | null;
}) {
  const { tokens } = useTheme();
  return (
    <View>
      <Text tone="muted" variant="caption" style={{ marginBottom: tokens.spacing.sm }}>{label}</Text>
      <FadeSelection selectionKey={selectedId}>
        <View style={styles.choices}>
          {accounts.map((account) => {
            const selected = selectedId === account.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={account.id}
                onPress={() => onSelect(account.id)}
                style={[
                  styles.choice,
                  {
                    backgroundColor: selected ? tokens.primary : tokens.surface,
                    borderColor: selected ? tokens.primary : tokens.border,
                  },
                ]}
              >
                <Text variant="caption" style={{ color: selected ? tokens.onPrimary : tokens.text }}>
                  {account.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FadeSelection>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  choice: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  content: { gap: 20, paddingVertical: 24 },
  form: { gap: 16 },
  unavailable: { gap: 20, paddingVertical: 24 },
});
