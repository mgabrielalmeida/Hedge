import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { processDueRecurringRules } from '@/db/repositories';
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

export function useRecurringProcessing(): RecurringProcessingState {
  const db = useSQLiteContext();
  const isProcessing = useRef(false);
  const [isInitialProcessingComplete, setIsInitialProcessingComplete] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const processToday = useCallback(async () => {
    if (isProcessing.current) return;
    isProcessing.current = true;
    try {
      const result = await processDueRecurringRules(db, getLocalCivilDate());
      if (result.generated.length > 0) completionListeners.forEach((listener) => listener());
      setHasFailed(false);
    } catch {
      setHasFailed(true);
    } finally {
      isProcessing.current = false;
    }
  }, [db]);

  useEffect(() => {
    let active = true;
    void processToday().finally(() => {
      if (active) setIsInitialProcessingComplete(true);
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void processToday();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [processToday]);

  return { hasFailed, isInitialProcessingComplete, retry: () => void processToday() };
}
