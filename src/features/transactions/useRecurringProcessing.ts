import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { processDueRecurringRulesAt } from '@/db/repositories';
import type { RecurringProcessingResult } from '@/db/repositories';
import { useDatabase } from '@/db/DatabaseProvider';

const completionListeners = new Set<(result: RecurringProcessingResult) => void>();

export function subscribeToRecurringProcessing(listener: (result: RecurringProcessingResult) => void): () => void {
  completionListeners.add(listener);
  return () => completionListeners.delete(listener);
}

export type RecurringProcessingState = {
  readonly isInitialProcessingComplete: boolean;
  readonly retry: () => void;
  readonly hasFailed: boolean;
};

export function useRecurringProcessing(): RecurringProcessingState {
  const db = useDatabase();
  const isProcessing = useRef(false);
  const [isInitialProcessingComplete, setIsInitialProcessingComplete] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const processToday = useCallback(async () => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    try {
      const result = await processDueRecurringRulesAt(db, new Date());
      if (result.generated.length > 0) completionListeners.forEach((listener) => listener(result));
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
