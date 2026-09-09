import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import {
  Card,
  EmptyStateCard,
  EntityVisual,
  getIconDisplayValue,
  MoneyText,
  PressableCard,
  resolveThemeColorValue,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  Text,
  useReducedMotion,
} from '@/components';
import { findCategoryById, listAccounts, listTransactions } from '@/db/repositories';
import { calculateCategoryMonthlySpending, formatBrazilianCurrency, formatCivilDate } from '@/domain';
import type { Account, Category, ExpenseTransaction, Transaction, YearMonth } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

import {
  buildCategorySpendingHistory,
  type CategorySpendingHistory,
} from './categorySpendingHistory';
import { formatYearMonth } from './monthNavigation';
import { subscribeToRecurringProcessing } from './useRecurringProcessing';

type CategorySpendingScreenProps = {
  categoryId?: number;
  onBack: () => void;
  onEditExpense: (id: number) => void;
  selectedMonth?: YearMonth;
};

type LoadedData = {
  readonly accounts: readonly Account[];
  readonly category: Category;
  readonly transactions: readonly Transaction[];
};

const chartMonthCount = 6;
const CHART_DRAW_DURATION = 900;
const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function CategorySpendingScreen({
  categoryId,
  onBack,
  onEditExpense,
  selectedMonth,
}: CategorySpendingScreenProps) {
  const database = useSQLiteContext();
  const screenReduceMotion = useReducedMotion();
  const { tokens } = useTheme();
  const [data, setData] = useState<LoadedData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (categoryId === undefined || selectedMonth === undefined) {
      setData(null);
      setError('Não foi possível identificar a categoria ou o mês selecionado.');
      return;
    }

    try {
      const [category, accounts, transactions] = await Promise.all([
        findCategoryById(database, categoryId),
        listAccounts(database),
        listTransactions(database),
      ]);

      if (!category) {
        setData(null);
        setError('Esta categoria não está mais disponível.');
        return;
      }

      setData({ accounts, category, transactions });
      setError(null);
    } catch {
      setData(null);
      setError('Não foi possível carregar as despesas da categoria.');
    }
  }, [categoryId, database, selectedMonth]);

  useFocusEffect(useCallback(() => (
    scheduleAfterSecondaryTransition(() => void load(), screenReduceMotion === false)
  ), [load, screenReduceMotion]));
  useEffect(() => subscribeToRecurringProcessing(() => void load()), [load]);

  const categoryColor = data
    ? resolveThemeColorValue(data.category.colorValue, data.category.themeColorIndex, tokens.primary)
    : tokens.primary;
  const expenses = data && selectedMonth
    ? data.transactions.filter((transaction): transaction is ExpenseTransaction => (
      transaction.kind === 'expense' &&
      transaction.categoryId === data.category.id &&
      transaction.transactionDate.slice(0, 7) === selectedMonth
    ))
    : [];
  const history = data && selectedMonth
    ? buildCategorySpendingHistory(
      data.transactions,
      data.accounts.map((account) => account.id),
      data.category.id,
      selectedMonth,
      chartMonthCount,
    )
    : null;
  const selectedMonthSpending = data && selectedMonth
    ? calculateCategoryMonthlySpending(data.transactions, data.category.id, selectedMonth)
    : 0;

  if (error) {
    const canRetry = error === 'Não foi possível carregar as despesas da categoria.';
    return <ScreenState actionLabel={canRetry ? 'Tentar novamente' : 'Voltar'} message={error} onAction={canRetry ? () => void load() : onBack} onSecondaryAction={canRetry ? onBack : undefined} secondaryActionLabel={canRetry ? 'Voltar' : undefined} status={canRetry ? 'error' : 'notFound'} />;
  }
  if (!data || !selectedMonth) return <ScreenState message="Buscando as despesas da categoria…" status="loading" title="Carregando despesas" />;

  return (
    <ScrollableScreen contentContainerStyle={styles.content}>
      <ScreenHeader
        description={formatYearMonth(selectedMonth)}
        onBack={onBack}
        title={data.category.name}
        trailing={<EntityVisual color={categoryColor} iconValue={getIconDisplayValue(data.category.iconValue)} size="large" />}
      />
      <Card elevated>
        <Text tone="muted" variant="caption">Total no mês</Text>
        <MoneyText cents={selectedMonthSpending} variant="display" />
      </Card>

      {history ? <CategorySpendingChart accounts={data.accounts} history={history} /> : null}

      <View style={styles.sectionHeading}>
        <Text variant="title">Despesas do mês</Text>
        <Text tone="muted" variant="caption">{expenses.length === 1 ? '1 lançamento' : `${expenses.length} lançamentos`}</Text>
      </View>

      <View style={styles.expenseList}>
        {expenses.length === 0 ? <EmptyStateCard message="Nenhuma despesa nesta categoria durante o mês." /> : expenses.map((expense) => <ExpenseCard accounts={data.accounts} expense={expense} key={expense.id} onEdit={() => onEditExpense(expense.id)} />)}
      </View>
    </ScrollableScreen>
  );
}

function ExpenseCard({
  accounts,
  expense,
  onEdit,
}: {
  accounts: readonly Account[];
  expense: ExpenseTransaction;
  onEdit: () => void;
}) {
  const account = accounts.find((item) => item.id === expense.accountId);

  return (
    <PressableCard accessibilityLabel={`Editar lançamento ${expense.name}`} onPress={onEdit}>
      <View style={styles.expenseHeader}>
        <Text variant="title" style={styles.expenseName}>{expense.name}</Text>
        <Text tone="negative" style={styles.expenseAmount}>
          {formatBrazilianCurrency(Math.abs(expense.amountCents))}
        </Text>
      </View>
      <Text tone="muted" variant="caption">
        {formatCivilDate(expense.transactionDate)} · {account?.name ?? 'Conta indisponível'}
      </Text>
      {expense.description ? (
        <Text tone="muted" variant="caption" style={styles.expenseDescription}>
          {expense.description}
        </Text>
      ) : null}
    </PressableCard>
  );
}

function CategorySpendingChart({
  accounts,
  history,
}: {
  accounts: readonly Account[];
  history: CategorySpendingHistory;
}) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [revealProgress] = useState(() => new Animated.Value(0));
  const chartHeight = 244;
  const plot = { bottom: 28, left: 58, right: 10, top: 12 };
  const plotWidth = Math.max(width - plot.left - plot.right, 1);
  const plotHeight = chartHeight - plot.top - plot.bottom;
  const spendingByMonth = history.months.map((_, monthIndex) => history.series.reduce(
    (total, series) => total + series.spendingByMonth[monthIndex],
    0,
  ));
  const axisMaximum = getAxisMaximum(Math.max(0, ...spendingByMonth));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const series = history.series.flatMap((item) => {
    const account = accountById.get(item.accountId);
    if (!account || !item.spendingByMonth.some((spending) => spending > 0)) return [];

    return [{
      account,
      accountColor: resolveThemeColorValue(
        account.colorValue,
        account.themeColorIndex,
        tokens.primary,
      ),
      spendingByMonth: item.spendingByMonth,
    }];
  });
  const chartColumns = history.months.map((month, monthIndex) => {
    let accumulatedSpending = 0;
    const baseline = plot.top + plotHeight;
    const slotWidth = plotWidth / history.months.length;
    const columnWidth = Math.max(18, Math.min(44, slotWidth * 0.62));
    const x = plot.left + slotWidth * monthIndex + (slotWidth - columnWidth) / 2;
    const segments = series.flatMap((item) => {
      const spendingCents = item.spendingByMonth[monthIndex];
      accumulatedSpending += spendingCents;
      if (spendingCents === 0) return [];

      return [{
        color: item.accountColor,
        height: spendingCents / axisMaximum * plotHeight,
        key: `${item.account.id}-${month}`,
        y: baseline - accumulatedSpending / axisMaximum * plotHeight,
      }];
    });

    return {
      columnWidth,
      month,
      monthIndex,
      monthTotal: spendingByMonth[monthIndex],
      segments,
      showTotal: slotWidth >= 52,
      x,
    };
  });
  const historySignature = history.series
    .map((item) => `${item.accountId}:${item.spendingByMonth.join(',')}`)
    .join('|');

  useEffect(() => {
    revealProgress.stopAnimation();
    if (reduceMotion === null || width === 0) {
      revealProgress.setValue(0);
      return;
    }
    if (reduceMotion) {
      revealProgress.setValue(1);
      return;
    }

    revealProgress.setValue(0);
    const animation = Animated.timing(revealProgress, {
      duration: CHART_DRAW_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: false,
    });

    animation.start();
    return () => animation.stop();
  }, [historySignature, reduceMotion, revealProgress, width]);

  if (series.length === 0) {
    return (
      <Card>
        <Text variant="title">Gastos por conta ao longo dos meses</Text>
        <Text tone="muted" variant="caption" style={styles.chartSubtitle}>
          Ainda não há despesas desta categoria no período exibido.
        </Text>
      </Card>
    );
  }

  return (
    <Card>
      <Text variant="title">Gastos por conta ao longo dos meses</Text>
      <Text tone="muted" variant="caption" style={styles.chartSubtitle}>
        Cada coluna mostra o total do mês; os segmentos identificam as contas.
      </Text>

      <View
        onLayout={(event) => {
          const nextWidth = Math.floor(event.nativeEvent.layout.width);
          setWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
        }}
        style={styles.chartContainer}
      >
        {width > 0 ? (
          <Svg
            accessibilityLabel={`Gráfico de colunas empilhadas dos gastos por conta. A escala vai de zero a ${formatBrazilianCurrency(axisMaximum)}.`}
            accessible
            height={chartHeight}
            width={width}
          >
            {[0, 0.5, 1].map((ratio) => {
              const y = plot.top + plotHeight - ratio * plotHeight;
              return (
                <Line
                  key={ratio}
                  stroke={tokens.border}
                  strokeWidth={1}
                  x1={plot.left}
                  x2={width - plot.right}
                  y1={y}
                  y2={y}
                />
              );
            })}
            {[0, 0.5, 1].map((ratio) => (
              <SvgText
                fill={tokens.textMuted}
                fontSize={10}
                key={ratio}
                textAnchor="end"
                x={plot.left - 7}
                y={plot.top + plotHeight - ratio * plotHeight + 4}
              >
                {formatCompactCurrency(axisMaximum * ratio)}
              </SvgText>
            ))}
            {chartColumns.flatMap(({ columnWidth, month, monthIndex, monthTotal, segments, showTotal, x }) => {
              const animationStart = monthIndex / (history.months.length + 1);
              const animationEnd = Math.min(1, animationStart + 2 / (history.months.length + 1));
              const monthProgress = revealProgress.interpolate({
                extrapolate: 'clamp',
                inputRange: [animationStart, animationEnd],
                outputRange: [0, 1],
              });
              const labelY = Math.max(plot.top + 9, plot.top + plotHeight - monthTotal / axisMaximum * plotHeight - 6);

              return [
                ...segments.map((segment) => (
                  <AnimatedRect
                    fill={segment.color}
                    height={monthProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, segment.height],
                    })}
                    key={segment.key}
                    width={columnWidth}
                    x={x}
                    y={monthProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [plot.top + plotHeight, segment.y],
                    })}
                  />
                )),
                monthTotal > 0 && showTotal ? (
                  <SvgText
                    fill={tokens.textMuted}
                    fontSize={10}
                    key={`${month}-total`}
                    textAnchor="middle"
                    x={x + columnWidth / 2}
                    y={labelY}
                  >
                    {formatCompactCurrency(monthTotal)}
                  </SvgText>
                ) : null,
                <SvgText
                  fill={tokens.textMuted}
                  fontSize={10}
                  key={month}
                  textAnchor="middle"
                  x={x + columnWidth / 2}
                  y={chartHeight - 5}
                >
                  {formatMonthTick(month)}
                </SvgText>,
              ];
            })}
          </Svg>
        ) : null}
      </View>

      <View accessibilityLabel="Legenda das contas" style={styles.legend}>
        {series.map((item) => (
          <View key={item.account.id} style={styles.legendItem}>
            <Svg height={14} width={14}><Rect fill={item.accountColor} height={14} width={14} /></Svg>
            <View style={styles.legendAccount}>
              <EntityVisual color={item.accountColor} iconValue={getIconDisplayValue(item.account.iconValue)} size="small" />
              <Text variant="caption">{item.account.name}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text tone="muted" variant="caption" style={styles.chartNote}>
        A legenda associa cada cor à respectiva conta.
      </Text>
    </Card>
  );
}


function getAxisMaximum(observedMaximum: number): number {
  if (observedMaximum <= 0) return 10_000;

  const magnitude = 10 ** Math.floor(Math.log10(observedMaximum));
  return Math.ceil(observedMaximum / magnitude) * magnitude;
}

function formatCompactCurrency(cents: number): string {
  const reais = cents / 100;
  if (reais >= 1_000) {
    const thousands = reais / 1_000;
    const value = Number.isInteger(thousands) ? String(thousands) : thousands.toFixed(1).replace('.', ',');
    return `R$ ${value} mil`;
  }
  return `R$ ${Math.round(reais)}`;
}

function formatMonthTick(yearMonth: YearMonth): string {
  const [year, month] = yearMonth.split('-');
  return `${month}/${year.slice(2)}`;
}

const styles = StyleSheet.create({
  chartContainer: {
    minHeight: 244,
    marginTop: 12,
    width: '100%',
  },
  chartNote: {
    marginTop: 12,
  },
  chartSubtitle: {
    marginTop: 2,
  },
  content: { paddingBottom: 32 },
  expenseAmount: {
    fontWeight: '600',
  },
  expenseDescription: {
    marginTop: 6,
  },
  expenseHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  expenseList: {
    gap: 12,
  },
  expenseName: {
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  legendAccount: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  sectionHeading: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
