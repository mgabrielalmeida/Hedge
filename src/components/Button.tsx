import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

type ButtonProps = Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
};

export function Button({ disabled = false, label, style, variant = 'primary', ...props }: ButtonProps) {
  const { tokens } = useTheme();
  const colors = getColors(variant, tokens);

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderRadius: tokens.radius.md,
          minHeight: 48,
          opacity: disabled ? 0.5 : pressed ? 0.84 : 1,
          paddingHorizontal: tokens.spacing.lg,
        },
        style,
      ]}
    >
      <Text style={{ color: colors.color, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function getColors(variant: ButtonVariant, tokens: ReturnType<typeof useTheme>['tokens']) {
  if (variant === 'primary') return { backgroundColor: tokens.primary, borderColor: tokens.primary, color: tokens.onPrimary };
  if (variant === 'destructive') return { backgroundColor: tokens.negative, borderColor: tokens.negative, color: tokens.onNegative };
  if (variant === 'ghost') return { backgroundColor: 'transparent', borderColor: 'transparent', color: tokens.primary };
  return { backgroundColor: tokens.primaryContainer, borderColor: tokens.primaryContainer, color: tokens.onPrimaryContainer };
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderWidth: 1, justifyContent: 'center' },
});
