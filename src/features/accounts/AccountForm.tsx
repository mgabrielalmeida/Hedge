import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ACCOUNT_ICON_OPTIONS,
  Button,
  Field,
  MoneyField,
  Text,
  VisualPicker,
  resolveThemeColorValue,
} from '@/components';
import { createAccount } from '@/db/repositories';
import { parseCivilDate, parseMoneyInput, validateRequiredText } from '@/domain';
import type { Account, ThemeColorIndex } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

const BANK_OPTIONS = [
  'Banco do Brasil',
  'Bradesco',
  'Caixa',
  'Itaú',
  'Nubank',
  'Santander',
  'Inter',
  'Outra instituição',
] as const;

type AccountFormProps = {
  onAccountCreated: (account: Account) => void;
  submitLabel?: string;
};

export function AccountForm({ onAccountCreated, submitLabel = 'Criar conta' }: AccountFormProps) {
  const database = useSQLiteContext();
  const { tokens } = useTheme();
  const [accountName, setAccountName] = useState('');
  const [bank, setBank] = useState<(typeof BANK_OPTIONS)[number] | null>(null);
  const [customInstitution, setCustomInstitution] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [openingBalanceDate, setOpeningBalanceDate] = useState(getLocalCivilDate());
  const [iconValue, setIconValue] = useState('bank');
  const [colorValue, setColorValue] = useState(tokens.primary);
  const [themeColorIndex, setThemeColorIndex] = useState<ThemeColorIndex | null>(2);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const institutionName = bank === 'Outra instituição' ? customInstitution : bank ?? '';

  async function submit() {
    const name = validateRequiredText(accountName);
    const institution = validateRequiredText(institutionName);
    const amount = parseMoneyInput(initialBalance.replace(/\./g, ''), { allowNegative: true });
    const date = parseCivilDate(openingBalanceDate);

    if (!name.ok) {
      setError('Informe um nome para a conta.');
      return;
    }
    if (!institution.ok) {
      setError('Selecione ou informe uma instituição.');
      return;
    }
    if (!amount.ok) {
      setError('Informe um saldo inicial válido, como 0,00 ou -125,50.');
      return;
    }
    if (!date.ok) {
      setError('Informe uma data válida no formato AAAA-MM-DD.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const account = await createAccount(database, {
        name: name.value,
        institutionName: institution.value,
        iconValue,
        colorValue: resolveThemeColorValue(colorValue, themeColorIndex, tokens.primary),
        themeColorIndex,
        initialBalanceCents: amount.value,
        openingBalanceDate: date.value,
      });
      onAccountCreated(account);
    } catch {
      setError('Não foi possível criar a conta. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <Field
        autoCapitalize="words"
        error={error ?? undefined}
        label="Nome da conta"
        onChangeText={setAccountName}
        placeholder="Ex.: Conta principal"
        value={accountName}
      />

      <View>
        <Text variant="caption" style={[styles.label, { color: tokens.textMuted }]}>Banco ou instituição</Text>
        <View style={styles.options}>
          {BANK_OPTIONS.map((option) => (
            <Choice
              key={option}
              label={option}
              onPress={() => setBank(option)}
              selected={bank === option}
            />
          ))}
        </View>
      </View>

      {bank === 'Outra instituição' ? (
        <Field
          autoCapitalize="words"
          label="Nome da instituição"
          onChangeText={setCustomInstitution}
          placeholder="Ex.: Cooperativa local"
          value={customInstitution}
        />
      ) : null}

      <MoneyField
        allowNegative
        label="Saldo inicial"
        onChangeText={setInitialBalance}
        placeholder="0,00"
        value={initialBalance}
      />

      <Field
        keyboardType="numbers-and-punctuation"
        label="Data do saldo inicial"
        onChangeText={setOpeningBalanceDate}
        placeholder="AAAA-MM-DD"
        value={openingBalanceDate}
      />

      <VisualPicker
        iconOptions={ACCOUNT_ICON_OPTIONS}
        iconValue={iconValue}
        colorValue={colorValue}
        onIconChange={setIconValue}
        onThemeColorChange={(index, value) => { setThemeColorIndex(index); setColorValue(value); }}
        onCustomColorChange={(value) => { setThemeColorIndex(null); setColorValue(value); }}
        themeColorIndex={themeColorIndex}
      />

      <Button
        disabled={isSubmitting}
        label={isSubmitting ? 'Criando conta…' : submitLabel}
        onPress={() => void submit()}
        style={styles.submit}
      />
    </View>
  );
}

function Choice({ accessibilityLabel, label, onPress, selected }: { accessibilityLabel?: string; label: string; onPress: () => void; selected: boolean }) {
  const { tokens } = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? tokens.primary : tokens.surface,
          borderColor: selected ? tokens.primary : tokens.border,
          borderRadius: tokens.radius.pill,
        },
      ]}
    >
      <Text variant="caption" style={{ color: selected ? tokens.onPrimary : tokens.text }}>{label}</Text>
    </Pressable>
  );
}

function getLocalCivilDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  choice: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  form: { gap: 18 },
  label: { marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  submit: { marginTop: 6 },
});
