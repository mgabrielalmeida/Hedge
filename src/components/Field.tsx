import type { ComponentProps } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type FieldProps = Omit<ComponentProps<typeof TextInput>, 'style'> & {
  error?: string;
  helperText?: string;
  inputStyle?: StyleProp<TextStyle>;
  label: string;
  style?: StyleProp<ViewStyle>;
};

export function Field({ error, helperText, inputStyle, label, style, ...props }: FieldProps) {
  const { tokens } = useTheme();
  const message = error ?? helperText;

  return (
    <View style={[styles.container, style]}>
      <Text variant="caption" style={{ color: tokens.textMuted, marginBottom: tokens.spacing.sm }}>
        {label}
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={tokens.textMuted}
        style={[
          styles.input,
          {
            borderColor: error ? tokens.negative : tokens.border,
            borderRadius: tokens.radius.md,
            color: tokens.text,
            fontSize: tokens.typography.body,
            paddingHorizontal: tokens.spacing.md,
          },
          inputStyle,
        ]}
      />
      {message ? (
        <Text tone={error ? 'negative' : 'muted'} variant="caption" style={{ marginTop: tokens.spacing.xs }}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  input: { borderWidth: 1, minHeight: 48, paddingVertical: 0 },
});
