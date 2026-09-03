import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Screen, Text } from '@/components';
import { listAccounts, listCategories, listTransactions } from '@/db/repositories';
import { formatBrazilianCurrency } from '@/domain';
import type { Category, Transaction } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

export function TransactionsHomeScreen({ onAppearance, onManageCategories, onNewExpense, onNewIncome, onNoAccounts }: { onAppearance: () => void; onManageCategories: () => void; onNewExpense: () => void; onNewIncome: () => void; onNoAccounts: () => void }) {
  const db = useSQLiteContext(); const { tokens } = useTheme(); const [transactions, setTransactions] = useState<readonly Transaction[]>([]); const [categories, setCategories] = useState<readonly Category[]>([]); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { const [accounts, loadedTransactions, loadedCategories] = await Promise.all([listAccounts(db), listTransactions(db), listCategories(db)]); if (accounts.length === 0) { onNoAccounts(); return; } setTransactions(loadedTransactions.filter((item) => item.kind === 'expense' || item.kind === 'income')); setCategories(loadedCategories); setError(null); } catch { setError('Não foi possível carregar os lançamentos.'); } }, [db, onNoAccounts]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <Screen><ScrollView contentContainerStyle={styles.content}><View><Text variant="heading">Início</Text><Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>Histórico de despesas e rendas.</Text></View>{error ? <Text tone="negative">{error}</Text> : null}<View style={styles.list}>{transactions.length === 0 ? <Card><Text tone="muted">Nenhum lançamento registrado ainda.</Text></Card> : transactions.map((transaction) => <TransactionCard category={categories.find((item) => item.id === transaction.categoryId) ?? null} key={transaction.id} transaction={transaction} />)}</View><Button label="Nova despesa" onPress={onNewExpense} /><Button label="Nova renda" onPress={onNewIncome} variant="secondary" /><Button label="Gerenciar categorias" onPress={onManageCategories} variant="ghost" /><Button label="Personalizar aparência" onPress={onAppearance} variant="ghost" /></ScrollView></Screen>;
}
function TransactionCard({ category, transaction }: { category: Category | null; transaction: Transaction }) { const income = transaction.kind === 'income'; return <Card><Text variant="title">{transaction.name}</Text><Text tone={income ? 'positive' : 'negative'}>{formatBrazilianCurrency(transaction.amountCents)}</Text><Text tone="muted" variant="caption">{transaction.transactionDate}{transaction.kind === 'expense' ? ` · ${category ? category.name : 'Categoria excluída'}` : ''}</Text></Card>; }
const styles = StyleSheet.create({ content: { gap: 18, paddingVertical: 24 }, list: { gap: 10 } });
