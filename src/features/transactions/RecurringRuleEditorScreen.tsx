import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  scheduleAfterSecondaryTransition,
  Screen,
  Text,
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

  if (isLoading) return <Screen style={styles.center}><Text tone="muted">Carregando recorrência…</Text></Screen>;
  if (loadFailed) return <Screen style={styles.center}><Text tone="negative">Não foi possível carregar a recorrência.</Text></Screen>;
  if (!rule?.isActive) return <Screen style={styles.center}><Text tone="negative">Regra recorrente não encontrada.</Text></Screen>;

  return <ExpenseScreen deferInitialLoad={false} kind={rule.kind} onDone={onDone} recurringRuleId={recurringRuleId} />;
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
