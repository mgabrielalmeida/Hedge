import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Screen, Text } from '@/components';
import { listAccounts, listTransactions } from '@/db/repositories';
import { formatBrazilianCurrency } from '@/domain';
import type { Transaction } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

export function TransactionsHomeScreen({ onNewExpense, onNoAccounts }: { onNewExpense: () => void; onNoAccounts: () => void }) {
  const db = useSQLiteContext(); const { tokens } = useTheme(); const [expenses, setExpenses] = useState<readonly Transaction[]>([]); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { try { const [accounts, transactions] = await Promise.all([listAccounts(db), listTransactions(db)]); if (accounts.length === 0) { onNoAccounts(); return; } setExpenses(transactions.filter((item) => item.kind === 'expense')); setError(null); } catch { setError('Não foi possível carregar os lançamentos.'); } }, [db, onNoAccounts]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <Screen><ScrollView contentContainerStyle={styles.content}><View><Text variant="heading">Início</Text><Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>Despesas pontuais registradas para teste do fluxo.</Text></View>{error ? <Text tone="negative">{error}</Text> : null}<View style={styles.list}>{expenses.length === 0 ? <Card><Text tone="muted">Nenhuma despesa registrada ainda.</Text></Card> : expenses.map((expense) => <Card key={expense.id}><Text variant="title">{expense.name}</Text><Text tone="negative">{formatBrazilianCurrency(expense.amountCents)}</Text><Text tone="muted" variant="caption">{expense.transactionDate}</Text></Card>)}</View><Button label="Nova despesa" onPress={onNewExpense} /></ScrollView></Screen>;
}
const styles = StyleSheet.create({ content: { gap: 18, paddingVertical: 24 }, list: { gap: 10 } });
