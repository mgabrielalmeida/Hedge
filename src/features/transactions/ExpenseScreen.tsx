import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Field, MoneyField, Screen, Text } from '@/components';
import {
  createRecurringRule,
  createTransaction,
  deleteRecurringRule,
  deleteTransaction,
  findRecurringRuleById,
  findTransactionById,
  listAccounts,
  listCategories,
  processDueRecurringRules,
  updateRecurringRule,
  updateTransaction,
} from '@/db/repositories';
import {
  formatBrazilianMoneyInput,
  getCivilDateParts,
  getMondayBasedWeekday,
  parseCivilDate,
  parseMoneyInput,
  validateDateRange,
  validateNotFuture,
  validateRequiredText,
} from '@/domain';
import type { Account, Category, RecurringFrequency, RecurringRule, Transaction } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';
import { getLocalCivilDate } from '@/utils/localCivilDate';

type ExpenseScreenProps = {
  kind?: 'expense' | 'income';
  onDone: () => void;
  recurringRuleId?: number;
  transactionId?: number;
};

const weekdays = [
  ['Seg', 1],
  ['Ter', 2],
  ['Qua', 3],
  ['Qui', 4],
  ['Sex', 5],
  ['Sáb', 6],
  ['Dom', 7],
] as const;

export function ExpenseScreen({ kind = 'expense', onDone, recurringRuleId, transactionId }: ExpenseScreenProps) {
  const db = useSQLiteContext();
  const initialDate = getLocalCivilDate();
  const initialDateParts = getCivilDateParts(initialDate);
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(initialDate);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [existingTransaction, setExistingTransaction] = useState<Transaction | null>(null);
  const [existingRule, setExistingRule] = useState<RecurringRule | null>(null);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(recurringRuleId !== undefined);
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [chargeDay, setChargeDay] = useState(String(initialDateParts.day));
  const [chargeMonth, setChargeMonth] = useState(String(initialDateParts.month));
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([
      listAccounts(db),
      listCategories(db),
      transactionId ? findTransactionById(db, transactionId) : Promise.resolve(null),
      recurringRuleId ? findRecurringRuleById(db, recurringRuleId) : Promise.resolve(null),
    ]).then(([loadedAccounts, loadedCategories, transaction, rule]) => {
      if (!active) return;
      setAccounts(loadedAccounts);
      setCategories(loadedCategories);

      if (transaction && (transaction.kind === 'expense' || transaction.kind === 'income')) {
        setExistingTransaction(transaction);
        setAccountId(transaction.accountId);
        setCategoryId(transaction.categoryId);
        setName(transaction.name);
        setAmount(formatBrazilianMoneyInput(Math.abs(transaction.amountCents)));
        setDate(transaction.transactionDate);
        setDescription(transaction.description ?? '');
      }

      if (rule?.isActive && (rule.kind === 'expense' || rule.kind === 'income')) {
        setExistingRule(rule);
        setRecurrenceEnabled(true);
        setAccountId(rule.accountId);
        setCategoryId(rule.categoryId);
        setName(rule.name);
        setAmount(formatBrazilianMoneyInput(Math.abs(rule.amountCents)));
        setDate(rule.startDate);
        setDescription(rule.description ?? '');
        setFrequency(rule.schedule.frequency);
        setChargeDay(String(rule.schedule.chargeDay));
        setChargeMonth(rule.schedule.chargeMonth === null ? '' : String(rule.schedule.chargeMonth));
        setEndDate(rule.endDate ?? '');
      }
    }).catch(() => {
      if (active) setError('Não foi possível carregar os dados do formulário.');
    });
    return () => {
      active = false;
    };
  }, [db, recurringRuleId, transactionId]);

  async function save() {
    const money = parseMoneyInput(amount.replace(/\./g, ''));
    const civil = parseCivilDate(date);
    const validName = validateRequiredText(name);
    const commonIsInvalid = !validName.ok || !money.ok || money.value <= 0 || !civil.ok ||
      accountId === null || (kind === 'expense' && categoryId === null);

    if (commonIsInvalid) {
      setError(`Preencha nome, valor, data, conta${kind === 'expense' ? ' e categoria' : ''}.`);
      return;
    }

    if (!recurrenceEnabled && !validateNotFuture(civil.value, getLocalCivilDate()).ok) {
      setError('A data de um lançamento pontual não pode ser futura.');
      return;
    }

    const parsedEndDate = endDate.trim() === '' ? null : parseCivilDate(endDate.trim());
    const parsedChargeDay = parsePositiveInteger(chargeDay);
    const parsedChargeMonth = parsePositiveInteger(chargeMonth);
    if (recurrenceEnabled && (
      parsedChargeDay === null ||
      (frequency === 'weekly' && parsedChargeDay > 7) ||
      (frequency !== 'weekly' && parsedChargeDay > 31) ||
      (frequency === 'yearly' && (parsedChargeMonth === null || parsedChargeMonth > 12)) ||
      (parsedEndDate !== null && !parsedEndDate.ok) ||
      !validateDateRange(civil.value, parsedEndDate === null ? null : parsedEndDate.value).ok
    )) {
      setError('Confira a frequência, o dia de cobrança e o período da recorrência.');
      return;
    }

    setSaving(true);
    try {
      const amountCents = kind === 'expense' ? -money.value : money.value;
      if (recurrenceEnabled) {
        const input = {
          kind,
          accountId,
          categoryId: kind === 'expense' ? categoryId : null,
          name: validName.value,
          description,
          amountCents,
          frequency,
          chargeDay: parsedChargeDay!,
          chargeMonth: frequency === 'yearly' ? parsedChargeMonth : null,
          startDate: civil.value,
          endDate: parsedEndDate !== null && parsedEndDate.ok ? parsedEndDate.value : null,
        } as const;
        if (existingRule) {
          const updated = await updateRecurringRule(db, existingRule.id, input);
          if (!updated) throw new Error('Recurring rule is no longer active.');
        } else {
          await createRecurringRule(db, input);
          try {
            await processDueRecurringRules(db, getLocalCivilDate());
          } catch (processingError) {
            console.error('New recurring rule could not be processed immediately.', processingError);
          }
        }
      } else {
        const input = {
          kind,
          accountId,
          categoryId: kind === 'expense' ? categoryId : null,
          name: validName.value,
          description,
          amountCents,
          transactionDate: civil.value,
        } as const;
        if (existingTransaction) await updateTransaction(db, existingTransaction.id, input);
        else await createTransaction(db, input);
      }
      onDone();
    } catch {
      setError(`Não foi possível salvar ${kind === 'expense' ? 'a despesa' : 'a renda'}.`);
    } finally {
      setSaving(false);
    }
  }

  const isEditing = existingTransaction !== null || existingRule !== null;
  const noun = kind === 'expense' ? 'despesa' : 'renda';
  const title = `${isEditing ? 'Editar' : 'Nova'} ${noun}${recurrenceEnabled ? ' recorrente' : ''}`;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading">{title}</Text>
        <Card elevated>
          <View style={styles.form}>
            <Field error={error ?? undefined} label="Nome" onChangeText={setName} value={name} placeholder={kind === 'expense' ? 'Ex.: Mercado' : 'Ex.: Salário'} />
            <MoneyField label="Valor" onChangeText={setAmount} value={amount} placeholder="0,00" />
            <Field label={recurrenceEnabled ? 'Data inicial' : 'Data'} onChangeText={setDate} value={date} placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" />
            <Text tone="muted" variant="caption">Conta</Text>
            <View style={styles.choices}>{accounts.map((account) => <Choice key={account.id} label={account.name} onPress={() => setAccountId(account.id)} selected={accountId === account.id} />)}</View>
            {kind === 'expense' ? <><Text tone="muted" variant="caption">Categoria</Text><View style={styles.choices}>{categories.map((category) => <Choice key={category.id} label={`${category.iconValue} ${category.name}`} onPress={() => setCategoryId(category.id)} selected={categoryId === category.id} />)}</View></> : null}
            <Field label="Descrição (opcional)" onChangeText={setDescription} value={description} placeholder="Adicionar observação" multiline />
            {transactionId === undefined && recurringRuleId === undefined ? <><Text tone="muted" variant="caption">Regra recorrente (opcional)</Text><View style={styles.choices}><Choice label="Não se repete" onPress={() => setRecurrenceEnabled(false)} selected={!recurrenceEnabled} /><Choice label="Configurar recorrência" onPress={() => setRecurrenceEnabled(true)} selected={recurrenceEnabled} /></View></> : null}
            {recurrenceEnabled ? <RecurrenceFields chargeDay={chargeDay} chargeMonth={chargeMonth} endDate={endDate} frequency={frequency} onChargeDayChange={setChargeDay} onChargeMonthChange={setChargeMonth} onEndDateChange={setEndDate} onFrequencyChange={(nextFrequency) => {
              setFrequency(nextFrequency);
              if (nextFrequency === 'weekly') setChargeDay(String(getMondayBasedWeekday(civilDateOrToday(date))));
              else {
                const parts = getCivilDateParts(civilDateOrToday(date));
                setChargeDay(String(parts.day));
                if (nextFrequency === 'yearly') setChargeMonth(String(parts.month));
              }
            }} /> : null}
            <Button disabled={saving} label={saving ? 'Salvando…' : 'Salvar'} onPress={() => void save()} />
            {existingTransaction ? <Button label="Excluir lançamento" onPress={() => Alert.alert('Excluir lançamento?', 'Esta ação remove o lançamento e atualiza o saldo da conta.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => void deleteTransaction(db, existingTransaction.id).then(onDone) }])} variant="destructive" /> : null}
            {existingRule ? <Button label="Excluir regra recorrente" onPress={() => Alert.alert('Excluir regra recorrente?', 'Os lançamentos já gerados serão mantidos no histórico.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Excluir', style: 'destructive', onPress: () => void deleteRecurringRule(db, existingRule.id).then(onDone) }])} variant="destructive" /> : null}
            <Button label="Cancelar" onPress={onDone} variant="ghost" />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function RecurrenceFields({ chargeDay, chargeMonth, endDate, frequency, onChargeDayChange, onChargeMonthChange, onEndDateChange, onFrequencyChange }: {
  chargeDay: string;
  chargeMonth: string;
  endDate: string;
  frequency: RecurringFrequency;
  onChargeDayChange: (value: string) => void;
  onChargeMonthChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onFrequencyChange: (value: RecurringFrequency) => void;
}) {
  return (
    <View style={styles.recurrence}>
      <Text variant="title">Configuração da recorrência</Text>
      <Text tone="muted" variant="caption">Frequência</Text>
      <View style={styles.choices}><Choice label="Semanal" onPress={() => onFrequencyChange('weekly')} selected={frequency === 'weekly'} /><Choice label="Mensal" onPress={() => onFrequencyChange('monthly')} selected={frequency === 'monthly'} /><Choice label="Anual" onPress={() => onFrequencyChange('yearly')} selected={frequency === 'yearly'} /></View>
      {frequency === 'weekly' ? <><Text tone="muted" variant="caption">Dia da semana</Text><View style={styles.choices}>{weekdays.map(([label, value]) => <Choice key={value} label={label} onPress={() => onChargeDayChange(String(value))} selected={chargeDay === String(value)} />)}</View></> : <Field helperText="Dias inexistentes serão ajustados para o último dia do mês." keyboardType="number-pad" label="Dia da cobrança" maxLength={2} onChangeText={onChargeDayChange} placeholder="1 a 31" value={chargeDay} />}
      {frequency === 'yearly' ? <Field keyboardType="number-pad" label="Mês da cobrança" maxLength={2} onChangeText={onChargeMonthChange} placeholder="1 a 12" value={chargeMonth} /> : null}
      <Field helperText="Deixe vazio para repetir sem data final." keyboardType="numbers-and-punctuation" label="Data final (opcional)" onChangeText={onEndDateChange} placeholder="AAAA-MM-DD" value={endDate} />
    </View>
  );
}

function Choice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { tokens } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, { backgroundColor: selected ? tokens.primary : tokens.surface, borderColor: selected ? tokens.primary : tokens.border }]}><Text variant="caption" style={{ color: selected ? tokens.onPrimary : tokens.text }}>{label}</Text></Pressable>;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function civilDateOrToday(value: string) {
  const parsed = parseCivilDate(value);
  return parsed.ok ? parsed.value : getLocalCivilDate();
}

const styles = StyleSheet.create({
  choice: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  content: { gap: 20, paddingVertical: 24 },
  form: { gap: 16 },
  recurrence: { gap: 14 },
});
