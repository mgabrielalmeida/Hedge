import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Screen, Text } from '@/components';
import { findTransactionById } from '@/db/repositories';
import type { Transaction } from '@/domain';

import { ExpenseScreen } from './ExpenseScreen';
import { TransferScreen } from './TransferScreen';

export function TransactionEditorScreen({ onDone, transactionId }: { onDone: () => void; transactionId: number }) {
  const db = useSQLiteContext();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void findTransactionById(db, transactionId)
      .then((item) => {
        if (active) setTransaction(item);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [db, transactionId]);

  if (isLoading) {
    return <Screen style={styles.center}><Text tone="muted">Carregando lançamento…</Text></Screen>;
  }
  if (loadFailed) {
    return <Screen style={styles.center}><Text tone="negative">Não foi possível carregar o lançamento.</Text></Screen>;
  }
  if (!transaction) {
    return <Screen style={styles.center}><Text tone="negative">Lançamento não encontrado.</Text></Screen>;
  }
  if (transaction.kind === 'transfer') {
    return <TransferScreen onDone={onDone} transactionId={transactionId} />;
  }
  if (transaction.kind === 'expense' || transaction.kind === 'income') {
    return <ExpenseScreen kind={transaction.kind} onDone={onDone} transactionId={transactionId} />;
  }
  return <Screen style={styles.center}><Text tone="muted">Este lançamento não pode ser editado por esta tela.</Text></Screen>;
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
