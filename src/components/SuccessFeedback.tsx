import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type SuccessFeedbackContextValue = {
  showSuccess: (message: string) => void;
};

const SuccessFeedbackContext = createContext<SuccessFeedbackContextValue | null>(null);
const DISMISS_DELAY_MS = 4_000;

/** Displays one transient confirmation after a completed write and navigation. */
export function SuccessFeedbackProvider({ children }: PropsWithChildren) {
  const { tokens } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = useCallback((nextMessage: string) => {
    if (timeout.current) clearTimeout(timeout.current);
    setMessage(nextMessage);
    timeout.current = setTimeout(() => {
      setMessage(null);
      timeout.current = null;
    }, DISMISS_DELAY_MS);
  }, []);

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
  }, []);

  return (
    <SuccessFeedbackContext.Provider value={{ showSuccess }}>
      {children}
      {message ? (
        <View pointerEvents="none" style={styles.layer}>
          <View
            accessibilityLiveRegion="polite"
            accessible
            style={[styles.toast, {
              backgroundColor: tokens.positiveContainer,
              borderColor: tokens.positive,
              borderRadius: tokens.radius.md,
              padding: tokens.spacing.md,
            }]}
          >
            <Text style={{ color: tokens.onPositiveContainer, fontWeight: '700' }}>Concluído</Text>
            <Text style={{ color: tokens.onPositiveContainer, marginTop: tokens.spacing.xs }}>{message}</Text>
          </View>
        </View>
      ) : null}
    </SuccessFeedbackContext.Provider>
  );
}

export function useSuccessFeedback(): SuccessFeedbackContextValue {
  const feedback = useContext(SuccessFeedbackContext);
  if (!feedback) throw new Error('useSuccessFeedback must be used within a SuccessFeedbackProvider.');
  return feedback;
}

const styles = StyleSheet.create({
  layer: { left: 0, paddingHorizontal: 24, position: 'absolute', right: 0, top: 56, zIndex: 20 },
  toast: { borderWidth: 1, elevation: 4, shadowColor: '#000', shadowOffset: { height: 3, width: 0 }, shadowOpacity: 0.18, shadowRadius: 8 },
});
