import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type CardProps = PropsWithChildren<{
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ children, elevated = false, style }: CardProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? tokens.surfaceElevated : tokens.surface,
          borderColor: tokens.border,
          borderRadius: tokens.radius.lg,
          padding: tokens.spacing.lg,
        },
        elevated ? [styles.elevated, { shadowColor: tokens.text }] : undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  elevated: { elevation: 2, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3 },
});
