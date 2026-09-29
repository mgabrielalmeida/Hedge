import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { processDueRecurringRules } from '@/db/repositories';
import type { RepositoryDatabase } from '@/db/repositories/database';
import { getLocalCivilDate } from '@/utils/localCivilDate';

const completionListeners = new Set<() => void>();

export function subscribeToRecurringProcessing(listener: () => void): () => void {
  completionListeners.add(listener);
  return () => completionListeners.delete(listener);
}

export type RecurringProcessingState = {
  readonly isInitialProcessingComplete: boolean;
  readonly retry: () => void;
  readonly hasFailed: boolean;
};

export async function processAllDueRecurringRules(
  db: RepositoryDatabase,
  scheduledDate = getLocalCivilDate(),
): Promise<boolean> {
  let hasMore = true;
  let generatedAny = false;
  while (hasMore) {
    const result = await processDueRecurringRules(db, scheduledDate);
    generatedAny ||= result.generated.length > 0;
    hasMore = result.hasMore;
    if (hasMore) await yieldToEventLoop();
  }
  return generatedAny;
}

export function useRecurringProcessing(): RecurringProcessingState {
  const db = useSQLiteContext();
  const isProcessing = useRef(false);
  const [isInitialProcessingComplete, setIsInitialProcessingComplete] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const processToday = useCallback(async () => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    try {
      const generatedAny = await processAllDueRecurringRules(db);
      if (generatedAny) completionListeners.forEach((listener) => listener());
      setHasFailed(false);
    } catch {
      setHasFailed(true);
    } finally {
      isProcessing.current = false;
    }
  }, [db]);

  useEffect(() => {
    let active = true;
    const initialProcessing = setTimeout(() => {
      void processToday().finally(() => {
        if (active) setIsInitialProcessingComplete(true);
      });
    }, 0);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void processToday();
    });
    return () => {
      active = false;
      clearTimeout(initialProcessing);
      subscription.remove();
    };
  }, [processToday]);

  return { hasFailed, isInitialProcessingComplete, retry: () => void processToday() };
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
