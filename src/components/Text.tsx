import type { ComponentProps } from 'react';
import { StyleSheet, Text as NativeText, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

type TextVariant = 'caption' | 'body' | 'bodyLarge' | 'title' | 'heading' | 'display';
type TextTone = 'default' | 'muted' | 'positive' | 'negative' | 'warning' | 'info';

type AppTextProps = ComponentProps<typeof NativeText> & {
  tone?: TextTone;
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
};

export function Text({ style, tone = 'default', variant = 'body', ...props }: AppTextProps) {
  const { tokens } = useTheme();
  const colorByTone = {
    default: tokens.text,
    info: tokens.info,
    muted: tokens.textMuted,
    negative: tokens.negative,
    positive: tokens.positive,
    warning: tokens.warning,
  } satisfies Record<TextTone, string>;

  return (
    <NativeText
      {...props}
      style={[
        styles.base,
        { color: colorByTone[tone], fontSize: tokens.typography[variant] },
        variantStyles[variant],
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({ base: { fontWeight: '400' } });

const variantStyles = StyleSheet.create({
  caption: { lineHeight: 16 },
  body: { lineHeight: 24 },
  bodyLarge: { lineHeight: 28 },
  title: { fontWeight: '600', lineHeight: 28 },
  heading: { fontWeight: '700', lineHeight: 34 },
  display: { fontWeight: '700', letterSpacing: -0.5, lineHeight: 42 },
});
