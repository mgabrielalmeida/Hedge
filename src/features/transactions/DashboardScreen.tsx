import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Button,
  Card,
  resolveThemeColorValue,
  scheduleAfterSecondaryTransition,
  Screen,
  Text,
  useReducedMotion,
} from '@/components';
import { listAccounts, listCategories, listTransactions } from '@/db/repositories';
import {
  calculateAccountBalance,
  calculateCategoryMonthlySpending,
  calculateConsolidatedBalance,
  formatBrazilianCurrency,
} from '@/domain';
import type { Account, Category, Transaction } from '@/domain';
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
  const { tokens } = useTheme();
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [transactions, setTransactions] = useState<readonly Transaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalCivilDate().slice(0, 7));

  const load = useCallback(async () => {
    const [loadedAccounts, loadedCategories, loadedTransactions] = await Promise.all([
      listAccounts(database),
      listCategories(database),
      listTransactions(database),
    ]);

    if (loadedAccounts.length === 0) {
      onNoAccounts();
      return;
    }

    setAccounts(loadedAccounts);
    setCategories(loadedCategories);
    setTransactions(loadedTransactions);
    setSelectedAccountId((accountId) => accountId ?? loadedAccounts[0].id);
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text variant="heading">Visão financeira</Text>
        </View>

        <Card elevated>
          <Text tone="muted" variant="caption">Saldo consolidado</Text>
          <Text variant="display">{formatBrazilianCurrency(consolidatedBalance)}</Text>

          {selectedAccount ? (
            <>
              <Text tone="muted" variant="caption" style={{ marginTop: tokens.spacing.md }}>
                Conta selecionada: {selectedAccount.name}
              </Text>
              <Text variant="title">
                {formatBrazilianCurrency(
                  calculateAccountBalance(transactions, selectedAccount.id),
                )}
              </Text>
              <View style={styles.accountChips}>
                {accounts.map((account) => {
                  const selected = account.id === selectedAccountId;

                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={account.id}
                      onPress={() => setSelectedAccountId(account.id)}
                      style={[
                        styles.accountChip,
                        {
                          backgroundColor: selected ? tokens.primaryContainer : tokens.surface,
                          borderColor: selected ? tokens.primary : tokens.border,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{ color: selected ? tokens.onPrimaryContainer : tokens.text }}
                      >
                        {account.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </Card>

        <View>
          <Text variant="title">Orçamentos por categoria</Text>
        </View>

        <MonthSelector
          nextMonth={nextMonth}
          onNextMonth={() => nextMonth && setSelectedMonth(nextMonth)}
          onPreviousMonth={() => previousMonth && setSelectedMonth(previousMonth)}
          previousMonth={previousMonth}
          selectedMonth={selectedMonth}
        />

        <View style={styles.categoryList}>
          {categories.map((category) => (
            <Pressable
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
            </Pressable>
          ))}
        </View>

        <Button label="Nova despesa" onPress={onNewExpense} />
        <Button label="Nova renda" onPress={onNewIncome} variant="secondary" />
        <Button
          disabled={accounts.length < 2}
          label="Nova transferência"
          onPress={onNewTransfer}
          variant="secondary"
        />
        {accounts.length < 2 ? (
          <Text tone="muted" variant="caption">
            Cadastre outra conta para fazer transferências.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function MonthSelector({
  nextMonth,
  onNextMonth,
  onPreviousMonth,
  previousMonth,
  selectedMonth,
}: {
  nextMonth: string | null;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  previousMonth: string | null;
  selectedMonth: string;
}) {
  const { tokens } = useTheme();

  return (
    <View
      accessibilityLabel={`Mês selecionado: ${formatYearMonth(selectedMonth)}`}
      style={[
        styles.monthSelector,
        {
          backgroundColor: tokens.surfaceSubtle,
          borderColor: tokens.border,
          borderRadius: tokens.radius.lg,
        },
      ]}
    >
      <MonthButton
        accessibilityLabel="Mês anterior"
        disabled={previousMonth === null}
        onPress={onPreviousMonth}
        symbol="‹"
      />
      <View style={styles.monthLabel}>
        <Text variant="body" style={{ fontWeight: '700' }}>
          {formatYearMonth(selectedMonth)}
        </Text>
      </View>
      <MonthButton
        accessibilityLabel="Próximo mês"
        disabled={nextMonth === null}
        onPress={onNextMonth}
        symbol="›"
      />
    </View>
  );
}

function MonthButton({
  accessibilityLabel,
  disabled,
  onPress,
  symbol,
}: {
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
  symbol: string;
}) {
  const { tokens } = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.monthButton,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          borderRadius: tokens.radius.pill,
          opacity: disabled ? 0.42 : pressed ? 0.76 : 1,
        },
      ]}
    >
      <Text style={{ color: tokens.primary, fontSize: 28, lineHeight: 28 }}>{symbol}</Text>
    </Pressable>
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
  const visualSymbol = category.iconValue;
  const description = hasBudget
    ? `${formatBrazilianCurrency(spendingCents)} de ${formatBrazilianCurrency(category.monthlyBudgetCents)} gastos`
    : `${formatBrazilianCurrency(spendingCents)} gastos · sem orçamento definido`;

  return (
    <Card>
      <View style={styles.categoryHeader}>
        <View
          style={[
            styles.categoryVisual,
            { backgroundColor: visualColor, borderRadius: tokens.radius.md },
          ]}
        >
          <Text style={{ color: tokens.onPrimary }}>{visualSymbol}</Text>
        </View>
        <View style={styles.categoryHeading}>
          <Text variant="title">{category.name}</Text>
        </View>
        <Text tone="negative" variant="title">
          {formatBrazilianCurrency(spendingCents)}
        </Text>
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
    </Card>
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
  accountChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  accountChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
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
  categoryVisual: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  content: {
    gap: 20,
    paddingVertical: 24,
  },
  monthButton: {
    alignItems: 'center',
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  monthLabel: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  monthSelector: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 8,
  },
  progressBar: {
    height: '100%',
  },
  progressTrack: {
    height: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
});
