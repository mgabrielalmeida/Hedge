import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Field, MoneyField, Screen, Text } from '@/components';
import { listAccounts, listCategories, createTransaction } from '@/db/repositories';
import { parseCivilDate, parseMoneyInput, validateNotFuture, validateRequiredText } from '@/domain';
import type { Account, Category } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

export function ExpenseScreen({ onDone }: { onDone: () => void }) {
  const db = useSQLiteContext();
  const [accounts, setAccounts] = useState<readonly Account[]>([]); const [categories, setCategories] = useState<readonly Category[]>([]);
  const [accountId, setAccountId] = useState<number | null>(null); const [categoryId, setCategoryId] = useState<number | null>(null);
  const [name, setName] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState(today()); const [description, setDescription] = useState(''); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  useEffect(() => { void Promise.all([listAccounts(db), listCategories(db)]).then(([a, c]) => { setAccounts(a); setCategories(c); }); }, [db]);
  async function save() {
    const money = parseMoneyInput(amount.replace(/\./g, '')); const civil = parseCivilDate(date); const validName = validateRequiredText(name);
    if (!validName.ok || !money.ok || !civil.ok || !validateNotFuture(civil.ok ? civil.value : '0001-01-01', today()).ok || accountId === null || categoryId === null) { setError('Preencha nome, valor, data, conta e categoria. A data não pode ser futura.'); return; }
    setSaving(true); try { await createTransaction(db, { kind: 'expense', accountId, categoryId, name: validName.value, description, amountCents: -money.value, transactionDate: civil.value }); onDone(); } catch { setError('Não foi possível salvar a despesa.'); } finally { setSaving(false); }
  }
  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text variant="heading">Nova despesa</Text><Card elevated><View style={styles.form}><Field error={error ?? undefined} label="Nome" onChangeText={setName} value={name} placeholder="Ex.: Mercado" /><MoneyField label="Valor" onChangeText={setAmount} value={amount} placeholder="0,00" /><Field label="Data" onChangeText={setDate} value={date} placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" /><Text tone="muted" variant="caption">Conta</Text><View style={styles.choices}>{accounts.map((a) => <Choice key={a.id} label={a.name} onPress={() => setAccountId(a.id)} selected={accountId === a.id} />)}</View><Text tone="muted" variant="caption">Categoria</Text><View style={styles.choices}>{categories.map((c) => <Choice key={c.id} label={`${c.visualType === 'icon' ? c.visualValue : '●'} ${c.name}`} onPress={() => setCategoryId(c.id)} selected={categoryId === c.id} />)}</View><Field label="Descrição (opcional)" onChangeText={setDescription} value={description} placeholder="Adicionar observação" multiline /><Button disabled={saving} label={saving ? 'Salvando…' : 'Salvar despesa'} onPress={() => void save()} /><Button label="Cancelar" onPress={onDone} variant="ghost" /></View></Card></ScrollView></Screen>;
}
function Choice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) { const { tokens } = useTheme(); return <Pressable onPress={onPress} style={[styles.choice, { backgroundColor: selected ? tokens.primary : tokens.surface, borderColor: selected ? tokens.primary : tokens.border }]}><Text variant="caption" style={{ color: selected ? tokens.onPrimary : tokens.text }}>{label}</Text></Pressable>; }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const styles = StyleSheet.create({ choice: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, content: { gap: 20, paddingVertical: 24 }, form: { gap: 16 } });
