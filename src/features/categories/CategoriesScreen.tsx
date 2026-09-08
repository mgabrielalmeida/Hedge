import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Button,
  Card,
  EmptyStateCard,
  EntityVisual,
  getIconDisplayValue,
  resolveThemeColorValue,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  Text,
  useReducedMotion,
} from '@/components';
import { deleteCategory, listCategories } from '@/db/repositories';
import type { Category } from '@/domain';
import { formatBrazilianCurrency } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

type CategoriesScreenProps = {
  onCreate: () => void;
  onEdit: (id: number) => void;
  onFinish?: () => void;
  showDescription?: boolean;
};

export function CategoriesScreen({
  onCreate,
  onEdit,
  onFinish,
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

  function confirmDelete(category: Category) {
    Alert.alert(
      'Excluir categoria?',
      `“${category.name}” deixará de aparecer nas despesas. Regras recorrentes associadas serão desativadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => void (async () => { await deleteCategory(database, category.id); await load(); })() },
      ],
    );
  }

  return (
    <ScrollableScreen>
        <ScreenHeader description={showDescription ? 'Defina seus limites mensais e indicadores.' : undefined} title="Categorias" />
        {error ? <ScreenState actionLabel="Tentar novamente" fullScreen={false} message={error} onAction={() => void load()} status="error" /> : categories === null ? <ScreenState fullScreen={false} message="Buscando suas categorias…" status="loading" title="Carregando categorias" /> : <>
          <View style={styles.list}>
            {categories.map((category) => <CategoryCard category={category} key={category.id} onDelete={() => confirmDelete(category)} onEdit={() => onEdit(category.id)} />)}
          </View>
          {categories.length === 0 ? <EmptyStateCard actionLabel="Nova categoria" message="Crie uma categoria para organizar suas despesas." onAction={onCreate} /> : null}
        </>}
        <Button label="Nova categoria" onPress={onCreate} />
        {onFinish ? <Button disabled={categories === null || categories.length === 0} label="Concluir configuração" onPress={onFinish} variant="secondary" /> : null}
    </ScrollableScreen>
  );
}

function CategoryCard({ category, onDelete, onEdit }: { category: Category; onDelete: () => void; onEdit: () => void }) {
  const { tokens } = useTheme();
  return <Card><View style={styles.row}><EntityVisual color={resolveThemeColorValue(category.colorValue, category.themeColorIndex, tokens.primary)} iconValue={getIconDisplayValue(category.iconValue)} /><View style={styles.details}><Text variant="title">{category.name}</Text><Text tone="muted" variant="caption">Orçamento: {formatBrazilianCurrency(category.monthlyBudgetCents)}</Text></View></View><View style={styles.actions}><Button label="Editar" onPress={onEdit} style={styles.action} variant="secondary" /><Button label="Excluir" onPress={onDelete} style={styles.action} variant="ghost" /></View></Card>;
}

const styles = StyleSheet.create({ action: { flex: 1 }, actions: { flexDirection: 'row', gap: 8, marginTop: 14 }, details: { flex: 1 }, list: { gap: 12 }, row: { alignItems: 'center', flexDirection: 'row', gap: 12 } });
