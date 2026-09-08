import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { ThemeTokens } from '@/theme/theme';
import { Button } from './Button';

type BootstrapScreenProps = {
  isDark: boolean;
  message: string;
  title: string;
  tokens: ThemeTokens;
  isLoading?: boolean;
  onRetry?: () => void;
};

export function BootstrapScreen({
  isDark,
  isLoading = false,
  message,
  title,
  tokens,
  onRetry,
}: BootstrapScreenProps) {
  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      {isLoading ? <ActivityIndicator color={tokens.primary} size="large" /> : null}
      <Text style={[styles.title, { color: tokens.text }]}>{title}</Text>
      <Text style={[styles.message, { color: tokens.textMuted }]}>{message}</Text>
      {onRetry ? <Button label="Tentar novamente" onPress={onRetry} style={styles.retry} /> : null}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  retry: { marginTop: 24 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
});
