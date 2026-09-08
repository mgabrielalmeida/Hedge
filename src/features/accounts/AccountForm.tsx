import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  ACCOUNT_ICON_OPTIONS,
  getIconDisplayValue,
  Button,
  ChipGroup,
  DatePickerField,
  FadeSelection,
  Field,
  FormFeedback,
  MoneyField,
  Text,
  VisualPicker,
  resolveThemeColorValue,
  SelectableChip,
  useSuccessFeedback,
} from '@/components';
import { createAccount, updateAccountWithBalance } from '@/db/repositories';
import { formatBrazilianMoneyInput, parseMoneyInput, validateRequiredText } from '@/domain';
import type { Account, Cents, ThemeColorIndex } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';
import { getLocalCivilDate } from '@/utils/localCivilDate';

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
  account?: Account;
  currentBalanceCents?: Cents;
  onSaved: (account: Account) => void;
  submitLabel?: string;
};

export function AccountForm({ account, currentBalanceCents, onSaved, submitLabel }: AccountFormProps) {
  const database = useSQLiteContext();
  const { tokens } = useTheme();
  const { showSuccess } = useSuccessFeedback();
  const initialBank = getInitialBank(account);
  const [accountName, setAccountName] = useState(account?.name ?? '');
  const [bank, setBank] = useState<(typeof BANK_OPTIONS)[number] | null>(initialBank);
  const [customInstitution, setCustomInstitution] = useState(
    initialBank === 'Outra instituição' ? account?.institutionName ?? '' : '',
  );
  const [initialBalance, setInitialBalance] = useState(
    currentBalanceCents === undefined ? '' : formatBrazilianMoneyInput(currentBalanceCents),
  );
  const [openingBalanceDate, setOpeningBalanceDate] = useState(getLocalCivilDate());
  const [iconValue, setIconValue] = useState(() => getIconDisplayValue(account?.iconValue ?? 'lucide:landmark'));
  const [colorValue, setColorValue] = useState(account?.colorValue ?? tokens.primary);
  const [themeColorIndex, setThemeColorIndex] = useState<ThemeColorIndex | null>(
    account ? account.themeColorIndex : 2,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ balance?: string; institution?: string; name?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const institutionName = bank === 'Outra instituição' ? customInstitution : bank ?? '';

  function clearFieldError(field: 'balance' | 'institution' | 'name') {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function submit() {
    const name = validateRequiredText(accountName);
    const institution = validateRequiredText(institutionName);
    const amount = parseMoneyInput(initialBalance.replace(/\./g, ''), { allowNegative: true });

    const nextFieldErrors = {
      name: name.ok ? undefined : 'Informe um nome para a conta.',
      institution: institution.ok ? undefined : 'Selecione ou informe uma instituição.',
      balance: amount.ok ? undefined : 'Informe um saldo válido, como 0,00 ou -125,50.',
    };
    if (!name.ok || !institution.ok || !amount.ok) {
      setFieldErrors(nextFieldErrors);
      setFeedback('Os campos destacados precisam ser corrigidos antes de salvar.');
      return;
    }
    setFieldErrors({});
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const visualInput = {
        name: name.value,
        institutionName: institution.value,
        iconValue,
        colorValue: resolveThemeColorValue(colorValue, themeColorIndex, tokens.primary),
        themeColorIndex,
      };
      const savedAccount = account
        ? await updateAccountWithBalance(database, account.id, {
            ...visualInput,
            currentBalanceCents: amount.value,
            adjustmentDate: getLocalCivilDate(),
          })
        : await createAccount(database, {
            ...visualInput,
            initialBalanceCents: amount.value,
            openingBalanceDate,
          });
      if (!savedAccount) throw new Error('Account was not found.');
      showSuccess(account ? 'Conta atualizada.' : 'Conta criada.');
      onSaved(savedAccount);
    } catch {
      setFeedback(`Não foi possível ${account ? 'salvar' : 'criar'} a conta. Confira os dados e toque em salvar novamente.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      {feedback ? <FormFeedback message={feedback} /> : null}
      <Field
        autoCapitalize="words"
        error={fieldErrors.name}
        label="Nome da conta"
        onChangeText={(value) => { setAccountName(value); clearFieldError('name'); }}
        placeholder="Ex.: Conta principal"
        value={accountName}
      />

      <View>
        <Text variant="caption" style={[styles.label, { color: tokens.textMuted }]}>Banco ou instituição</Text>
        <FadeSelection selectionKey={bank}>
          <ChipGroup accessibilityLabel="Banco ou instituição">
            {BANK_OPTIONS.map((option) => (
              <SelectableChip
                key={option}
                label={option}
                onPress={() => { setBank(option); clearFieldError('institution'); }}
                selected={bank === option}
              />
            ))}
          </ChipGroup>
        </FadeSelection>
        {fieldErrors.institution && bank !== 'Outra instituição' ? <Text tone="negative" variant="caption" style={styles.validation}>{fieldErrors.institution}</Text> : null}
      </View>

      {bank === 'Outra instituição' ? (
        <Field
          autoCapitalize="words"
          error={fieldErrors.institution}
          label="Nome da instituição"
          onChangeText={(value) => { setCustomInstitution(value); clearFieldError('institution'); }}
          placeholder="Ex.: Cooperativa local"
          value={customInstitution}
        />
      ) : null}

      <MoneyField
        allowNegative
        error={fieldErrors.balance}
        helperText={account ? 'Se o valor mudar, a diferença será registrada como “Retífica de saldo”.' : undefined}
        label={account ? 'Saldo atual' : 'Saldo inicial'}
        onChangeText={(value) => { setInitialBalance(value); clearFieldError('balance'); }}
        placeholder="0,00"
        value={initialBalance}
      />

      {!account ? (
        <DatePickerField
          label="Data do saldo inicial"
          onChange={setOpeningBalanceDate}
          value={openingBalanceDate}
        />
      ) : null}

      <VisualPicker
        key={iconValue}
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
        label={isSubmitting ? 'Salvando…' : submitLabel ?? (account ? 'Salvar conta' : 'Criar conta')}
        onPress={() => void submit()}
        style={styles.submit}
      />
    </View>
  );
}

function getInitialBank(account?: Account): (typeof BANK_OPTIONS)[number] | null {
  if (!account) return null;
  return BANK_OPTIONS.find((option) => (
    option !== 'Outra instituição' && option === account.institutionName
  )) ?? 'Outra instituição';
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  label: { marginBottom: 8 },
  submit: { marginTop: 6 },
  validation: { marginTop: 6 },
});
