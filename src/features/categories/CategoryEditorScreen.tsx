import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  CATEGORY_ICON_OPTIONS,
  Field,
  MoneyField,
  Screen,
  Text,
  VisualPicker,
} from '@/components';
import { createCategory, findCategoryById, updateCategory } from '@/db/repositories';
import { parseMoneyInput, validateRequiredText } from '@/domain';
import type { Category, CategoryVisualType } from '@/domain';

type CategoryEditorScreenProps = {
  categoryId?: number;
  onDone: () => void;
};

export function CategoryEditorScreen({ categoryId, onDone }: CategoryEditorScreenProps) {
  const database = useSQLiteContext();
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [visualType, setVisualType] = useState<CategoryVisualType>('icon');
  const [visualValue, setVisualValue] = useState<string>(CATEGORY_ICON_OPTIONS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(categoryId !== undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (categoryId === undefined) return;
    void (async () => {
      const found = await findCategoryById(database, categoryId);
      if (!found) {
        setError('Categoria não encontrada.');
      } else {
        setCategory(found);
        setName(found.name);
        setBudget(formatBudget(found.monthlyBudgetCents));
        setVisualType(found.visualType);
        setVisualValue(found.visualValue);
      }
      setLoading(false);
    })();
  }, [categoryId, database]);

  async function save() {
    const validName = validateRequiredText(name);
    const validBudget = parseMoneyInput(budget.replace(/\./g, ''));
    if (!validName.ok || !validBudget.ok) {
      setError('Informe nome e orçamento mensal válidos.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { name: validName.value, monthlyBudgetCents: validBudget.value, visualType, visualValue };
      if (category) await updateCategory(database, category.id, input);
      else await createCategory(database, input);
      onDone();
    } catch (reason) {
      setError(String(reason).includes('UNIQUE') ? 'Já existe uma categoria com esse nome.' : 'Não foi possível salvar a categoria.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen style={styles.center}><Text>Carregando categoria…</Text></Screen>;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading">{category ? 'Editar categoria' : 'Nova categoria'}</Text>
        <Card elevated>
          <View style={styles.form}>
            <Field error={error ?? undefined} label="Nome" onChangeText={setName} placeholder="Ex.: Moradia" value={name} />
            <MoneyField label="Orçamento mensal" onChangeText={setBudget} placeholder="0,00" value={budget} />
            <VisualPicker
              iconOptions={CATEGORY_ICON_OPTIONS}
              onChange={setVisualValue}
              onTypeChange={setVisualType}
              value={visualValue}
              visualType={visualType}
            />
            <Button disabled={saving} label={saving ? 'Salvando…' : 'Salvar categoria'} onPress={() => void save()} />
            <Button label="Cancelar" onPress={onDone} variant="ghost" />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function formatBudget(cents: number): string {
  const absolute = Math.abs(cents);
  return `${String(Math.trunc(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${String(absolute % 100).padStart(2, '0')}`;
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' }, content: { gap: 20, paddingVertical: 24 }, form: { gap: 16 } });
