import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const { isDark, isReady, tokens } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: tokens.background }]}>
      <Text style={[styles.title, { color: tokens.text }]}>Hedge</Text>
      <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
        {isReady ? 'Seu espaço financeiro está sendo preparado.' : 'Carregando preferências…'}
      </Text>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
});
