import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

type SegmentedControlOption<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  value: T;
};

const INDICATOR_DURATION = 220;

export function SegmentedControl<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const selectedIndex = Math.max(options.findIndex((option) => option.value === value), 0);
  const [indicatorIndex] = useState(() => new Animated.Value(selectedIndex));
  const [width, setWidth] = useState(0);
  const optionWidth = Math.max(width - 8, 0) / options.length;
  const inputRange = options.map((_, index) => index);
  const outputRange = options.map((_, index) => index * optionWidth + 4);

  useEffect(() => {
    if (reduceMotion !== false) {
      indicatorIndex.setValue(selectedIndex);
      return;
    }

    const animation = Animated.timing(indicatorIndex, {
      duration: INDICATOR_DURATION,
      easing: Easing.out(Easing.cubic),
      toValue: selectedIndex,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [indicatorIndex, reduceMotion, selectedIndex]);

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        setWidth((currentWidth) => currentWidth === nextWidth ? currentWidth : nextWidth);
      }}
      style={[styles.control, { backgroundColor: tokens.surfaceSubtle, borderColor: tokens.border }]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              backgroundColor: tokens.surfaceElevated,
              borderColor: tokens.borderStrong,
              borderRadius: tokens.radius.md,
              transform: [{ translateX: indicatorIndex.interpolate({ inputRange, outputRange }) }],
              width: optionWidth,
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              { borderRadius: tokens.radius.md, opacity: pressed ? 0.76 : 1 },
            ]}
          >
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              numberOfLines={1}
              variant="caption"
              style={{
                color: selected ? tokens.primary : tokens.textMuted,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  control: { borderWidth: 1, flexDirection: 'row', padding: 4, position: 'relative' },
  indicator: { bottom: 4, borderWidth: 1, position: 'absolute', top: 4 },
  option: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
});
