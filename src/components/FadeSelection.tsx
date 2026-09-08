import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated } from 'react-native';

import { useReducedMotion } from './useReducedMotion';

const FADE_SELECTION_DURATION = 160;

type FadeSelectionProps = {
  children: ReactNode;
  selectionKey: number | string | null | undefined;
};

export function FadeSelection({ children, selectionKey }: FadeSelectionProps) {
  const reduceMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const previousSelectionKey = useRef(selectionKey);

  useEffect(() => {
    if (previousSelectionKey.current === selectionKey) return;
    previousSelectionKey.current = selectionKey;

    if (reduceMotion !== false) {
      opacity.setValue(1);
      return;
    }

    opacity.stopAnimation();
    opacity.setValue(0.45);
    const animation = Animated.timing(opacity, {
      duration: FADE_SELECTION_DURATION,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion, selectionKey]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}
