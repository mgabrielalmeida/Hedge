import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { IconGlyph } from './IconGlyph';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

type SuccessFeedbackContextValue = {
  showSuccess: (message: string) => void;
};

const SuccessFeedbackContext = createContext<SuccessFeedbackContextValue | null>(null);
const DISPLAY_DURATION_MS = 1_800;
const TRANSITION_DURATION_MS = 180;

/** Displays one transient confirmation after a completed write and navigation. */
export function SuccessFeedbackProvider({ children }: PropsWithChildren) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const [feedback, setFeedback] = useState<{ id: number; message: string } | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackId = useRef(0);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(8));
  const transition = useRef<Animated.CompositeAnimation | null>(null);

  const showSuccess = useCallback((nextMessage: string) => {
    feedbackId.current += 1;
    setFeedback({ id: feedbackId.current, message: nextMessage });
  }, []);

  useEffect(() => {
    if (!feedback) return;

    transition.current?.stop();
    opacity.setValue(reduceMotion === false ? 0 : 1);
    translateY.setValue(reduceMotion === false ? 8 : 0);
    const showAnimation = reduceMotion === false
      ? Animated.parallel([
        Animated.timing(opacity, { duration: TRANSITION_DURATION_MS, easing: Easing.out(Easing.cubic), toValue: 1, useNativeDriver: true }),
        Animated.timing(translateY, { duration: TRANSITION_DURATION_MS, easing: Easing.out(Easing.cubic), toValue: 0, useNativeDriver: true }),
      ])
      : null;
    transition.current = showAnimation;
    showAnimation?.start();

    timeout.current = setTimeout(() => {
      const hideAnimation = reduceMotion === false
        ? Animated.parallel([
          Animated.timing(opacity, { duration: TRANSITION_DURATION_MS, easing: Easing.in(Easing.cubic), toValue: 0, useNativeDriver: true }),
          Animated.timing(translateY, { duration: TRANSITION_DURATION_MS, easing: Easing.in(Easing.cubic), toValue: 8, useNativeDriver: true }),
        ])
        : null;
      if (!hideAnimation) {
        setFeedback((current) => current?.id === feedback.id ? null : current);
        return;
      }
      transition.current = hideAnimation;
      hideAnimation.start(({ finished }) => {
        if (finished) setFeedback((current) => current?.id === feedback.id ? null : current);
      });
    }, DISPLAY_DURATION_MS - TRANSITION_DURATION_MS);

    return () => {
      transition.current?.stop();
      transition.current = null;
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = null;
    };
  }, [feedback, opacity, reduceMotion, translateY]);

  return (
    <SuccessFeedbackContext.Provider value={{ showSuccess }}>
      {children}
      {feedback ? (
        <View pointerEvents="none" style={styles.layer}>
          <Animated.View
            accessibilityLiveRegion="polite"
            accessible
            style={[styles.toast, {
              backgroundColor: tokens.positiveContainer,
              borderRadius: tokens.radius.pill,
              paddingHorizontal: tokens.spacing.md,
              paddingVertical: tokens.spacing.sm,
              shadowColor: tokens.shadow,
            }, { opacity, transform: [{ translateY }] }]}
          >
            <IconGlyph color={tokens.positive} size={16} value="lucide:check" />
            <Text numberOfLines={1} style={[styles.message, { color: tokens.onPositiveContainer }]}>{feedback.message}</Text>
          </Animated.View>
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
  layer: { alignItems: 'center', bottom: 76, left: 0, paddingHorizontal: 24, position: 'absolute', right: 0, zIndex: 20 },
  toast: { alignItems: 'center', elevation: 2, flexDirection: 'row', maxWidth: 320, shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.12, shadowRadius: 4 },
  message: { flexShrink: 1, fontWeight: '600', marginLeft: 6 },
});
