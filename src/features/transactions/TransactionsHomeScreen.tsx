import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  Card,
  Button,
  AnimatedMoneyText,
  BalanceVisibilityButton,
  ChipGroup,
  EmptyStateCard,
  FadeSelection,
  FormFeedback,
  MonthNavigator,
  PressableCard,
  scheduleAfterSecondaryTransition,
  Screen,
  ScreenHeader,
  ScreenState,
  SelectableChip,
  SegmentedControl,
  Text,
  useReducedMotion,
  useSuccessFeedback,
} from '@/components';
import { getFinancialBalances, listAccounts, listCategories, listRecurringRules, listTransactionsPage, pauseRecurringRule, resumeRecurringRule, type TransactionPageCursor } from '@/db/repositories';
import { useDatabase } from '@/db/DatabaseProvider';
import { formatBrazilianCurrency, formatCivilDate, getNextRecurringChargeDate } from '@/domain';
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

type HistoryRow =
  | { readonly type: 'transaction'; readonly transaction: Transaction }
  | { readonly type: 'recurring'; readonly rule: RecurringRule; readonly nextChargeDate: string | null };

export function TransactionsHomeScreen({
  onEditRecurringRule,
  onEditTransaction,
  onNoAccounts,
}: TransactionsHomeScreenProps) {
  const db = useDatabase();
  const screenReduceMotion = useReducedMotion();
  const { showSuccess } = useSuccessFeedback();
  const { hideBalances, setBalancesHidden, tokens } = useTheme();
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<readonly Transaction[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [recurringRules, setRecurringRules] = useState<readonly RecurringRule[]>([]);
  const [historyType, setHistoryType] = useState<HistoryType>('transactions');
  const [selectedMonth, setSelectedMonth] = useState<YearMonth>(() => getLocalCivilDate().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recurringActionError, setRecurringActionError] = useState<string | null>(null);
  const [balanceReplayKey, setBalanceReplayKey] = useState(0);
  const [balances, setBalances] = useState<ReadonlyMap<number, number>>(new Map());
  const [consolidatedBalance, setConsolidatedBalance] = useState(0);
  const [pageCursor, setPageCursor] = useState<TransactionPageCursor | null>(null);
  const [nextCursor, setNextCursor] = useState<TransactionPageCursor | null>(null);
  const [previousCursors, setPreviousCursors] = useState<readonly (TransactionPageCursor | null)[]>([]);

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, transactionPage, loadedCategories, loadedRecurringRules, loadedBalances] = await Promise.all([
        listAccounts(db),
        listTransactionsPage(db, { accountId: selectedAccountId, cursor: pageCursor, kind: historyType === 'transfers' ? 'transfers' : 'points', month: selectedMonth }),
        listCategories(db),
        listRecurringRules(db),
        getFinancialBalances(db),
      ]);
      if (loadedAccounts.length === 0) {
        onNoAccounts();
        return;
      }
      setAccounts(loadedAccounts);
      setSelectedAccountId((id) => id !== null && loadedAccounts.some((account) => account.id === id) ? id : null);
      setTransactions(transactionPage.items);
      setNextCursor(transactionPage.nextCursor);
      setCategories(loadedCategories);
      setRecurringRules(loadedRecurringRules);
      setBalances(loadedBalances.byAccountId);
      setConsolidatedBalance(loadedBalances.consolidatedCents);
      setError(null);
    } catch {
      setError('Não foi possível carregar o histórico.');
    } finally {
      setIsLoading(false);
    }
  }, [db, historyType, onNoAccounts, pageCursor, selectedAccountId, selectedMonth]);

  function resetPagination() {
    setPageCursor(null);
    setPreviousCursors([]);
  }

  useFocusEffect(useCallback(() => {
    setBalanceReplayKey((key) => key + 1);
    return scheduleAfterSecondaryTransition(() => void load(), screenReduceMotion === false);
  }, [load, screenReduceMotion]));
  useEffect(() => subscribeToRecurringProcessing((result) => {
    const affectsSelectedAccount = selectedAccountId === null
      || result.affectedAccountIds.includes(selectedAccountId);
    if (affectsSelectedAccount) void load();
  }), [load, selectedAccountId]);

  const selectedAccount = selectedAccountId === null
    ? null
    : accounts.find((item) => item.id === selectedAccountId) ?? null;
  const visibleTransactions = transactions;
  const visibleRecurringRules = recurringRules
    .filter((rule) => rule.deletedAt === null && (selectedAccountId === null || rule.accountId === selectedAccountId))
    .map((rule) => ({ rule, nextChargeDate: getNextRecurringChargeDate(rule, getLocalCivilDate()) }))
    .sort((left, right) => (left.nextChargeDate ?? '9999-12-31').localeCompare(right.nextChargeDate ?? '9999-12-31'));
  const historyRows: readonly HistoryRow[] = historyType === 'recurring'
    ? visibleRecurringRules.map(({ nextChargeDate, rule }) => ({ nextChargeDate, rule, type: 'recurring' }))
    : visibleTransactions.map((transaction) => ({ transaction, type: 'transaction' }));
  const historySelectionKey = `${historyType}:${selectedAccountId ?? 'all'}:${selectedMonth}`;
  const displayedBalance = selectedAccount ? balances.get(selectedAccount.id) ?? 0 : consolidatedBalance;

  if (isLoading) return <ScreenState message="Buscando lançamentos e recorrências…" status="loading" title="Carregando histórico" />;
  if (error) return <ScreenState actionLabel="Tentar novamente" message={error} onAction={() => void load()} status="error" />;

  async function toggleRecurringRule(rule: RecurringRule) {
    try {
      const changed = rule.isActive
        ? await pauseRecurringRule(db, rule.id)
        : await resumeRecurringRule(db, rule.id);
      if (!changed) throw new Error('Recurring rule state did not change.');
      setRecurringActionError(null);
      showSuccess(rule.isActive ? 'Recorrência pausada.' : 'Recorrência retomada.');
      await load();
    } catch {
      setRecurringActionError(`Não foi possível ${rule.isActive ? 'pausar' : 'retomar'} a recorrência. Tente novamente.`);
    }
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={{ paddingBottom: tokens.spacing.xl, paddingTop: tokens.spacing.xl }}
        data={historyRows}
        ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.sm }} />}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(row) => row.type === 'transaction' ? `transaction-${row.transaction.id}` : `recurring-${row.rule.id}`}
        ListEmptyComponent={<EmptyStateCard message={historyType === 'recurring'
          ? 'Nenhuma recorrência configurada para esta conta.'
          : historyType === 'transfers'
            ? 'Nenhuma transferência registrada neste mês.'
            : 'Nenhum lançamento registrado neste mês.'} />}
        ListFooterComponent={historyType !== 'recurring' && (previousCursors.length > 0 || nextCursor) ? (
          <View style={[styles.pagination, { marginTop: tokens.spacing.lg }]}>
            <Button disabled={previousCursors.length === 0} label="Anterior" onPress={() => {
              const previous = previousCursors.at(-1) ?? null;
              setPreviousCursors((items) => items.slice(0, -1));
              setPageCursor(previous);
            }} variant="secondary" />
            <Button disabled={!nextCursor} label="Próxima" onPress={() => {
              if (!nextCursor) return;
              setPreviousCursors((items) => [...items, pageCursor]);
              setPageCursor(nextCursor);
            }} variant="secondary" />
          </View>
        ) : null}
        ListHeaderComponent={(
          <View style={[styles.header, { gap: tokens.spacing.xl, marginBottom: tokens.spacing.xl }]}>
        <ScreenHeader title="Histórico e recorrências" />
        <Card>
          <View style={styles.balanceHeader}>
            <Text tone="muted" variant="caption">{selectedAccount ? 'Saldo atual' : 'Saldo consolidado'}</Text>
            <BalanceVisibilityButton
              hidden={hideBalances}
              onPress={() => void setBalancesHidden(!hideBalances)}
            />
          </View>
          <FadeSelection selectionKey={selectedAccountId ?? 'all'}>
            <Text variant="title">{selectedAccount?.name ?? 'Todas as contas'}</Text>
          </FadeSelection>
          <AnimatedMoneyText
            cents={displayedBalance}
            hidden={hideBalances}
            replayKey={balanceReplayKey}
            variant="heading"
          />
          <ChipGroup accessibilityLabel="Conta do histórico">
            <SelectableChip animateSelection label="Todas" onPress={() => { resetPagination(); setSelectedAccountId(null); }} selected={selectedAccountId === null} />
            {accounts.map((account) => (
              <SelectableChip animateSelection key={account.id} label={account.name} onPress={() => { resetPagination(); setSelectedAccountId(account.id); }} selected={account.id === selectedAccountId} />
            ))}
          </ChipGroup>
        </Card>
        <SegmentedControl
          accessibilityLabel="Tipo de histórico"
          onChange={(value) => { resetPagination(); setHistoryType(value); }}
          options={HISTORY_TYPES}
          value={historyType}
        />
        {historyType !== 'recurring' ? <MonthFilter month={selectedMonth} onChange={(month) => { resetPagination(); setSelectedMonth(month); }} /> : null}
        {historyType === 'recurring' && recurringActionError ? <FormFeedback message={recurringActionError} title="Não foi possível alterar a recorrência" /> : null}
          </View>
        )}
        renderItem={({ index, item }) => {
          if (item.type === 'recurring') {
            return (
              <FadeSelection selectionKey={`${historySelectionKey}:${item.rule.id}`}>
                <RecurringRuleCenterCard
                  accounts={accounts}
                  categories={categories}
                  nextChargeDate={item.nextChargeDate}
                  onEdit={item.rule.isActive ? () => onEditRecurringRule(item.rule.id) : undefined}
                  onToggle={() => void toggleRecurringRule(item.rule)}
                  rule={item.rule}
                />
              </FadeSelection>
            );
          }

          const previousRow = index > 0 ? historyRows[index - 1] : null;
          const showDate = previousRow?.type !== 'transaction'
            || previousRow.transaction.transactionDate !== item.transaction.transactionDate;
          return (
            <FadeSelection selectionKey={`${historySelectionKey}:${item.transaction.id}`}>
              <View style={styles.dateGroup}>
                {showDate ? <Text tone="muted" variant="caption" style={styles.dateHeading}>{formatCivilDate(item.transaction.transactionDate)}</Text> : null}
                <PressableCard accessibilityLabel={`Editar lançamento ${item.transaction.name}`} onPress={() => onEditTransaction(item.transaction.id)}>
                  {item.transaction.kind === 'transfer' ? (
                    <TransferCard accounts={accounts} transaction={item.transaction} />
                  ) : item.transaction.kind === 'expense' || item.transaction.kind === 'income' ? (
                    <TransactionCard
                      category={categories.find((category) => category.id === item.transaction.categoryId) ?? null}
                      transaction={item.transaction}
                    />
                  ) : null}
                </PressableCard>
              </View>
            </FadeSelection>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function MonthFilter({ month, onChange }: { month: YearMonth; onChange: (month: YearMonth) => void }) {
  const previousMonth = shiftYearMonth(month, -1);
  const currentMonth = getLocalCivilDate().slice(0, 7);
  const nextMonth = month === currentMonth ? null : shiftYearMonth(month, 1);

  return <MonthNavigator accessibilityLabel={`Mês selecionado: ${formatYearMonth(month)}`} label={formatYearMonth(month)} nextDisabled={nextMonth === null} onNext={() => nextMonth && onChange(nextMonth)} onPrevious={() => previousMonth && onChange(previousMonth)} previousDisabled={previousMonth === null} />;
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

function RecurringRuleCenterCard({ accounts, categories, nextChargeDate, onEdit, onToggle, rule }: {
  accounts: readonly Account[];
  categories: readonly Category[];
  nextChargeDate: string | null;
  onEdit?: () => void;
  onToggle: () => void;
  rule: RecurringRule;
}) {
  const { tokens } = useTheme();
  const account = accounts.find((item) => item.id === rule.accountId)?.name ?? 'Conta indisponível';
  const category = rule.categoryId === null
    ? null
    : categories.find((item) => item.id === rule.categoryId)?.name ?? 'Categoria excluída';
  const content = (
    <View>
      <Text variant="title">{rule.name}</Text>
      <Text tone={rule.kind === 'income' ? 'positive' : 'negative'}>
        {formatBrazilianCurrency(rule.amountCents)}
      </Text>
      <Text tone="muted" variant="caption">
        Próxima cobrança: {!rule.isActive ? 'Pausada' : nextChargeDate ? formatCivilDate(nextChargeDate) : 'Encerrada'}
      </Text>
      <Text tone="muted" variant="caption">
        Frequência: {formatRecurringSchedule(rule)}
      </Text>
      <Text tone="muted" variant="caption">Conta: {account}</Text>
      {category ? <Text tone="muted" variant="caption">Categoria: {category}</Text> : null}
    </View>
  );
  return (
    <Card>
      <View style={styles.recurringHeader}>
        {onEdit ? (
          <Pressable
            accessibilityLabel={`Editar recorrência ${rule.name}`}
            accessibilityRole="button"
            onPress={onEdit}
            style={({ pressed }) => [styles.recurringDetails, { opacity: pressed ? 0.78 : 1 }]}
          >
            {content}
          </Pressable>
        ) : <View style={styles.recurringDetails}>{content}</View>}
        <Pressable
          accessibilityLabel={rule.isActive ? `Pausar recorrência ${rule.name}` : `Retomar recorrência ${rule.name}`}
          accessibilityRole="button"
          onPress={onToggle}
          style={({ pressed }) => [styles.recurringAction, {
            backgroundColor: tokens.primaryContainer,
            borderColor: tokens.border,
            borderRadius: tokens.radius.pill,
            opacity: pressed ? 0.72 : 1,
          }]}
        >
          <Text style={{ color: tokens.onPrimaryContainer, fontWeight: '600' }} variant="caption">
            {rule.isActive ? 'Pausar' : 'Retomar'}
          </Text>
        </Pressable>
      </View>
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
  balanceHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  dateGroup: { gap: 8 },
  dateHeading: { fontWeight: '600', paddingHorizontal: 4 },
  header: {},
  pagination: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  recurringAction: { alignItems: 'center', borderWidth: 1, justifyContent: 'center', minHeight: 40, minWidth: 64, paddingHorizontal: 10 },
  recurringDetails: { flex: 1, minWidth: 0 },
  recurringHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
});
