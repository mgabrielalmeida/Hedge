import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';

type MonthNavigatorProps = {
  accessibilityLabel: string;
  label: string;
  nextDisabled?: boolean;
  onNext: () => void;
  onPrevious: () => void;
  previousDisabled?: boolean;
};

export function MonthNavigator({ accessibilityLabel, label, nextDisabled = false, onNext, onPrevious, previousDisabled = false }: MonthNavigatorProps) {
  const { tokens } = useTheme();
  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.container, { backgroundColor: tokens.surfaceSubtle, borderColor: tokens.borderStrong, borderRadius: tokens.radius.lg }]}>
      <MonthButton accessibilityLabel="Mês anterior" disabled={previousDisabled} onPress={onPrevious} symbol="‹" />
      <View style={styles.label}><Text tone="muted" variant="caption">Mês</Text><Text variant="title">{label}</Text></View>
      <MonthButton accessibilityLabel="Próximo mês" disabled={nextDisabled} onPress={onNext} symbol="›" />
    </View>
  );
}

function MonthButton({ accessibilityLabel, disabled, onPress, symbol }: { accessibilityLabel: string; disabled: boolean; onPress: () => void; symbol: string }) {
  const { tokens } = useTheme();
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: tokens.surface, borderColor: tokens.borderStrong, borderRadius: tokens.radius.pill, opacity: disabled ? 0.42 : pressed ? 0.76 : 1 }]}><Text style={{ color: tokens.primary, fontSize: 28, lineHeight: 28 }}>{symbol}</Text></Pressable>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  container: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 12, padding: 8 },
  label: { alignItems: 'center', flex: 1, gap: 2 },
});
