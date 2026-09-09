import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Button,
  BalanceVisibilityButton,
  Card,
  ChipGroup,
  EntityVisual,
  FadeSelection,
  getIconDisplayValue,
  MoneyText,
  MonthNavigator,
  PressableCard,
  resolveThemeColorValue,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  SelectableChip,
  Text,
  useReducedMotion,
} from '@/components';
import { listAccounts, listCategories, listRecurringOccurrencesForMonth, listRecurringRules, listTransactions } from '@/db/repositories';
import {
  calculateAccountBalance,
  calculateCategoryMonthlySpending,
  calculateConsolidatedBalance,
  formatBrazilianCurrency,
  formatCivilDate,
  projectMonthEndBalance,
} from '@/domain';
import type { Account, Category, RecurringOccurrence, RecurringRule, Transaction } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';
import { getLocalCivilDate } from '@/utils/localCivilDate';

import { calculateCategoryBudgetProgress } from './categoryBudgetProgress';
import { formatYearMonth, shiftYearMonth } from './monthNavigation';
import { subscribeToRecurringProcessing } from './useRecurringProcessing';

type DashboardScreenProps = {
  onCategoryPress: (categoryId: number, selectedMonth: string) => void;
  onNewExpense: () => void;
  onNewIncome: () => void;
  onNewTransfer: () => void;
  onNoAccounts: () => void;
};

export function DashboardScreen({
  onCategoryPress,
  onNewExpense,
  onNewIncome,
  onNewTransfer,
  onNoAccounts,
}: DashboardScreenProps) {
  const database = useSQLiteContext();
  const reduceMotion = useReducedMotion();
  const { hideBalances, setBalancesHidden, tokens } = useTheme();
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [recurringOccurrences, setRecurringOccurrences] = useState<readonly RecurringOccurrence[]>([]);
  const [recurringRules, setRecurringRules] = useState<readonly RecurringRule[]>([]);
  const [transactions, setTransactions] = useState<readonly Transaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalCivilDate().slice(0, 7));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const month = getLocalCivilDate().slice(0, 7);
      const [loadedAccounts, loadedCategories, loadedOccurrences, loadedRecurringRules, loadedTransactions] = await Promise.all([
        listAccounts(database),
        listCategories(database),
        listRecurringOccurrencesForMonth(database, month),
        listRecurringRules(database),
        listTransactions(database),
      ]);

      if (loadedAccounts.length === 0) {
        onNoAccounts();
        return;
      }

      setAccounts(loadedAccounts);
      setCategories(loadedCategories);
      setRecurringOccurrences(loadedOccurrences);
      setRecurringRules(loadedRecurringRules);
      setTransactions(loadedTransactions);
      setSelectedAccountId((accountId) => accountId ?? loadedAccounts[0].id);
      setError(null);
    } catch {
      setError('Não foi possível carregar sua visão financeira.');
    } finally {
      setIsLoading(false);
    }
  }, [database, onNoAccounts]);

  useFocusEffect(useCallback(() => (
    scheduleAfterSecondaryTransition(() => void load(), reduceMotion === false)
  ), [load, reduceMotion]));

  useEffect(() => subscribeToRecurringProcessing(() => void load()), [load]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const currentMonth = getLocalCivilDate().slice(0, 7);
  const consolidatedBalance = calculateConsolidatedBalance(transactions);
  const previousMonth = shiftYearMonth(selectedMonth, -1);
  const nextMonth = selectedMonth === currentMonth ? null : shiftYearMonth(selectedMonth, 1);
  const recurringProjection = projectMonthEndBalance(
    currentMonth,
    transactions,
    recurringRules,
    recurringOccurrences,
  );

  if (isLoading) return <ScreenState message="Atualizando seus saldos e orçamentos…" status="loading" title="Carregando visão financeira" />;
  if (error) return <ScreenState actionLabel="Tentar novamente" message={error} onAction={() => void load()} status="error" />;

  return (
    <ScrollableScreen
      footer={
        <View style={styles.addArea}>
          {isAddMenuOpen ? (
            <Card elevated>
              <View style={styles.addChoices}>
                <Button label="Despesa" onPress={() => { setIsAddMenuOpen(false); onNewExpense(); }} style={styles.addChoice} variant="secondary" />
                <Button label="Renda" onPress={() => { setIsAddMenuOpen(false); onNewIncome(); }} style={styles.addChoice} variant="secondary" />
                <Button disabled={accounts.length < 2} label="Transferir" onPress={() => { setIsAddMenuOpen(false); onNewTransfer(); }} style={styles.addChoice} variant="secondary" />
              </View>
              {accounts.length < 2 ? <Text tone="muted" variant="caption" style={styles.transferHint}>Cadastre outra conta para transferir.</Text> : null}
            </Card>
          ) : null}
          <Button accessibilityState={{ expanded: isAddMenuOpen }} label="Adicionar" onPress={() => setIsAddMenuOpen((isOpen) => !isOpen)} />
        </View>
      }
    >
        <ScreenHeader title="Visão financeira" />

        <Card elevated>
          <View style={styles.balanceHeader}>
            <Text tone="muted" variant="caption">Saldo consolidado</Text>
            <BalanceVisibilityButton
              hidden={hideBalances}
              onPress={() => void setBalancesHidden(!hideBalances)}
            />
          </View>
          <MoneyText cents={consolidatedBalance} hidden={hideBalances} variant="display" />

          {selectedAccount ? (
            <>
              <FadeSelection selectionKey={selectedAccount.id}>
                <Text tone="muted" variant="caption" style={{ marginTop: tokens.spacing.md }}>
                  Conta selecionada: {selectedAccount.name}
                </Text>
                 <MoneyText cents={calculateAccountBalance(transactions, selectedAccount.id)} hidden={hideBalances} variant="title" />
              </FadeSelection>
               <ChipGroup accessibilityLabel="Conta selecionada">
                 {accounts.map((account) => {
                  const selected = account.id === selectedAccountId;

                  return (
                    <SelectableChip
                      key={account.id}
                      label={account.name}
                      onPress={() => setSelectedAccountId(account.id)}
                      selected={selected}
                    />
                  );
                })}
               </ChipGroup>
            </>
          ) : null}
        </Card>

        <View>
          <Text variant="title">Orçamentos por categoria</Text>
        </View>

         <MonthNavigator accessibilityLabel={`Mês selecionado: ${formatYearMonth(selectedMonth)}`} label={formatYearMonth(selectedMonth)} nextDisabled={nextMonth === null} onNext={() => nextMonth && setSelectedMonth(nextMonth)} onPrevious={() => previousMonth && setSelectedMonth(previousMonth)} previousDisabled={previousMonth === null} />

        <View style={styles.categoryList}>
          {categories.map((category) => (
            <PressableCard
              accessibilityLabel={`Abrir despesas de ${category.name} em ${formatYearMonth(selectedMonth)}`}
              accessibilityRole="button"
              key={category.id}
              onPress={() => onCategoryPress(category.id, selectedMonth)}
            >
              <CategoryBudgetCard
                category={category}
                spendingCents={calculateCategoryMonthlySpending(
                  transactions,
                  category.id,
                  selectedMonth,
                )}
              />
            </PressableCard>
          ))}
        </View>

        <MonthlyRecurringOverview
          accounts={accounts}
          hidden={hideBalances}
          monthLabel={formatYearMonth(currentMonth)}
          projection={recurringProjection}
        />

    </ScrollableScreen>
  );
}

function MonthlyRecurringOverview({
  accounts,
  hidden,
  monthLabel,
  projection,
}: {
  accounts: readonly Account[];
  hidden: boolean;
  monthLabel: string;
  projection: ReturnType<typeof projectMonthEndBalance>;
}) {
  const { tokens } = useTheme();
  const balanceTone = projection.availableBalanceCents < 0 ? 'negative' : 'positive';

  return (
    <Card>
      <View style={styles.recurringSection}>
        <View>
          <Text variant="title">Saldo disponível este mês</Text>
          <MoneyText cents={projection.availableBalanceCents} hidden={hidden} tone={balanceTone} variant="heading" />
          <Text tone="muted" variant="caption">
            Estimativa para {formatCivilDate(projection.monthEndDate)}. Inclui lançamentos registrados até essa data e todas as recorrências ativas de {monthLabel}.
          </Text>
        </View>

        <View style={styles.recurringList}>
          <Text variant="title">Recorrências de {monthLabel}</Text>
          {projection.items.length === 0 ? (
            <Text tone="muted">Nenhuma recorrência prevista neste mês.</Text>
          ) : projection.items.map((item) => {
            const accountName = accounts.find((account) => account.id === item.accountId)?.name ?? 'Conta indisponível';
            const processed = item.status === 'processed';
            const statusColor = processed ? tokens.positive : tokens.info;

            return (
              <View key={`${item.recurringRuleId}-${item.scheduledDate}`} style={[styles.recurringItem, { borderColor: tokens.border }]}>
                <View style={styles.recurringItemDetails}>
                  <Text variant="title">{item.name}</Text>
                  <Text tone="muted" variant="caption">{formatCivilDate(item.scheduledDate)} · {accountName}</Text>
                </View>
                <View style={styles.recurringItemValue}>
                  <MoneyText cents={item.amountCents} tone={item.amountCents < 0 ? 'negative' : 'positive'} variant="title" />
                  <Text style={{ color: statusColor, fontWeight: '700' }} variant="caption">
                    {processed ? 'Processada' : 'Prevista'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

function CategoryBudgetCard({
  category,
  spendingCents,
}: {
  category: Category;
  spendingCents: number;
}) {
  const { tokens } = useTheme();
  const { percentage, progress } = calculateCategoryBudgetProgress(
    spendingCents,
    category.monthlyBudgetCents,
  );
  const hasBudget = percentage !== null;
  const percentageLabel = hasBudget ? `${Math.round(percentage)}%` : '—';
  const progressColor = getProgressColor(percentage, tokens);
  const visualColor = resolveThemeColorValue(category.colorValue, category.themeColorIndex, tokens.primary);
  const description = hasBudget
    ? `${formatBrazilianCurrency(spendingCents)} de ${formatBrazilianCurrency(category.monthlyBudgetCents)} gastos`
    : `${formatBrazilianCurrency(spendingCents)} gastos · sem orçamento definido`;

  return (
    <View>
      <View style={styles.categoryHeader}>
        <EntityVisual color={visualColor} iconValue={getIconDisplayValue(category.iconValue)} size="small" />
        <View style={styles.categoryHeading}>
          <Text variant="title">{category.name}</Text>
        </View>
        <MoneyText cents={spendingCents} tone="negative" variant="title" />
      </View>

      <View style={styles.budgetSummary}>
        <Text tone="muted" variant="caption">
          Orçamento mensal: {formatBrazilianCurrency(category.monthlyBudgetCents)}
        </Text>
        <Text
          tone={hasBudget ? undefined : 'muted'}
          variant="caption"
          style={{ color: hasBudget ? progressColor : tokens.textMuted, fontWeight: '700' }}
        >
          {percentageLabel}
        </Text>
      </View>

      <View
        accessibilityLabel={
          hasBudget
            ? `${percentageLabel} do orçamento mensal usado`
            : 'Orçamento mensal não definido'
        }
        style={[
          styles.progressTrack,
          { backgroundColor: tokens.surfaceSubtle, borderRadius: tokens.radius.pill },
        ]}
      >
        {hasBudget ? (
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: visualColor,
                borderRadius: tokens.radius.pill,
                width: `${progress}%`,
              },
            ]}
          />
        ) : null}
      </View>

      <Text tone="muted" variant="caption" style={styles.budgetDescription}>
        {description}
      </Text>
    </View>
  );
}

function getProgressColor(
  percentage: number | null,
  tokens: ReturnType<typeof useTheme>['tokens'],
): string {
  if (percentage === null) return tokens.textMuted;
  if (percentage >= 100) return tokens.negative;
  if (percentage >= 80) return tokens.warning;
  return tokens.primary;
}

const styles = StyleSheet.create({
  addArea: { gap: 8 },
  addChoice: { flex: 1, paddingHorizontal: 8 },
  addChoices: { flexDirection: 'row', gap: 8 },
  balanceHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  budgetDescription: {
    marginTop: 8,
  },
  budgetSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  categoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  categoryHeading: {
    flex: 1,
  },
  categoryList: {
    gap: 12,
  },
  recurringItem: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 12, paddingTop: 12 },
  recurringItemDetails: { flex: 1 },
  recurringItemValue: { alignItems: 'flex-end' },
  recurringList: { gap: 12 },
  recurringSection: { gap: 20 },
  progressBar: {
    height: '100%',
  },
  progressTrack: {
    height: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
  transferHint: { marginTop: 8 },
});
