import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Screen, Text } from '@/components';
import { deleteCategory, listCategories } from '@/db/repositories';
import type { Category } from '@/domain';
import { formatBrazilianCurrency } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

type CategoriesScreenProps = {
  onCreate: () => void;
  onEdit: (id: number) => void;
  onFinish?: () => void;
};

export function CategoriesScreen({ onCreate, onEdit, onFinish }: CategoriesScreenProps) {
  const database = useSQLiteContext();
  const { tokens } = useTheme();
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setCategories(await listCategories(database)); setError(null); } catch { setError('Não foi possível carregar as categorias.'); }
  }, [database]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

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
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View><Text variant="heading">Categorias</Text><Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>Defina seus limites mensais e indicadores.</Text></View>
        {error ? <Text tone="negative">{error}</Text> : null}
        <View style={styles.list}>
          {categories.map((category) => <CategoryCard category={category} key={category.id} onDelete={() => confirmDelete(category)} onEdit={() => onEdit(category.id)} />)}
        </View>
        <Button label="Nova categoria" onPress={onCreate} />
        {onFinish ? <Button label="Concluir configuração" onPress={onFinish} variant="secondary" /> : null}
      </ScrollView>
    </Screen>
  );
}

function CategoryCard({ category, onDelete, onEdit }: { category: Category; onDelete: () => void; onEdit: () => void }) {
  const { tokens } = useTheme();
  return <Card><View style={styles.row}><View style={[styles.visual, { backgroundColor: category.visualType === 'color' ? category.visualValue : tokens.primary }]}>{category.visualType === 'icon' ? <Text style={{ color: tokens.onPrimary }}>{category.visualValue}</Text> : null}</View><View style={styles.details}><Text variant="title">{category.name}</Text><Text tone="muted" variant="caption">Orçamento: {formatBrazilianCurrency(category.monthlyBudgetCents)}</Text></View></View><View style={styles.actions}><Button label="Editar" onPress={onEdit} style={styles.action} variant="secondary" /><Button label="Excluir" onPress={onDelete} style={styles.action} variant="ghost" /></View></Card>;
}

const styles = StyleSheet.create({ action: { flex: 1 }, actions: { flexDirection: 'row', gap: 8, marginTop: 14 }, content: { gap: 18, paddingVertical: 24 }, details: { flex: 1 }, list: { gap: 12 }, row: { alignItems: 'center', flexDirection: 'row', gap: 12 }, visual: { alignItems: 'center', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 } });
