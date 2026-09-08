import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Card,
  ChipGroup,
  EmptyStateCard,
  FadeSelection,
  MoneyText,
  MonthNavigator,
  PressableCard,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  SelectableChip,
  SegmentedControl,
  Text,
  useReducedMotion,
} from '@/components';
import { listAccounts, listCategories, listRecurringRules, listTransactions } from '@/db/repositories';
import { calculateAccountBalance, calculateConsolidatedBalance, formatBrazilianCurrency, formatCivilDate } from '@/domain';
import type { Account, Category, RecurringRule, Transaction, TransferTransaction, YearMonth } from '@/domain';
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
  const [isLoading, setIsLoading] = useState(true);

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
    } finally {
      setIsLoading(false);
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
    rule.startDate.slice(0, 7) <= selectedMonth &&
    (rule.endDate === null || rule.endDate.slice(0, 7) >= selectedMonth)
  ));
  const transactionGroups = groupByDate(visibleTransactions.map((item) => ({ date: item.transactionDate, item })));
  const recurringRuleGroups = groupByDate(visibleRecurringRules.map((item) => ({ date: item.startDate, item })));
  const displayedBalance = selectedAccount
    ? calculateAccountBalance(transactions, selectedAccount.id)
    : calculateConsolidatedBalance(transactions);

  if (isLoading) return <ScreenState message="Buscando lançamentos e recorrências…" status="loading" title="Carregando histórico" />;
  if (error) return <ScreenState actionLabel="Tentar novamente" message={error} onAction={() => void load()} status="error" />;

  return (
    <ScrollableScreen>
        <ScreenHeader title="Histórico" />
        <Card>
          <FadeSelection selectionKey={selectedAccountId ?? 'all'}>
            <Text tone="muted" variant="caption">{selectedAccount ? 'Saldo atual' : 'Saldo consolidado'}</Text>
            <Text variant="title">{selectedAccount?.name ?? 'Todas as contas'}</Text>
            <MoneyText cents={displayedBalance} variant="heading" />
          </FadeSelection>
          <ChipGroup accessibilityLabel="Conta do histórico">
            <SelectableChip label="Todas" onPress={() => setSelectedAccountId(null)} selected={selectedAccountId === null} />
            {accounts.map((account) => (
              <SelectableChip key={account.id} label={account.name} onPress={() => setSelectedAccountId(account.id)} selected={account.id === selectedAccountId} />
            ))}
          </ChipGroup>
        </Card>
        <SegmentedControl
          accessibilityLabel="Tipo de histórico"
          onChange={setHistoryType}
          options={HISTORY_TYPES}
          value={historyType}
        />
        <MonthFilter month={selectedMonth} onChange={setSelectedMonth} />
        <View style={styles.list}>
          {historyType === 'recurring' ? recurringRuleGroups.length === 0 ? (
            <EmptyStateCard message="Nenhuma regra recorrente está ativa neste mês." />
          ) : recurringRuleGroups.map((group) => (
            <HistoryDateGroup date={group.date} key={group.date}>
              {group.items.map((rule) => (
                <PressableCard accessibilityLabel={`Editar recorrência ${rule.name}`} key={rule.id} onPress={() => onEditRecurringRule(rule.id)}>
                  <RecurringRuleCard accounts={accounts} categories={categories} rule={rule} />
                </PressableCard>
              ))}
            </HistoryDateGroup>
          )) : visibleTransactions.length === 0 ? (
            <EmptyStateCard message={historyType === 'transfers' ? 'Nenhuma transferência registrada neste mês.' : 'Nenhum lançamento registrado neste mês.'} />
          ) : transactionGroups.map((group) => (
            <HistoryDateGroup date={group.date} key={group.date}>
              {group.items.map((transaction) => (
                <PressableCard accessibilityLabel={`Editar lançamento ${transaction.name}`} key={transaction.id} onPress={() => onEditTransaction(transaction.id)}>
                  {transaction.kind === 'transfer' ? (
                    <TransferCard accounts={accounts} transaction={transaction} />
                  ) : transaction.kind === 'expense' || transaction.kind === 'income' ? (
                    <TransactionCard
                      category={categories.find((item) => item.id === transaction.categoryId) ?? null}
                      transaction={transaction}
                    />
                  ) : null}
                </PressableCard>
              ))}
            </HistoryDateGroup>
          ))}
        </View>
    </ScrollableScreen>
  );
}

function MonthFilter({ month, onChange }: { month: YearMonth; onChange: (month: YearMonth) => void }) {
  const previousMonth = shiftYearMonth(month, -1);
  const currentMonth = getLocalCivilDate().slice(0, 7);
  const nextMonth = month === currentMonth ? null : shiftYearMonth(month, 1);

  return <MonthNavigator accessibilityLabel={`Mês selecionado: ${formatYearMonth(month)}`} label={formatYearMonth(month)} nextDisabled={nextMonth === null} onNext={() => nextMonth && onChange(nextMonth)} onPrevious={() => previousMonth && onChange(previousMonth)} previousDisabled={previousMonth === null} />;
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

function TransactionCard({ category, transaction }: { category: Category | null; transaction: Transaction }) {
  const income = transaction.kind === 'income';
  return (
    <View>
      <Text variant="title">{transaction.name}</Text>
      <Text tone={income ? 'positive' : 'negative'}>{formatBrazilianCurrency(transaction.amountCents)}</Text>
      <Text tone="muted" variant="caption">
       {formatCivilDate(transaction.transactionDate)}
        {transaction.kind === 'expense' ? ` · ${category ? category.name : 'Categoria excluída'}` : ''}
      </Text>
    </View>
  );
}

function TransferCard({ accounts, transaction }: { accounts: readonly Account[]; transaction: TransferTransaction }) {
  const source = accounts.find((item) => item.id === transaction.accountId)?.name ?? 'Conta indisponível';
  const destination = accounts.find((item) => item.id === transaction.destinationAccountId)?.name ?? 'Conta indisponível';
  return (
    <View>
      <Text variant="title">{source} → {destination}</Text>
      <Text tone="info">{formatBrazilianCurrency(Math.abs(transaction.amountCents))}</Text>
      <Text tone="muted" variant="caption">{formatCivilDate(transaction.transactionDate)}</Text>
    </View>
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
    <View>
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
    </View>
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
  dateGroup: { gap: 8 },
  dateGroupItems: { gap: 10 },
  dateHeading: { fontWeight: '600', paddingHorizontal: 4 },
  list: { gap: 10 },
});
