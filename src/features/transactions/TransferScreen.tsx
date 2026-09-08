import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  ChipGroup,
  DatePickerField,
  FadeSelection,
  FormFeedback,
  MoneyField,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  SelectableChip,
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showFieldErrors, setShowFieldErrors] = useState(false);

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
  }, [db, deferInitialLoad, loadAttempt, reduceMotion, transactionId]);

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
      setShowFieldErrors(true);
      setError('Os campos destacados precisam ser corrigidos antes de salvar.');
      return;
    }

    setSaving(true);
    setShowFieldErrors(false);
    setError(null);
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
    return <ScreenState message="Buscando as contas da transferência…" status="loading" title="Carregando transferência" />;
  }

  if (loadFailed) {
    return <ScreenState actionLabel="Tentar novamente" message="Não foi possível carregar as contas." onAction={() => { setLoadFailed(false); setIsLoading(true); setLoadAttempt((attempt) => attempt + 1); }} onSecondaryAction={onDone} secondaryActionLabel="Voltar" status="error" />;
  }

  if (accounts.length < 2) {
    return (
      <ScrollableScreen>
        <View style={styles.unavailable}>
          <ScreenHeader onBack={onDone} title="Nova transferência" />
          <Card>
            <Text variant="title">São necessárias duas contas</Text>
            <Text tone="muted">Cadastre outra conta antes de transferir dinheiro.</Text>
          </Card>
          <Button label="Voltar" onPress={onDone} />
        </View>
      </ScrollableScreen>
    );
  }

  const parsedAmount = parseMoneyInput(amount.replace(/\./g, ''));
  const parsedDate = parseCivilDate(date);
  const amountError = showFieldErrors && (!parsedAmount.ok || parsedAmount.value <= 0)
    ? 'Informe um valor maior que zero.'
    : undefined;
  const dateError = showFieldErrors && (!parsedDate.ok || !validateNotFuture(parsedDate.value, getLocalCivilDate()).ok)
    ? 'Escolha uma data válida que não seja futura.'
    : undefined;
  const accountsMatch = sourceAccountId !== null && sourceAccountId === destinationAccountId;

  return (
    <ScrollableScreen>
        <ScreenHeader onBack={onDone} title={`${existing ? 'Editar' : 'Nova'} transferência`} />
        <Card elevated>
          <View style={styles.form}>
            {error ? <FormFeedback message={error} /> : null}
            <AccountChoices
              accounts={accounts}
              error={showFieldErrors && (sourceAccountId === null || accountsMatch)}
              label="Origem"
              onSelect={selectSource}
              selectedId={sourceAccountId}
            />
            <AccountChoices
              accounts={accounts}
              error={showFieldErrors && (destinationAccountId === null || accountsMatch)}
              label="Destino"
              onSelect={selectDestination}
              selectedId={destinationAccountId}
            />
            <MoneyField error={amountError} label="Valor" onChangeText={(value) => { setAmount(value); setShowFieldErrors(false); }} value={amount} placeholder="0,00" />
            <DatePickerField
              error={dateError}
              label="Data"
              onChange={(value) => { setDate(value); setShowFieldErrors(false); }}
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
    </ScrollableScreen>
  );
}

function AccountChoices({
  accounts,
  error = false,
  label,
  onSelect,
  selectedId,
}: {
  accounts: readonly Account[];
  error?: boolean;
  label: string;
  onSelect: (id: number) => void;
  selectedId: number | null;
}) {
  const { tokens } = useTheme();
  return (
    <View>
      <Text tone={error ? 'negative' : 'muted'} variant="caption" style={{ marginBottom: tokens.spacing.sm }}>{label}</Text>
      <FadeSelection selectionKey={selectedId}>
        <ChipGroup accessibilityLabel={label} error={error}>
          {accounts.map((account) => {
            const selected = selectedId === account.id;
            return (
              <SelectableChip
                key={account.id}
                label={account.name}
                onPress={() => onSelect(account.id)}
                selected={selected}
              />
            );
          })}
        </ChipGroup>
      </FadeSelection>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  unavailable: { gap: 20, paddingVertical: 24 },
});
