import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { Button, Card, Screen, Text } from '@/components';
import { listAccounts, listCategories, listTransactions } from '@/db/repositories';
import { calculateAccountBalance, formatBrazilianCurrency } from '@/domain';
import type { Account, Category, Transaction, TransferTransaction } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

type HistoryType = 'transactions' | 'transfers';

type TransactionsHomeScreenProps = {
  onAppearance: () => void;
  onEditTransaction: (id: number) => void;
  onManageCategories: () => void;
  onNewExpense: () => void;
  onNewIncome: () => void;
  onNewTransfer: () => void;
  onNoAccounts: () => void;
};

export function TransactionsHomeScreen({
  onAppearance,
  onEditTransaction,
  onManageCategories,
  onNewExpense,
  onNewIncome,
  onNewTransfer,
  onNoAccounts,
}: TransactionsHomeScreenProps) {
  const db = useSQLiteContext();
  const { tokens } = useTheme();
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<readonly Transaction[]>([]);
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [historyType, setHistoryType] = useState<HistoryType>('transactions');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [loadedAccounts, loadedTransactions, loadedCategories] = await Promise.all([
        listAccounts(db),
        listTransactions(db),
        listCategories(db),
      ]);
      if (loadedAccounts.length === 0) {
        onNoAccounts();
        return;
      }
      setAccounts(loadedAccounts);
      setSelectedAccountId((id) => id ?? loadedAccounts[0].id);
      setTransactions(loadedTransactions);
      setCategories(loadedCategories);
      setError(null);
    } catch {
      setError('Não foi possível carregar o histórico.');
    }
  }, [db, onNoAccounts]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const selectedAccount = accounts.find((item) => item.id === selectedAccountId) ?? null;
  const visibleTransactions = transactions.filter((item) => historyType === 'transfers'
    ? item.kind === 'transfer'
    : item.kind === 'expense' || item.kind === 'income');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text variant="heading">Histórico</Text>
          <Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>
            Consulte lançamentos pontuais ou transferências.
          </Text>
        </View>
        {selectedAccount ? (
          <Card>
            <Text tone="muted" variant="caption">Saldo atual</Text>
            <Text variant="title">{selectedAccount.name}</Text>
            <Text variant="heading">
              {formatBrazilianCurrency(calculateAccountBalance(transactions, selectedAccount.id))}
            </Text>
            <View style={styles.accounts}>
              {accounts.map((account) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: account.id === selectedAccountId }}
                  key={account.id}
                  onPress={() => setSelectedAccountId(account.id)}
                  style={[
                    styles.account,
                    { borderColor: account.id === selectedAccountId ? tokens.primary : tokens.border },
                  ]}
                >
                  <Text variant="caption">{account.name}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}
        <HistoryToggle selected={historyType} onSelect={setHistoryType} />
        {error ? <Text tone="negative">{error}</Text> : null}
        <View style={styles.list}>
          {visibleTransactions.length === 0 ? (
            <Card>
              <Text tone="muted">
                {historyType === 'transfers'
                  ? 'Nenhuma transferência registrada ainda.'
                  : 'Nenhum lançamento registrado ainda.'}
              </Text>
            </Card>
          ) : visibleTransactions.map((transaction) => (
            <Pressable key={transaction.id} onPress={() => onEditTransaction(transaction.id)}>
              {transaction.kind === 'transfer' ? (
                <TransferCard accounts={accounts} transaction={transaction} />
              ) : transaction.kind === 'expense' || transaction.kind === 'income' ? (
                <TransactionCard
                  category={categories.find((item) => item.id === transaction.categoryId) ?? null}
                  transaction={transaction}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
        <Button label="Nova despesa" onPress={onNewExpense} />
        <Button label="Nova renda" onPress={onNewIncome} variant="secondary" />
        <Button
          disabled={accounts.length < 2}
          label="Nova transferência"
          onPress={onNewTransfer}
          variant="secondary"
        />
        {accounts.length < 2 ? (
          <Text tone="muted" variant="caption">Cadastre outra conta para fazer transferências.</Text>
        ) : null}
        <Button label="Gerenciar categorias" onPress={onManageCategories} variant="ghost" />
        <Button label="Personalizar aparência" onPress={onAppearance} variant="ghost" />
      </ScrollView>
    </Screen>
  );
}

function HistoryToggle({
  onSelect,
  selected,
}: {
  onSelect: (value: HistoryType) => void;
  selected: HistoryType;
}) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.toggle, { backgroundColor: tokens.surfaceSubtle, borderColor: tokens.border }]}
    >
      <ToggleOption
        label="Lançamentos"
        onPress={() => onSelect('transactions')}
        selected={selected === 'transactions'}
      />
      <ToggleOption
        label="Transferências"
        onPress={() => onSelect('transfers')}
        selected={selected === 'transfers'}
      />
    </View>
  );
}

function ToggleOption({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.toggleOption,
        {
          backgroundColor: selected ? tokens.surfaceElevated : 'transparent',
          borderColor: selected ? tokens.borderStrong : 'transparent',
          borderRadius: tokens.radius.md,
        },
      ]}
    >
      <Text style={{ color: selected ? tokens.primary : tokens.textMuted, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function TransactionCard({ category, transaction }: { category: Category | null; transaction: Transaction }) {
  const income = transaction.kind === 'income';
  return (
    <Card>
      <Text variant="title">{transaction.name}</Text>
      <Text tone={income ? 'positive' : 'negative'}>{formatBrazilianCurrency(transaction.amountCents)}</Text>
      <Text tone="muted" variant="caption">
        {transaction.transactionDate}
        {transaction.kind === 'expense' ? ` · ${category ? category.name : 'Categoria excluída'}` : ''}
      </Text>
    </Card>
  );
}

function TransferCard({ accounts, transaction }: { accounts: readonly Account[]; transaction: TransferTransaction }) {
  const source = accounts.find((item) => item.id === transaction.accountId)?.name ?? 'Conta indisponível';
  const destination = accounts.find((item) => item.id === transaction.destinationAccountId)?.name ?? 'Conta indisponível';
  return (
    <Card>
      <Text variant="title">{source} → {destination}</Text>
      <Text tone="info">{formatBrazilianCurrency(Math.abs(transaction.amountCents))}</Text>
      <Text tone="muted" variant="caption">{transaction.transactionDate}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  account: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  accounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  content: { gap: 18, paddingVertical: 24 },
  list: { gap: 10 },
  toggle: { borderWidth: 1, flexDirection: 'row', padding: 4 },
  toggleOption: { alignItems: 'center', borderWidth: 1, flex: 1, paddingHorizontal: 10, paddingVertical: 10 },
});
