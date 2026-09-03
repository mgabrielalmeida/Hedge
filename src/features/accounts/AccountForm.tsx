import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, MoneyField, Text } from '@/components';
import { createAccount } from '@/db/repositories';
import { parseCivilDate, parseMoneyInput, validateRequiredText } from '@/domain';
import type { Account, AccountVisualType } from '@/domain';
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

const ICON_OPTIONS = [
  { label: 'Banco', value: 'bank', symbol: '🏦' },
  { label: 'Carteira', value: 'wallet', symbol: '👛' },
  { label: 'Cartão', value: 'card', symbol: '💳' },
  { label: 'Dinheiro', value: 'cash', symbol: '💵' },
  { label: 'Cofrinho', value: 'savings', symbol: '🐷' },
  { label: 'Moedas', value: 'coins', symbol: '🪙' },
  { label: 'Celular', value: 'mobile', symbol: '📱' },
  { label: 'Casa', value: 'home', symbol: '🏠' },
  { label: 'Trabalho', value: 'work', symbol: '💼' },
  { label: 'Estrela', value: 'star', symbol: '★' },
] as const;

const COLOR_OPTIONS = [
  '#276749', '#176B9C', '#7E3A8A', '#B45309', '#B42318', '#0F766E',
  '#1D4ED8', '#9333EA', '#C2410C', '#BE123C', '#4D7C0F', '#475569',
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
  const [visualType, setVisualType] = useState<AccountVisualType>('icon');
  const [visualValue, setVisualValue] = useState('bank');
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
        visualType,
        visualValue,
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

      <View>
        <Text variant="caption" style={[styles.label, { color: tokens.textMuted }]}>Indicador visual</Text>
        <View style={styles.options}>
          <Choice label="Ícone" onPress={() => setVisualType('icon')} selected={visualType === 'icon'} />
          <Choice label="Cor" onPress={() => setVisualType('color')} selected={visualType === 'color'} />
        </View>
        {visualType === 'icon' ? (
          <View style={styles.options}>
            {ICON_OPTIONS.map((option) => (
              <Choice
                accessibilityLabel={option.label}
                key={option.value}
                label={option.symbol}
                onPress={() => setVisualValue(option.value)}
                selected={visualValue === option.value}
              />
            ))}
          </View>
        ) : (
          <View style={styles.options}>
            {COLOR_OPTIONS.map((color) => (
              <Pressable
                key={color}
                accessibilityLabel={`Indicador ${color}`}
                accessibilityRole="button"
                onPress={() => setVisualValue(color)}
                style={[
                  styles.colorOption,
                  { backgroundColor: color, borderColor: visualValue === color ? tokens.text : tokens.border },
                ]}
              />
            ))}
          </View>
        )}
      </View>

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
  colorOption: { borderRadius: 20, borderWidth: 2, height: 40, width: 40 },
  choice: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  form: { gap: 18 },
  label: { marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  submit: { marginTop: 6 },
});
