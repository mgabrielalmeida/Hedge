import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Field, MoneyField, Screen, Text } from '@/components';
import { createCategory, findCategoryById, updateCategory } from '@/db/repositories';
import { parseMoneyInput, validateRequiredText } from '@/domain';
import type { Category, CategoryVisualType } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

const icons = ['🏷️', '🛒', '🍽️', '🎬', '🏠', '🚗', '💊', '📚', '🎁', '✈️', '🐾', '★'] as const;
const colors = ['#276749', '#176B9C', '#7E3A8A', '#B45309', '#B42318', '#0F766E', '#1D4ED8', '#9333EA', '#C2410C', '#BE123C', '#4D7C0F', '#475569'] as const;

type CategoryEditorScreenProps = {
  categoryId?: number;
  onDone: () => void;
};

export function CategoryEditorScreen({ categoryId, onDone }: CategoryEditorScreenProps) {
  const database = useSQLiteContext();
  const { tokens } = useTheme();
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [visualType, setVisualType] = useState<CategoryVisualType>('icon');
  const [visualValue, setVisualValue] = useState<string>(icons[0]);
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="heading">{category ? 'Editar categoria' : 'Nova categoria'}</Text>
        <Card elevated>
          <View style={styles.form}>
            <Field error={error ?? undefined} label="Nome" onChangeText={setName} placeholder="Ex.: Moradia" value={name} />
            <MoneyField label="Orçamento mensal" onChangeText={setBudget} placeholder="0,00" value={budget} />
            <Text tone="muted" variant="caption">Ícone ou cor</Text>
            <View style={styles.options}>
              <Chip label="Ícone" onPress={() => setVisualType('icon')} selected={visualType === 'icon'} />
              <Chip label="Cor" onPress={() => setVisualType('color')} selected={visualType === 'color'} />
            </View>
            <View style={styles.options}>
              {(visualType === 'icon' ? icons : colors).map((value) => (
                <Pressable key={value} accessibilityLabel={`Indicador ${value}`} onPress={() => setVisualValue(value)} style={[
                  visualType === 'icon' ? styles.icon : styles.color,
                  { backgroundColor: visualType === 'color' ? value : tokens.surface, borderColor: visualValue === value ? tokens.primary : tokens.border },
                ]}>
                  {visualType === 'icon' ? <Text>{value}</Text> : null}
                </Pressable>
              ))}
            </View>
            <Button disabled={saving} label={saving ? 'Salvando…' : 'Salvar categoria'} onPress={() => void save()} />
            <Button label="Cancelar" onPress={onDone} variant="ghost" />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Chip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { tokens } = useTheme();
  return <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: selected ? tokens.primary : tokens.surface, borderColor: selected ? tokens.primary : tokens.border }]}><Text variant="caption" style={{ color: selected ? tokens.onPrimary : tokens.text }}>{label}</Text></Pressable>;
}

function formatBudget(cents: number): string {
  const absolute = Math.abs(cents);
  return `${String(Math.trunc(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${String(absolute % 100).padStart(2, '0')}`;
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' }, chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, color: { borderRadius: 20, borderWidth: 2, height: 40, width: 40 }, content: { gap: 20, paddingVertical: 24 }, form: { gap: 16 }, icon: { alignItems: 'center', borderRadius: 20, borderWidth: 2, height: 40, justifyContent: 'center', width: 40 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
