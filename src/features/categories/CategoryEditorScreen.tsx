import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  CATEGORY_ICON_OPTIONS,
  getIconDisplayValue,
  Field,
  MoneyField,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
  Text,
  useReducedMotion,
  VisualPicker,
  resolveThemeColorValue,
} from '@/components';
import { createCategory, findCategoryById, updateCategory } from '@/db/repositories';
import { parseMoneyInput, validateRequiredText } from '@/domain';
import type { Category, ThemeColorIndex } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

type CategoryEditorScreenProps = {
  categoryId?: number;
  onDone: () => void;
};

export function CategoryEditorScreen({ categoryId, onDone }: CategoryEditorScreenProps) {
  const database = useSQLiteContext();
  const reduceMotion = useReducedMotion();
  const { tokens } = useTheme();
  const [category, setCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [iconValue, setIconValue] = useState<string>('emoji:🏷️');
  const [colorValue, setColorValue] = useState(tokens.primary);
  const [themeColorIndex, setThemeColorIndex] = useState<ThemeColorIndex | null>(2);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const cancel = scheduleAfterSecondaryTransition(() => {
      if (categoryId === undefined) {
        if (active) setLoading(false);
        return;
      }
      void (async () => {
        const found = await findCategoryById(database, categoryId);
        if (!active) return;
        if (!found) {
          setError('Categoria não encontrada.');
        } else {
          setCategory(found);
          setName(found.name);
          setBudget(formatBudget(found.monthlyBudgetCents));
          setIconValue(getIconDisplayValue(found.iconValue));
          setColorValue(found.colorValue);
          setThemeColorIndex(found.themeColorIndex);
        }
        setLoading(false);
      })();
    }, reduceMotion === false);

    return () => {
      active = false;
      cancel();
    };
  }, [categoryId, database, reduceMotion]);

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
      const input = {
        name: validName.value,
        monthlyBudgetCents: validBudget.value,
        iconValue,
        colorValue: resolveThemeColorValue(colorValue, themeColorIndex, tokens.primary),
        themeColorIndex,
      };
      if (category) await updateCategory(database, category.id, input);
      else await createCategory(database, input);
      onDone();
    } catch (reason) {
      setError(String(reason).includes('UNIQUE') ? 'Já existe uma categoria com esse nome.' : 'Não foi possível salvar a categoria.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ScreenState message="Buscando os dados da categoria…" status="loading" title="Carregando categoria" />;

  if (error === 'Categoria não encontrada.') return <ScreenState actionLabel="Voltar" message={error} onAction={onDone} status="notFound" />;

  return (
    <ScrollableScreen>
        <ScreenHeader onBack={onDone} title={category ? 'Editar categoria' : 'Nova categoria'} />
        <Card elevated>
          <View style={styles.form}>
            {error ? <Text tone="negative" variant="caption">{error}</Text> : null}
            <Field label="Nome" onChangeText={setName} placeholder="Ex.: Moradia" value={name} />
            <MoneyField label="Orçamento mensal" onChangeText={setBudget} placeholder="0,00" value={budget} />
            <VisualPicker
              key={iconValue}
              iconOptions={CATEGORY_ICON_OPTIONS}
              iconValue={iconValue}
              colorValue={colorValue}
              onIconChange={setIconValue}
              onThemeColorChange={(index, value) => { setThemeColorIndex(index); setColorValue(value); }}
              onCustomColorChange={(value) => { setThemeColorIndex(null); setColorValue(value); }}
              themeColorIndex={themeColorIndex}
            />
            <Button disabled={saving} label={saving ? 'Salvando…' : 'Salvar categoria'} onPress={() => void save()} />
            <Button label="Cancelar" onPress={onDone} variant="ghost" />
          </View>
        </Card>
    </ScrollableScreen>
  );
}

function formatBudget(cents: number): string {
  const absolute = Math.abs(cents);
  return `${String(Math.trunc(absolute / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${String(absolute % 100).padStart(2, '0')}`;
}

const styles = StyleSheet.create({ form: { gap: 16 } });
