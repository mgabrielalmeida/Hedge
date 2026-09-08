import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  CATEGORY_ICON_OPTIONS,
  getIconDisplayValue,
  Field,
  FormFeedback,
  MoneyField,
  scheduleAfterSecondaryTransition,
  ScreenHeader,
  ScreenState,
  ScrollableScreen,
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ budget?: string; name?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    if (categoryId === undefined) {
      setLoading(false);
      return;
    }
    try {
      const found = await findCategoryById(database, categoryId);
      if (!found) {
        setLoadError('Categoria não encontrada.');
      } else {
          setCategory(found);
          setName(found.name);
          setBudget(formatBudget(found.monthlyBudgetCents));
          setIconValue(getIconDisplayValue(found.iconValue));
          setColorValue(found.colorValue);
          setThemeColorIndex(found.themeColorIndex);
      }
    } catch {
      setLoadError('Não foi possível carregar a categoria.');
    } finally {
      setLoading(false);
    }
  }, [categoryId, database]);

  useEffect(() => {
    const cancel = scheduleAfterSecondaryTransition(() => {
      void load();
    }, reduceMotion === false);
    return cancel;
  }, [load, reduceMotion]);

  async function save() {
    const validName = validateRequiredText(name);
    const validBudget = parseMoneyInput(budget.replace(/\./g, ''));
    if (!validName.ok || !validBudget.ok) {
      setFieldErrors({
        name: validName.ok ? undefined : 'Informe um nome para a categoria.',
        budget: validBudget.ok ? undefined : 'Informe um orçamento mensal válido.',
      });
      setFeedback('Os campos destacados precisam ser corrigidos antes de salvar.');
      return;
    }
    setSaving(true);
    setFieldErrors({});
    setFeedback(null);
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
      if (String(reason).includes('UNIQUE')) {
        setFieldErrors({ name: 'Já existe uma categoria com esse nome.' });
        setFeedback('Escolha outro nome para continuar.');
      } else {
        setFeedback('Não foi possível salvar a categoria. Confira os dados e toque em salvar novamente.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ScreenState message="Buscando os dados da categoria…" status="loading" title="Carregando categoria" />;

  if (loadError) return <ScreenState actionLabel={loadError === 'Categoria não encontrada.' ? 'Voltar' : 'Tentar novamente'} message={loadError} onAction={loadError === 'Categoria não encontrada.' ? onDone : () => void load()} onSecondaryAction={loadError === 'Categoria não encontrada.' ? undefined : onDone} secondaryActionLabel={loadError === 'Categoria não encontrada.' ? undefined : 'Voltar'} status={loadError === 'Categoria não encontrada.' ? 'notFound' : 'error'} />;

  return (
    <ScrollableScreen>
        <ScreenHeader onBack={onDone} title={category ? 'Editar categoria' : 'Nova categoria'} />
        <Card elevated>
          <View style={styles.form}>
            {feedback ? <FormFeedback message={feedback} /> : null}
            <Field error={fieldErrors.name} label="Nome" onChangeText={(value) => { setName(value); setFieldErrors((current) => ({ ...current, name: undefined })); }} placeholder="Ex.: Moradia" value={name} />
            <MoneyField error={fieldErrors.budget} label="Orçamento mensal" onChangeText={(value) => { setBudget(value); setFieldErrors((current) => ({ ...current, budget: undefined })); }} placeholder="0,00" value={budget} />
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
