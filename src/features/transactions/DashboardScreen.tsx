import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import Svg, { Rect } from 'react-native-svg';

import {
  Button,
  AnimatedMoneyText,
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
import {
  buildMonthlyCategorySpendingComposition,
  type MonthlyCategorySpendingComposition,
} from './monthlyCategorySpendingComposition';
import { subscribeToRecurringProcessing } from './useRecurringProcessing';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const COMPOSITION_TRANSITION_DURATION = 480;

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
  const categorySpendingComposition = useMemo(
    () => buildMonthlyCategorySpendingComposition(
      transactions,
      categories.map((category) => category.id),
      selectedMonth,
    ),
    [categories, selectedMonth, transactions],
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
              </FadeSelection>
              <AnimatedMoneyText
                cents={calculateAccountBalance(transactions, selectedAccount.id)}
                hidden={hideBalances}
                variant="title"
              />
               <ChipGroup accessibilityLabel="Conta selecionada">
                 {accounts.map((account) => {
                  const selected = account.id === selectedAccountId;

                  return (
                    <SelectableChip
                      animateSelection
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

        <MonthNavigator accessibilityLabel={`Mês selecionado: ${formatYearMonth(selectedMonth)}`} label={formatYearMonth(selectedMonth)} nextDisabled={nextMonth === null} onNext={() => nextMonth && setSelectedMonth(nextMonth)} onPrevious={() => previousMonth && setSelectedMonth(previousMonth)} previousDisabled={previousMonth === null} />

        <MonthlyCategorySpendingChart
          categories={categories}
          composition={categorySpendingComposition}
          monthLabel={formatYearMonth(selectedMonth)}
          onCategoryPress={(categoryId) => onCategoryPress(categoryId, selectedMonth)}
          reduceMotion={reduceMotion}
        />

        <View>
          <Text variant="title">Orçamentos por categoria</Text>
        </View>

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

type CategoryCompositionSlice = {
  readonly categoryId: number | null;
  readonly color: string;
  readonly end: number;
  readonly key: string;
  readonly label: string;
  readonly spendingCents: number;
  readonly start: number;
};

type TransitionCompositionSlice = CategoryCompositionSlice & {
  readonly fromEnd: number;
  readonly fromStart: number;
  readonly toEnd: number;
  readonly toStart: number;
};

function MonthlyCategorySpendingChart({
  categories,
  composition,
  monthLabel,
  onCategoryPress,
  reduceMotion,
}: {
  categories: readonly Category[];
  composition: MonthlyCategorySpendingComposition;
  monthLabel: string;
  onCategoryPress: (categoryId: number) => void;
  reduceMotion: boolean | null;
}) {
  const { tokens } = useTheme();
  const [chartWidth, setChartWidth] = useState(0);
  const [transitionProgress] = useState(() => new Animated.Value(1));
  const slices = useMemo(() => {
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const visibleItems = composition.items.flatMap((item) => {
      const category = categoryById.get(item.categoryId);
      if (!category) return [];

      return [{
        categoryId: category.id,
        color: resolveThemeColorValue(
          category.colorValue,
          category.themeColorIndex,
          tokens.primary,
        ),
        key: `category-${category.id}`,
        label: category.name,
        spendingCents: item.spendingCents,
      }];
    });
    return visibleItems.reduce<{
      readonly accumulatedRatio: number;
      readonly slices: readonly CategoryCompositionSlice[];
    }>((result, item) => {
      const start = result.accumulatedRatio;
      const end = start + (composition.totalSpendingCents === 0
        ? 0
        : item.spendingCents / composition.totalSpendingCents);

      return {
        accumulatedRatio: end,
        slices: [...result.slices, { ...item, end, start }],
      };
    }, { accumulatedRatio: 0, slices: [] }).slices;
  }, [categories, composition, tokens.primary]);
  const sliceSignature = `${monthLabel}|${slices
    .map((slice) => `${slice.key}:${slice.spendingCents}:${slice.color}`)
    .join('|')}`;
  const previousSignature = useRef(sliceSignature);
  const previousSlices = useRef(slices);
  const [transitionSlices, setTransitionSlices] = useState<readonly TransitionCompositionSlice[]>(
    () => createCompositionTransition(slices, slices),
  );

  useEffect(() => {
    const fromSlices = previousSlices.current;
    transitionProgress.stopAnimation();

    if (reduceMotion !== false) {
      previousSignature.current = sliceSignature;
      previousSlices.current = slices;
      transitionProgress.setValue(1);
      const resetTimer = setTimeout(() => {
        setTransitionSlices(createCompositionTransition(slices, slices));
      }, 0);
      return () => clearTimeout(resetTimer);
    }
    if (sliceSignature === previousSignature.current) return;

    previousSignature.current = sliceSignature;
    previousSlices.current = slices;
    let animation: Animated.CompositeAnimation | null = null;
    const startTimer = setTimeout(() => {
      setTransitionSlices(createCompositionTransition(fromSlices, slices));
      transitionProgress.setValue(0);
      animation = Animated.timing(transitionProgress, {
        duration: COMPOSITION_TRANSITION_DURATION,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        toValue: 1,
        useNativeDriver: false,
      });
      animation.start(({ finished }) => {
        if (!finished) return;
        setTimeout(() => {
          setTransitionSlices(createCompositionTransition(slices, slices));
        }, 0);
      });
    }, 0);

    return () => {
      clearTimeout(startTimer);
      animation?.stop();
    };
  }, [reduceMotion, sliceSignature, slices, transitionProgress]);
  const renderedTransitionSlices = reduceMotion === false
    ? transitionSlices
    : createCompositionTransition(slices, slices);
  const hasSpending = composition.totalSpendingCents > 0;
  const accessibleSummary = !hasSpending
    ? `Nenhuma despesa em ${monthLabel}.`
    : `Gastos em ${monthLabel}: ${slices.map((slice) => (
      `${slice.label}, ${formatBrazilianCurrency(slice.spendingCents)}`
    )).join('; ')}.`;

  return (
    <Card>
      <Text variant="title">Gastos do mês</Text>
      <MoneyText cents={composition.totalSpendingCents} variant="display" />

      <View
        accessibilityLabel={accessibleSummary}
        accessible
        onLayout={(event) => {
          const nextWidth = Math.floor(event.nativeEvent.layout.width);
          setChartWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
        }}
        style={[
          styles.compositionTrack,
          {
            backgroundColor: tokens.surfaceSubtle,
            borderRadius: tokens.radius.pill,
          },
        ]}
      >
        {chartWidth > 0 && hasSpending ? (
          <Svg height={20} width={chartWidth}>
            {renderedTransitionSlices.map((slice) => (
              <AnimatedRect
                fill={slice.color}
                height={20}
                key={slice.key}
                onPress={slice.categoryId === null
                  ? undefined
                  : () => onCategoryPress(slice.categoryId as number)}
                width={transitionProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    (slice.fromEnd - slice.fromStart) * chartWidth,
                    (slice.toEnd - slice.toStart) * chartWidth,
                  ],
                })}
                x={transitionProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [slice.fromStart * chartWidth, slice.toStart * chartWidth],
                })}
                y={0}
              />
            ))}
          </Svg>
        ) : null}
      </View>

        {!hasSpending ? (
          <Text tone="muted" variant="caption" style={styles.compositionEmpty}>
            Nenhuma despesa neste mês.
          </Text>
        ) : (
          <View accessibilityLabel="Legenda dos gastos por categoria" style={styles.compositionLegend}>
            {slices.map((slice) => {
            const percentage = composition.totalSpendingCents === 0
              ? 0
              : Math.round(slice.spendingCents / composition.totalSpendingCents * 100);
            const content = (
              <>
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.compositionSwatch,
                    { backgroundColor: slice.color, borderRadius: tokens.radius.pill },
                  ]}
                />
                <Text style={styles.compositionLabel}>{slice.label}</Text>
                <Text tone="muted" variant="caption">
                  {formatBrazilianCurrency(slice.spendingCents)} · {percentage}%
                </Text>
              </>
            );

            if (slice.categoryId === null) {
              return <View key={slice.key} style={styles.compositionLegendRow}>{content}</View>;
            }

            return (
              <Pressable
                accessibilityLabel={`Abrir ${slice.label}, ${formatBrazilianCurrency(slice.spendingCents)}, ${percentage}% dos gastos do mês`}
                accessibilityRole="button"
                key={slice.key}
                onPress={() => onCategoryPress(slice.categoryId as number)}
                style={({ pressed }) => [
                  styles.compositionLegendRow,
                  pressed && {
                    backgroundColor: tokens.surfaceSubtle,
                    borderRadius: tokens.radius.md,
                  },
                ]}
              >
                {content}
              </Pressable>
            );
            })}
          </View>
        )}
    </Card>
  );
}

function createCompositionTransition(
  fromSlices: readonly CategoryCompositionSlice[],
  toSlices: readonly CategoryCompositionSlice[],
): readonly TransitionCompositionSlice[] {
  const fromByKey = new Map(fromSlices.map((slice) => [slice.key, slice]));
  const toByKey = new Map(toSlices.map((slice) => [slice.key, slice]));
  const keys = [
    ...toSlices.map((slice) => slice.key),
    ...fromSlices.filter((slice) => !toByKey.has(slice.key)).map((slice) => slice.key),
  ];

  return keys.map((key) => {
    const from = fromByKey.get(key);
    const to = toByKey.get(key);
    const slice = to ?? from;
    if (!slice) throw new Error('Composition transition slice was not found.');

    return {
      ...slice,
      fromEnd: from?.end ?? to?.start ?? 0,
      fromStart: from?.start ?? to?.start ?? 0,
      toEnd: to?.end ?? from?.start ?? 0,
      toStart: to?.start ?? from?.start ?? 0,
    };
  });
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
        <Text tone="muted" variant="caption" style={styles.budgetDescription}>
          {description}
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
    flex: 1,
  },
  budgetSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  compositionEmpty: {
    marginTop: 10,
    textAlign: 'center',
  },
  compositionLabel: {
    flex: 1,
  },
  compositionLegend: {
    gap: 2,
    marginTop: 14,
  },
  compositionLegendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 6,
  },
  compositionSwatch: {
    height: 10,
    width: 10,
  },
  compositionTrack: {
    height: 20,
    marginTop: 16,
    overflow: 'hidden',
    width: '100%',
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
