import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type BalanceVisibilityButtonProps = {
  hidden: boolean;
  onPress: () => void;
};

export function BalanceVisibilityButton({ hidden, onPress }: BalanceVisibilityButtonProps) {
  const { tokens } = useTheme();
  const label = hidden ? 'Mostrar saldos' : 'Ocultar saldos';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tokens.surfaceSubtle,
          borderColor: tokens.border,
          borderRadius: tokens.radius.pill,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={{ color: tokens.primary, fontWeight: '600' }} variant="caption">
        {hidden ? 'Mostrar' : 'Ocultar'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 10,
  },
});
