import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Screen } from './Screen';
import { Text } from './Text';

type ScreenStateProps = {
  actionLabel?: string;
  fullScreen?: boolean;
  message: string;
  onAction?: () => void;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
  status: 'empty' | 'error' | 'loading' | 'notFound';
  title?: string;
};

export function ScreenState({ actionLabel, fullScreen = true, message, onAction, onSecondaryAction, secondaryActionLabel, status, title }: ScreenStateProps) {
  const { tokens } = useTheme();
  const tone = status === 'error' || status === 'notFound' ? 'negative' : 'muted';
  const defaultTitle = status === 'loading'
    ? 'Carregando'
    : status === 'empty'
      ? 'Nada por aqui'
      : status === 'notFound'
        ? 'Não encontrado'
        : 'Algo deu errado';

  const content = (
    <View style={styles.container}>
      {status === 'loading' ? <ActivityIndicator color={tokens.primary} size="large" /> : null}
      <Text style={{ marginTop: status === 'loading' ? tokens.spacing.lg : 0 }} variant="title">
        {title ?? defaultTitle}
      </Text>
      <Text tone={tone} style={[styles.message, { marginTop: tokens.spacing.sm }]}>{message}</Text>
      {onAction && actionLabel ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: tokens.spacing.lg }} /> : null}
      {onSecondaryAction && secondaryActionLabel ? <Button label={secondaryActionLabel} onPress={onSecondaryAction} style={{ marginTop: tokens.spacing.sm }} variant="ghost" /> : null}
    </View>
  );
  return fullScreen ? <Screen>{content}</Screen> : content;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 24 },
  message: { textAlign: 'center' },
});
