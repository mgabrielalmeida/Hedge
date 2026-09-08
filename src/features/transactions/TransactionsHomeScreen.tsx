import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Card,
  FadeSelection,
  scheduleAfterSecondaryTransition,
  Screen,
  Text,
  useReducedMotion,
} from '@/components';
import { listAccounts, listCategories, listRecurringRules, listTransactions } from '@/db/repositories';
import { calculateAccountBalance, formatBrazilianCurrency } from '@/domain';
import type { Account, Category, RecurringRule, Transaction, TransferTransaction } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

import { subscribeToRecurringProcessing } from './useRecurringProcessing';

type HistoryType = 'transactions' | 'transfers' | 'recurring';

const HISTORY_TYPES: readonly HistoryType[] = ['transactions', 'transfers', 'recurring'];
const HISTORY_TOGGLE_DURATION = 220;

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
      setSelectedAccountId((id) => id ?? loadedAccounts[0].id);
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

  const selectedAccount = accounts.find((item) => item.id === selectedAccountId) ?? null;
  const visibleTransactions = transactions.filter((item) => historyType === 'transfers'
    ? item.kind === 'transfer'
    : item.kind === 'expense' || item.kind === 'income');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text variant="heading">Histórico</Text>
        </View>
        {selectedAccount ? (
          <Card>
            <FadeSelection selectionKey={selectedAccount.id}>
              <Text tone="muted" variant="caption">Saldo atual</Text>
              <Text variant="title">{selectedAccount.name}</Text>
              <Text variant="heading">
                {formatBrazilianCurrency(calculateAccountBalance(transactions, selectedAccount.id))}
              </Text>
            </FadeSelection>
            <View style={styles.accounts}>
              {accounts.map((account) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: account.id === selectedAccountId }}
                  key={account.id}
                  onPress={() => setSelectedAccountId(account.id)}
                  style={[
                    styles.account,
                    { borderColor: account.id === selectedAccountId ? tokens.primary : tokens.border },
                  ]}
                >
                  <Text variant="caption">{account.name}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}
        <HistoryToggle selected={historyType} onSelect={setHistoryType} />
        {error ? <Text tone="negative">{error}</Text> : null}
        <View style={styles.list}>
          {historyType === 'recurring' ? recurringRules.length === 0 ? (
            <Card><Text tone="muted">Nenhuma regra recorrente cadastrada ainda.</Text></Card>
          ) : recurringRules.map((rule) => (
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

function HistoryToggle({
  onSelect,
  selected,
}: {
  onSelect: (value: HistoryType) => void;
  selected: HistoryType;
}) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const motionEnabled = reduceMotion === false;
  const selectedIndex = HISTORY_TYPES.indexOf(selected);
  const [indicatorIndex] = useState(() => new Animated.Value(selectedIndex));
  const [toggleWidth, setToggleWidth] = useState(0);
  const optionWidth = Math.max(toggleWidth - 8, 0) / HISTORY_TYPES.length;
  const inputRange = HISTORY_TYPES.map((_, index) => index);
  const outputRange = HISTORY_TYPES.map((_, index) => index * optionWidth + 4);

  useEffect(() => {
    if (!motionEnabled) {
      indicatorIndex.setValue(selectedIndex);
      return;
    }

    const animation = Animated.timing(indicatorIndex, {
      duration: HISTORY_TOGGLE_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: selectedIndex,
      useNativeDriver: true,
    });

    animation.start();
    return () => animation.stop();
  }, [indicatorIndex, motionEnabled, selectedIndex]);

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        setToggleWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
      }}
      style={[styles.toggle, { backgroundColor: tokens.surfaceSubtle, borderColor: tokens.border }]}
    >
      {toggleWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toggleIndicator,
            {
              backgroundColor: tokens.surfaceElevated,
              borderColor: tokens.borderStrong,
              borderRadius: tokens.radius.md,
              transform: [{
                translateX: indicatorIndex.interpolate({ inputRange, outputRange }),
              }],
              width: optionWidth,
            },
          ]}
        />
      ) : null}
      <ToggleOption
        label="Lançamentos"
        onPress={() => onSelect('transactions')}
        selected={selected === 'transactions'}
      />
      <ToggleOption
        label="Transferências"
        onPress={() => onSelect('transfers')}
        selected={selected === 'transfers'}
      />
      <ToggleOption
        label="Recorrências"
        onPress={() => onSelect('recurring')}
        selected={selected === 'recurring'}
      />
    </View>
  );
}

function ToggleOption({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toggleOption,
        {
          borderRadius: tokens.radius.md,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        numberOfLines={1}
        variant="caption"
        style={{
          color: selected ? tokens.primary : tokens.textMuted,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
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
        {transaction.transactionDate}
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
      <Text tone="muted" variant="caption">{transaction.transactionDate}</Text>
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
        Desde {rule.startDate}{rule.endDate ? ` até ${rule.endDate}` : ''}
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
  toggle: { borderWidth: 1, flexDirection: 'row', padding: 4, position: 'relative' },
  toggleIndicator: { bottom: 4, borderWidth: 1, position: 'absolute', top: 4 },
  toggleOption: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
});
