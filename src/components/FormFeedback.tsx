import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type FormFeedbackProps = {
  message: string;
  title?: string;
};

/** A consistent, visible explanation for a form that could not be submitted. */
export function FormFeedback({ message, title = 'Revise as informações' }: FormFeedbackProps) {
  const { tokens } = useTheme();

  return (
    <View
      accessibilityLiveRegion="assertive"
      accessible
      style={[styles.container, {
        backgroundColor: tokens.negativeContainer,
        borderColor: tokens.negative,
        borderRadius: tokens.radius.md,
        padding: tokens.spacing.md,
      }]}
    >
      <Text tone="negative" variant="caption">{title}</Text>
      <Text tone="negative" style={{ marginTop: tokens.spacing.xs }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, width: '100%' },
});
