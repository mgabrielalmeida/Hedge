import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const { isDark, isReady, tokens } = useTheme();

  return (
    <Screen>
      <View style={styles.container}>
        <Text variant="heading">Hedge</Text>
        <Card elevated style={{ marginTop: tokens.spacing.lg }}>
          <Text variant="title">Seu espaço financeiro</Text>
          <Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>
            {isReady ? 'Tudo pronto para seus próximos lançamentos.' : 'Carregando preferências…'}
          </Text>
        </Card>
      </View>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
});
