import { type ReactNode, useCallback, useEffect, useState } from 'react';
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
import type { Account, Category, RecurringRule, Transaction, TransferTransaction, YearMonth } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';
import { getLocalCivilDate } from '@/utils/localCivilDate';

import { formatYearMonth, shiftYearMonth } from './monthNavigation';
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

type DatedItem<T> = {
  readonly date: string;
  readonly item: T;
};

type DateGroup<T> = {
  readonly date: string;
  readonly items: readonly T[];
};

export function TransactionsHomeScreen({
  onEditRecurringRule,
  onEditTransaction,
  onNoAccounts,
}: TransactionsHomeScreenProps) {
  const db = useSQLiteContext();
  const screenReduceMotion = useReducedMotion();
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<readonly Transaction[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [recurringRules, setRecurringRules] = useState<readonly RecurringRule[]>([]);
  const [historyType, setHistoryType] = useState<HistoryType>('transactions');
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(() => getLocalCivilDate().slice(0, 7));
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
    if (!hasSelectedAccount || item.transactionDate.slice(0, 7) !== selectedMonth) return false;
    return historyType === 'transfers'
      ? item.kind === 'transfer'
      : item.kind === 'expense' || item.kind === 'income';
  });
  const visibleRecurringRules = recurringRules.filter((rule) => (
    (selectedAccountId === null || rule.accountId === selectedAccountId) &&
    rule.startDate.slice(0, 7) === selectedMonth
  ));
  const transactionGroups = groupByDate(visibleTransactions.map((item) => ({ date: item.transactionDate, item })));
  const recurringRuleGroups = groupByDate(visibleRecurringRules.map((item) => ({ date: item.startDate, item })));
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
        <MonthFilter month={selectedMonth} onChange={setSelectedMonth} />
        {error ? <Text tone="negative">{error}</Text> : null}
        <View style={styles.list}>
          {historyType === 'recurring' ? recurringRuleGroups.length === 0 ? (
            <Card><Text tone="muted">Nenhuma regra recorrente neste mês.</Text></Card>
          ) : recurringRuleGroups.map((group) => (
            <HistoryDateGroup date={group.date} key={group.date}>
              {group.items.map((rule) => (
                <Pressable key={rule.id} onPress={() => onEditRecurringRule(rule.id)}>
                  <RecurringRuleCard accounts={accounts} categories={categories} rule={rule} />
                </Pressable>
              ))}
            </HistoryDateGroup>
          )) : visibleTransactions.length === 0 ? (
            <Card>
              <Text tone="muted">
                {historyType === 'transfers'
                  ? 'Nenhuma transferência registrada neste mês.'
                  : 'Nenhum lançamento registrado neste mês.'}
              </Text>
            </Card>
          ) : transactionGroups.map((group) => (
            <HistoryDateGroup date={group.date} key={group.date}>
              {group.items.map((transaction) => (
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
            </HistoryDateGroup>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function MonthFilter({ month, onChange }: { month: YearMonth; onChange: (month: YearMonth) => void }) {
  const { tokens } = useTheme();
  const previousMonth = shiftYearMonth(month, -1);
  const currentMonth = getLocalCivilDate().slice(0, 7);
  const nextMonth = month === currentMonth ? null : shiftYearMonth(month, 1);

  return (
    <View accessibilityLabel={`Mês selecionado: ${formatYearMonth(month)}`} style={[styles.monthFilter, { borderColor: tokens.border }]}>
      <Pressable
        accessibilityLabel="Mês anterior"
        accessibilityRole="button"
        disabled={previousMonth === null}
        onPress={() => previousMonth && onChange(previousMonth)}
        style={({ pressed }) => [styles.monthButton, { opacity: pressed ? 0.7 : previousMonth === null ? 0.4 : 1 }]}
      >
        <Text style={{ color: tokens.primary, fontSize: 22 }}>‹</Text>
      </Pressable>
      <View style={styles.monthLabel}>
        <Text tone="muted" variant="caption">Mês</Text>
        <Text variant="title">{formatYearMonth(month)}</Text>
      </View>
      <Pressable
        accessibilityLabel="Próximo mês"
        accessibilityRole="button"
        disabled={nextMonth === null}
        onPress={() => nextMonth && onChange(nextMonth)}
        style={({ pressed }) => [styles.monthButton, { opacity: pressed ? 0.7 : nextMonth === null ? 0.4 : 1 }]}
      >
        <Text style={{ color: tokens.primary, fontSize: 22 }}>›</Text>
      </Pressable>
    </View>
  );
}

function HistoryDateGroup({ children, date }: { children: ReactNode; date: string }) {
  return (
    <View style={styles.dateGroup}>
      <Text tone="muted" variant="caption" style={styles.dateHeading}>{formatCivilDate(date)}</Text>
      <View style={styles.dateGroupItems}>{children}</View>
    </View>
  );
}

function groupByDate<T>(items: readonly DatedItem<T>[]): readonly DateGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const { date, item } of items) {
    const group = groups.get(date);
    if (group) group.push(item);
    else groups.set(date, [item]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, groupedItems]) => ({ date, items: groupedItems }));
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
  dateGroup: { gap: 8 },
  dateGroupItems: { gap: 10 },
  dateHeading: { fontWeight: '600', paddingHorizontal: 4 },
  list: { gap: 10 },
  monthButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48, width: 48 },
  monthFilter: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between' },
  monthLabel: { alignItems: 'center', flex: 1, gap: 2, paddingVertical: 8 },
});
