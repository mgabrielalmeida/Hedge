import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import {
  scheduleAfterSecondaryTransition,
  ScreenState,
  useReducedMotion,
} from '@/components';
import { findRecurringRuleById } from '@/db/repositories';
import type { RecurringRule } from '@/domain';

import { ExpenseScreen } from './ExpenseScreen';

export function RecurringRuleEditorScreen({ onDone, recurringRuleId }: { onDone: () => void; recurringRuleId: number }) {
  const db = useSQLiteContext();
  const reduceMotion = useReducedMotion();
  const [rule, setRule] = useState<RecurringRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const cancel = scheduleAfterSecondaryTransition(() => {
      void findRecurringRuleById(db, recurringRuleId)
        .then((item) => {
          if (active) setRule(item);
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
  }, [db, recurringRuleId, reduceMotion]);

  if (isLoading) return <ScreenState message="Buscando os dados da recorrência…" status="loading" title="Carregando recorrência" />;
  if (loadFailed) return <ScreenState actionLabel="Voltar" message="Não foi possível carregar a recorrência." onAction={onDone} status="error" />;
  if (!rule?.isActive) return <ScreenState actionLabel="Voltar" message="Regra recorrente não encontrada." onAction={onDone} status="notFound" />;

  return <ExpenseScreen deferInitialLoad={false} kind={rule.kind} onDone={onDone} recurringRuleId={recurringRuleId} />;
}
