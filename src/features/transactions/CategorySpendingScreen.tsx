import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Svg, { Circle, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import {
  Card,
  EmptyStateCard,
  EntityVisual,
  getIconDisplayValue,
  MoneyText,
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
  selectedMonth?: YearMonth;
};

type LoadedData = {
  readonly accounts: readonly Account[];
  readonly category: Category;
  readonly transactions: readonly Transaction[];
};

const chartMonthCount = 6;
const CHART_DRAW_DURATION = 900;

export function CategorySpendingScreen({
  categoryId,
  onBack,
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

      {history ? <CategorySpendingChart accounts={data.accounts} categoryColor={categoryColor} history={history} /> : null}

      <View style={styles.sectionHeading}>
        <Text variant="title">Despesas do mês</Text>
        <Text tone="muted" variant="caption">{expenses.length === 1 ? '1 lançamento' : `${expenses.length} lançamentos`}</Text>
      </View>

      <View style={styles.expenseList}>
        {expenses.length === 0 ? <EmptyStateCard message="Nenhuma despesa nesta categoria durante o mês." /> : expenses.map((expense) => <ExpenseCard accounts={data.accounts} expense={expense} key={expense.id} />)}
      </View>
    </ScrollableScreen>
  );
}

function ExpenseCard({
  accounts,
  expense,
}: {
  accounts: readonly Account[];
  expense: ExpenseTransaction;
}) {
  const account = accounts.find((item) => item.id === expense.accountId);

  return (
    <Card>
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
    </Card>
  );
}

function CategorySpendingChart({
  accounts,
  categoryColor,
  history,
}: {
  accounts: readonly Account[];
  categoryColor: string;
  history: CategorySpendingHistory;
}) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [revealProgress] = useState(() => new Animated.Value(0));
  const chartHeight = 228;
  const plot = { bottom: 28, left: 58, right: 10, top: 12 };
  const plotWidth = Math.max(width - plot.left - plot.right, 1);
  const plotHeight = chartHeight - plot.top - plot.bottom;
  const observedMaximum = Math.max(
    0,
    ...history.series.flatMap((series) => series.spendingByMonth),
  );
  const axisMaximum = getAxisMaximum(observedMaximum);
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const series = history.series.flatMap((item, seriesIndex) => {
    const account = accountById.get(item.accountId);
    if (!account) return [];

    const points = item.spendingByMonth.map((spendingCents, index) => ({
      x: plot.left + (history.months.length === 1
        ? plotWidth / 2
        : index * plotWidth / (history.months.length - 1)),
      y: plot.top + plotHeight - spendingCents / axisMaximum * plotHeight,
    }));

    return [{
      account,
      accountColor: resolveThemeColorValue(
        account.colorValue,
        account.themeColorIndex,
        tokens.primary,
      ),
      markerShape: seriesIndex % 3,
      path: createSmoothPath(points),
      points,
    }];
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

  return (
    <Card>
      <Text variant="title">Gasto mensal por conta</Text>
      <Text tone="muted" variant="caption" style={styles.chartSubtitle}>
        Últimos {history.months.length} meses até o mês selecionado
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
            accessibilityLabel={`Gráfico de gastos mensais por conta. A escala vai de zero a ${formatBrazilianCurrency(axisMaximum)}.`}
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
            {history.months.map((month, index) => (
              <SvgText
                fill={tokens.textMuted}
                fontSize={10}
                key={month}
                textAnchor="middle"
                x={plot.left + (history.months.length === 1
                  ? plotWidth / 2
                  : index * plotWidth / (history.months.length - 1))}
                y={chartHeight - 5}
              >
                {formatMonthTick(month)}
              </SvgText>
            ))}
          </Svg>
        ) : null}
        {width > 0 ? (
          <Animated.View
            accessible={false}
            pointerEvents="none"
            style={[
              styles.seriesReveal,
              {
                height: chartHeight,
                width: revealProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, width],
                }),
              },
            ]}
          >
            <Svg height={chartHeight} width={width}>
              {series.map((item) => (
                <Path
                  d={item.path}
                  fill="none"
                  key={item.account.id}
                  stroke={categoryColor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                />
              ))}
              {series.flatMap((item) => item.points.map((point, pointIndex) => renderMarker(
                point,
                item.markerShape,
                item.accountColor,
                categoryColor,
                `${item.account.id}-${pointIndex}`,
              )))}
            </Svg>
          </Animated.View>
        ) : null}
      </View>

      <View accessibilityLabel="Legenda das contas" style={styles.legend}>
        {series.map((item) => (
          <View key={item.account.id} style={styles.legendItem}>
            <Svg height={14} width={44}>
              <Line
                stroke={categoryColor}
                strokeLinecap="round"
                strokeWidth={3}
                x1={1}
                x2={43}
                y1={7}
                y2={7}
              />
              {renderMarker(
                { x: 22, y: 7 },
                item.markerShape,
                item.accountColor,
                categoryColor,
                `legend-${item.account.id}`,
              )}
            </Svg>
            <View style={styles.legendAccount}>
              <EntityVisual color={item.accountColor} iconValue={getIconDisplayValue(item.account.iconValue)} size="small" />
              <Text variant="caption">{item.account.name}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text tone="muted" variant="caption" style={styles.chartNote}>
        As linhas usam a cor da categoria; os marcadores identificam cada conta.
      </Text>
    </Card>
  );
}

function createSmoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const following = points[index + 2] ?? next;
    const minimumY = Math.min(current.y, next.y);
    const maximumY = Math.max(current.y, next.y);
    const firstControlY = clamp(current.y + (next.y - previous.y) / 6, minimumY, maximumY);
    const secondControlY = clamp(next.y - (following.y - current.y) / 6, minimumY, maximumY);

    path += ` C ${current.x + (next.x - previous.x) / 6} ${firstControlY}`;
    path += ` ${next.x - (following.x - current.x) / 6} ${secondControlY}`;
    path += ` ${next.x} ${next.y}`;
  }

  return path;
}

function renderMarker(
  point: { x: number; y: number },
  shape: number,
  fill: string,
  stroke: string,
  key: string,
) {
  if (shape === 1) {
    return (
      <Rect
        fill={fill}
        height={7}
        key={key}
        stroke={stroke}
        strokeWidth={1.25}
        width={7}
        x={point.x - 3.5}
        y={point.y - 3.5}
      />
    );
  }
  if (shape === 2) {
    return (
      <Polygon
        fill={fill}
        key={key}
        points={`${point.x},${point.y - 4.2} ${point.x + 4.2},${point.y + 3.4} ${point.x - 4.2},${point.y + 3.4}`}
        stroke={stroke}
        strokeWidth={1.25}
      />
    );
  }
  return (
    <Circle
      cx={point.x}
      cy={point.y}
      fill={fill}
      key={key}
      r={3.5}
      stroke={stroke}
      strokeWidth={1.25}
    />
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
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
    minHeight: 228,
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
  seriesReveal: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
});
