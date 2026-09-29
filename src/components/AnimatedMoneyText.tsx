import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Easing } from 'react-native';

import { formatBrazilianCurrency } from '@/domain';

import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

const BALANCE_TRANSITION_DURATION = 240;

type AnimatedMoneyTextProps = Omit<ComponentProps<typeof Text>, 'children' | 'tone'> & {
  animateChanges?: boolean;
  cents: number;
  hidden?: boolean;
  replayKey?: number;
  tone?: ComponentProps<typeof Text>['tone'];
};

export function AnimatedMoneyText({ animateChanges = true, cents, hidden = false, replayKey, tone, ...props }: AnimatedMoneyTextProps) {
  const reduceMotion = useReducedMotion();
  const [value] = useState(() => new Animated.Value(cents));
  const previousCents = useRef(cents);
  const previousReplayKey = useRef<number | undefined>(undefined);
  const [displayedCents, setDisplayedCents] = useState(cents);

  useEffect(() => {
    const listener = value.addListener(({ value: nextValue }) => {
      setDisplayedCents(Math.round(nextValue));
    });
    return () => value.removeListener(listener);
  }, [value]);

  useEffect(() => {
    const shouldReplay = replayKey !== undefined && previousReplayKey.current !== replayKey;

    if (!shouldReplay && previousCents.current === cents) return;
    previousCents.current = cents;

    let animation: Animated.CompositeAnimation | null = null;
    value.stopAnimation((currentValue) => {
      if (hidden || reduceMotion !== false || (!shouldReplay && !animateChanges)) {
        value.setValue(cents);
        previousReplayKey.current = replayKey;
        return;
      }

      previousReplayKey.current = replayKey;
      value.setValue(shouldReplay ? 0 : currentValue);
      animation = Animated.timing(value, {
        duration: BALANCE_TRANSITION_DURATION,
        easing: Easing.out(Easing.cubic),
        toValue: cents,
        useNativeDriver: false,
      });
      animation.start();
    });

    return () => animation?.stop();
  }, [animateChanges, cents, hidden, reduceMotion, replayKey, value]);

  return (
    <Text
      {...props}
      accessibilityLabel={hidden ? 'Saldo oculto' : props.accessibilityLabel}
      tone={tone}
    >
      {hidden ? '••••••' : formatBrazilianCurrency(displayedCents)}
    </Text>
  );
}
