import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type ChipGroupProps = {
  accessibilityLabel: string;
  children: ReactNode;
  error?: boolean;
};

export function ChipGroup({ accessibilityLabel, children, error = false }: ChipGroupProps) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={[styles.group, error ? [styles.error, { borderColor: tokens.negative, borderRadius: tokens.radius.md }] : null]}
    >
      {children}
    </View>
  );
}

type SelectableChipProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onPress: () => void;
  selected: boolean;
};

export function SelectableChip({ accessibilityLabel, disabled = false, icon, label, onPress, selected }: SelectableChipProps) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? tokens.primary : tokens.surface,
          borderColor: selected ? tokens.primary : tokens.borderStrong,
          borderRadius: tokens.radius.pill,
          opacity: disabled ? 0.48 : pressed ? 0.76 : 1,
        },
      ]}
    >
      {icon ? <View pointerEvents="none">{icon}</View> : null}
      <Text numberOfLines={1} variant="caption" style={{ color: selected ? tokens.onPrimary : tokens.text, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 40, paddingHorizontal: 12, paddingVertical: 8 },
  error: { borderWidth: 1, padding: 8 },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
