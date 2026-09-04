import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Screen, Text } from '@/components';
import { listAccounts, listCategories, listTransactions } from '@/db/repositories';
import { calculateAccountBalance, calculateCategoryMonthlySpending, calculateConsolidatedBalance, formatBrazilianCurrency } from '@/domain';
import type { Account, Category, Transaction } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

type DashboardScreenProps = {
  onNewExpense: () => void;
  onNewIncome: () => void;
  onNoAccounts: () => void;
};

export function DashboardScreen({ onNewExpense, onNewIncome, onNoAccounts }: DashboardScreenProps) {
  const db = useSQLiteContext(); const { tokens } = useTheme(); const [accounts, setAccounts] = useState<readonly Account[]>([]); const [categories, setCategories] = useState<readonly Category[]>([]); const [transactions, setTransactions] = useState<readonly Transaction[]>([]); const [selectedId, setSelectedId] = useState<number | null>(null);
  const load = useCallback(async () => { const [a, c, t] = await Promise.all([listAccounts(db), listCategories(db), listTransactions(db)]); if (!a.length) { onNoAccounts(); return; } setAccounts(a); setCategories(c); setTransactions(t); setSelectedId((id) => id ?? a[0].id); }, [db, onNoAccounts]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const selected = accounts.find((item) => item.id === selectedId) ?? null; const month = today().slice(0, 7); const total = calculateConsolidatedBalance(transactions); const max = Math.max(1, ...categories.map((c) => calculateCategoryMonthlySpending(transactions, c.id, month)));
  return <Screen><ScrollView contentContainerStyle={styles.content}><View><Text variant="heading">Visão financeira</Text><Text tone="muted">Acompanhe seu dinheiro neste mês.</Text></View><Card elevated><Text tone="muted" variant="caption">Saldo consolidado</Text><Text variant="display">{formatBrazilianCurrency(total)}</Text>{selected ? <><Text tone="muted" variant="caption" style={{ marginTop: tokens.spacing.md }}>Conta selecionada: {selected.name}</Text><Text variant="title">{formatBrazilianCurrency(calculateAccountBalance(transactions, selected.id))}</Text><View style={styles.chips}>{accounts.map((account) => <Pressable key={account.id} onPress={() => setSelectedId(account.id)} style={[styles.chip, { borderColor: account.id === selectedId ? tokens.primary : tokens.border }]}><Text variant="caption">{account.name}</Text></Pressable>)}</View></> : null}</Card><View><Text variant="title">Gastos por categoria</Text><Text tone="muted" variant="caption">{month}</Text></View><View style={styles.chart}>{categories.map((category) => { const spending = calculateCategoryMonthlySpending(transactions, category.id, month); return <View key={category.id}><View style={styles.row}><Text>{category.name}</Text><Text tone="negative">{formatBrazilianCurrency(-spending)}</Text></View><View style={[styles.track, { backgroundColor: tokens.surfaceElevated }]}><View style={[styles.bar, { backgroundColor: tokens.primary, width: `${(spending / max) * 100}%` }]} /></View></View>; })}</View><Button label="Nova despesa" onPress={onNewExpense} /><Button label="Nova renda" onPress={onNewIncome} variant="secondary" /></ScrollView></Screen>;
}
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const styles = StyleSheet.create({ bar: { borderRadius: 99, height: 8 }, chart: { gap: 12 }, chip: { borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, content: { gap: 20, paddingVertical: 24 }, row: { flexDirection: 'row', justifyContent: 'space-between' }, track: { borderRadius: 99, height: 8, marginTop: 5, overflow: 'hidden' } });
