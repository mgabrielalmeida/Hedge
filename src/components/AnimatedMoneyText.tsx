import { useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Easing } from 'react-native';

import { formatBrazilianCurrency } from '@/domain';

import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

const BALANCE_TRANSITION_DURATION = 360;

type AnimatedMoneyTextProps = Omit<ComponentProps<typeof Text>, 'children' | 'tone'> & {
  cents: number;
  hidden?: boolean;
  tone?: ComponentProps<typeof Text>['tone'];
};

export function AnimatedMoneyText({ cents, hidden = false, tone, ...props }: AnimatedMoneyTextProps) {
  const reduceMotion = useReducedMotion();
  const [value] = useState(() => new Animated.Value(cents));
  const previousCents = useRef(cents);
  const [displayedCents, setDisplayedCents] = useState(cents);

  useEffect(() => {
    const listener = value.addListener(({ value: nextValue }) => {
      setDisplayedCents(Math.round(nextValue));
    });
    return () => value.removeListener(listener);
  }, [value]);

  useEffect(() => {
    if (previousCents.current === cents) return;
    previousCents.current = cents;

    let animation: Animated.CompositeAnimation | null = null;
    value.stopAnimation((currentValue) => {
      if (hidden || reduceMotion !== false) {
        value.setValue(cents);
        return;
      }

      value.setValue(currentValue);
      animation = Animated.timing(value, {
        duration: BALANCE_TRANSITION_DURATION,
        easing: Easing.out(Easing.cubic),
        toValue: cents,
        useNativeDriver: false,
      });
      animation.start();
    });

    return () => animation?.stop();
  }, [cents, hidden, reduceMotion, value]);

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
