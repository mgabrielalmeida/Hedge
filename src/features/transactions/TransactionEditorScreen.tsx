import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  scheduleAfterSecondaryTransition,
  ScreenState,
  useReducedMotion,
} from '@/components';
import { findTransactionById } from '@/db/repositories';
import type { Transaction } from '@/domain';

import { ExpenseScreen } from './ExpenseScreen';
import { TransferScreen } from './TransferScreen';

export function TransactionEditorScreen({ onDone, transactionId }: { onDone: () => void; transactionId: number }) {
  const db = useSQLiteContext();
  const reduceMotion = useReducedMotion();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const cancel = scheduleAfterSecondaryTransition(() => {
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
    }, reduceMotion === false);
    return () => {
      active = false;
      cancel();
    };
  }, [db, loadAttempt, reduceMotion, transactionId]);

  if (isLoading) {
    return <ScreenState message="Buscando os dados do lançamento…" status="loading" title="Carregando lançamento" />;
  }
  if (loadFailed) {
    return <ScreenState actionLabel="Tentar novamente" message="Não foi possível carregar o lançamento." onAction={() => { setLoadFailed(false); setIsLoading(true); setLoadAttempt((attempt) => attempt + 1); }} onSecondaryAction={onDone} secondaryActionLabel="Voltar" status="error" />;
  }
  if (!transaction) {
    return <ScreenState actionLabel="Voltar" message="Lançamento não encontrado." onAction={onDone} status="notFound" />;
  }
  if (transaction.kind === 'transfer') {
    return <TransferScreen deferInitialLoad={false} onDone={onDone} transactionId={transactionId} />;
  }
  if (transaction.kind === 'expense' || transaction.kind === 'income') {
    return <ExpenseScreen deferInitialLoad={false} kind={transaction.kind} onDone={onDone} transactionId={transactionId} />;
  }
  return <ScreenState actionLabel="Voltar" message="Este lançamento não pode ser editado por esta tela." onAction={onDone} status="empty" />;
}
