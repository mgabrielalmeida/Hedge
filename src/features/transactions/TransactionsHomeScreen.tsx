import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Card,
  FadeSelection,
  scheduleAfterSecondaryTransition,
  Screen,
  SegmentedControl,
  Text,
  useReducedMotion,
} from '@/components';
import { listAccounts, listCategories, listRecurringRules, listTransactions } from '@/db/repositories';
import { calculateAccountBalance, calculateConsolidatedBalance, formatBrazilianCurrency, formatCivilDate } from '@/domain';
import type { Account, Category, RecurringRule, Transaction, TransferTransaction } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

import { subscribeToRecurringProcessing } from './useRecurringProcessing';

type HistoryType = 'transactions' | 'transfers' | 'recurring';

const HISTORY_TYPES = [
  { label: 'Lançamentos', value: 'transactions' },
  { label: 'Transferências', value: 'transfers' },
  { label: 'Recorrências', value: 'recurring' },
] as const;

type TransactionsHomeScreenProps = {
  onEditRecurringRule: (id: number) => void;
  onEditTransaction: (id: number) => void;
  onNoAccounts: () => void;
};

export function TransactionsHomeScreen({
  onEditRecurringRule,
  onEditTransaction,
  onNoAccounts,
}: TransactionsHomeScreenProps) {
  const db = useSQLiteContext();
  const screenReduceMotion = useReducedMotion();
  const { tokens } = useTheme();
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<readonly Transaction[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [recurringRules, setRecurringRules] = useState<readonly RecurringRule[]>([]);
  const [historyType, setHistoryType] = useState<HistoryType>('transactions');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedTransactions, loadedCategories, loadedRecurringRules] = await Promise.all([
        listAccounts(db),
        listTransactions(db),
        listCategories(db),
        listRecurringRules(db, true),
      ]);
      if (loadedAccounts.length === 0) {
        onNoAccounts();
        return;
      }
      setAccounts(loadedAccounts);
      setSelectedAccountId((id) => id !== null && loadedAccounts.some((account) => account.id === id) ? id : null);
      setTransactions(loadedTransactions);
      setCategories(loadedCategories);
      setRecurringRules(loadedRecurringRules);
      setError(null);
    } catch {
      setError('Não foi possível carregar o histórico.');
    }
  }, [db, onNoAccounts]);

  useFocusEffect(useCallback(() => (
    scheduleAfterSecondaryTransition(() => void load(), screenReduceMotion === false)
  ), [load, screenReduceMotion]));
  useEffect(() => subscribeToRecurringProcessing(() => void load()), [load]);

  const selectedAccount = selectedAccountId === null
    ? null
    : accounts.find((item) => item.id === selectedAccountId) ?? null;
  const visibleTransactions = transactions.filter((item) => {
    const hasSelectedAccount = selectedAccountId === null || item.accountId === selectedAccountId ||
      (item.kind === 'transfer' && item.destinationAccountId === selectedAccountId);
    if (!hasSelectedAccount) return false;
    return historyType === 'transfers'
      ? item.kind === 'transfer'
      : item.kind === 'expense' || item.kind === 'income';
  });
  const visibleRecurringRules = recurringRules.filter((rule) => selectedAccountId === null || rule.accountId === selectedAccountId);
  const displayedBalance = selectedAccount
    ? calculateAccountBalance(transactions, selectedAccount.id)
    : calculateConsolidatedBalance(transactions);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text variant="heading">Histórico</Text>
        </View>
        <Card>
          <FadeSelection selectionKey={selectedAccountId ?? 'all'}>
            <Text tone="muted" variant="caption">{selectedAccount ? 'Saldo atual' : 'Saldo consolidado'}</Text>
            <Text variant="title">{selectedAccount?.name ?? 'Todas as contas'}</Text>
            <Text variant="heading">{formatBrazilianCurrency(displayedBalance)}</Text>
          </FadeSelection>
          <View style={styles.accounts}>
            <AccountChoice label="Todas" onPress={() => setSelectedAccountId(null)} selected={selectedAccountId === null} />
            {accounts.map((account) => (
              <AccountChoice key={account.id} label={account.name} onPress={() => setSelectedAccountId(account.id)} selected={account.id === selectedAccountId} />
            ))}
          </View>
        </Card>
        <SegmentedControl
          accessibilityLabel="Tipo de histórico"
          onChange={setHistoryType}
          options={HISTORY_TYPES}
          value={historyType}
        />
        {error ? <Text tone="negative">{error}</Text> : null}
        <View style={styles.list}>
          {historyType === 'recurring' ? visibleRecurringRules.length === 0 ? (
            <Card><Text tone="muted">Nenhuma regra recorrente cadastrada ainda.</Text></Card>
          ) : visibleRecurringRules.map((rule) => (
            <Pressable key={rule.id} onPress={() => onEditRecurringRule(rule.id)}>
              <RecurringRuleCard accounts={accounts} categories={categories} rule={rule} />
            </Pressable>
          )) : visibleTransactions.length === 0 ? (
            <Card>
              <Text tone="muted">
                {historyType === 'transfers'
                  ? 'Nenhuma transferência registrada ainda.'
                  : 'Nenhum lançamento registrado ainda.'}
              </Text>
            </Card>
          ) : visibleTransactions.map((transaction) => (
            <Pressable key={transaction.id} onPress={() => onEditTransaction(transaction.id)}>
              {transaction.kind === 'transfer' ? (
                <TransferCard accounts={accounts} transaction={transaction} />
              ) : transaction.kind === 'expense' || transaction.kind === 'income' ? (
                <TransactionCard
                  category={categories.find((item) => item.id === transaction.categoryId) ?? null}
                  transaction={transaction}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function AccountChoice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.account, { borderColor: selected ? tokens.primary : tokens.border }]}
    >
      <Text variant="caption">{label}</Text>
    </Pressable>
  );
}

function TransactionCard({ category, transaction }: { category: Category | null; transaction: Transaction }) {
  const income = transaction.kind === 'income';
  return (
    <Card>
      <Text variant="title">{transaction.name}</Text>
      <Text tone={income ? 'positive' : 'negative'}>{formatBrazilianCurrency(transaction.amountCents)}</Text>
      <Text tone="muted" variant="caption">
        {formatCivilDate(transaction.transactionDate)}
        {transaction.kind === 'expense' ? ` · ${category ? category.name : 'Sem categoria'}` : ''}
      </Text>
    </Card>
  );
}

function TransferCard({ accounts, transaction }: { accounts: readonly Account[]; transaction: TransferTransaction }) {
  const source = accounts.find((item) => item.id === transaction.accountId)?.name ?? 'Conta indisponível';
  const destination = accounts.find((item) => item.id === transaction.destinationAccountId)?.name ?? 'Conta indisponível';
  return (
    <Card>
      <Text variant="title">{source} → {destination}</Text>
      <Text tone="info">{formatBrazilianCurrency(Math.abs(transaction.amountCents))}</Text>
      <Text tone="muted" variant="caption">{formatCivilDate(transaction.transactionDate)}</Text>
    </Card>
  );
}

function RecurringRuleCard({ accounts, categories, rule }: {
  accounts: readonly Account[];
  categories: readonly Category[];
  rule: RecurringRule;
}) {
  const account = accounts.find((item) => item.id === rule.accountId)?.name ?? 'Conta indisponível';
  const category = rule.categoryId === null
    ? null
    : categories.find((item) => item.id === rule.categoryId)?.name ?? 'Categoria excluída';
  return (
    <Card>
      <Text variant="title">{rule.name}</Text>
      <Text tone={rule.kind === 'income' ? 'positive' : 'negative'}>
        {formatBrazilianCurrency(rule.amountCents)}
      </Text>
      <Text tone="muted" variant="caption">
        {formatRecurringSchedule(rule)} · {account}{category ? ` · ${category}` : ''}
      </Text>
      <Text tone="muted" variant="caption">
        Desde {formatCivilDate(rule.startDate)}{rule.endDate ? ` até ${formatCivilDate(rule.endDate)}` : ''}
      </Text>
    </Card>
  );
}

function formatRecurringSchedule(rule: RecurringRule): string {
  if (rule.schedule.frequency === 'weekly') {
    const day = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'][rule.schedule.chargeDay - 1];
    return `Semanal, ${day}`;
  }
  if (rule.schedule.frequency === 'monthly') return `Mensal, dia ${rule.schedule.chargeDay}`;
  return `Anual, ${String(rule.schedule.chargeDay).padStart(2, '0')}/${String(rule.schedule.chargeMonth).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  account: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  accounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  content: { gap: 18, paddingVertical: 24 },
  list: { gap: 10 },
});
