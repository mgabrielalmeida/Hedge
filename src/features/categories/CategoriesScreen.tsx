import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Button,
  EmptyStateCard,
  EntityVisual,
  getIconDisplayValue,
  OnboardingProgress,
  PressableCard,
  resolveThemeColorValue,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  Text,
  useReducedMotion,
} from '@/components';
import { listCategories } from '@/db/repositories';
import type { Category } from '@/domain';
import { formatBrazilianCurrency } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

type CategoriesScreenProps = {
  onCreate: () => void;
  onEdit: (id: number) => void;
  onFinish?: () => void;
  onboardingProgress?: { currentStep: number; totalSteps: number };
  showDescription?: boolean;
};

export function CategoriesScreen({
  onCreate,
  onEdit,
  onFinish,
  onboardingProgress,
  showDescription = true,
}: CategoriesScreenProps) {
  const database = useSQLiteContext();
  const reduceMotion = useReducedMotion();
  const [categories, setCategories] = useState<readonly Category[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setCategories(await listCategories(database)); setError(null); } catch { setError('Não foi possível carregar as categorias.'); }
  }, [database]);
  useFocusEffect(useCallback(() => (
    scheduleAfterSecondaryTransition(() => void load(), reduceMotion === false)
  ), [load, reduceMotion]));

  return (
    <ScrollableScreen>
        <ScreenHeader description={showDescription ? 'Defina seus limites mensais e indicadores.' : undefined} title="Categorias" />
        {onboardingProgress ? <OnboardingProgress {...onboardingProgress} /> : null}
        {error ? <ScreenState actionLabel="Tentar novamente" fullScreen={false} message={error} onAction={() => void load()} status="error" /> : categories === null ? <ScreenState fullScreen={false} message="Buscando suas categorias…" status="loading" title="Carregando categorias" /> : <>
          <View style={styles.list}>
            {categories.map((category) => <CategoryCard category={category} key={category.id} onEdit={() => onEdit(category.id)} />)}
          </View>
          {categories.length === 0 ? <EmptyStateCard actionLabel="Nova categoria" message="Crie uma categoria para organizar suas despesas." onAction={onCreate} /> : null}
        </>}
        <Button label="Nova categoria" onPress={onCreate} />
        {onFinish ? <Button disabled={categories === null || categories.length === 0} label="Ver minha visão financeira" onPress={onFinish} variant="secondary" /> : null}
    </ScrollableScreen>
  );
}

function CategoryCard({ category, onEdit }: { category: Category; onEdit: () => void }) {
  const { tokens } = useTheme();
  return <PressableCard accessibilityLabel={`Editar categoria ${category.name}`} onPress={onEdit}><View style={styles.row}><EntityVisual color={resolveThemeColorValue(category.colorValue, category.themeColorIndex, tokens.primary)} iconValue={getIconDisplayValue(category.iconValue)} /><View style={styles.details}><Text variant="title">{category.name}</Text><Text tone="muted" variant="caption">Orçamento: {formatBrazilianCurrency(category.monthlyBudgetCents)}</Text></View></View></PressableCard>;
}

const styles = StyleSheet.create({ details: { flex: 1 }, list: { gap: 12 }, row: { alignItems: 'center', flexDirection: 'row', gap: 12 } });
