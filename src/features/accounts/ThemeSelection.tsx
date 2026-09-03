import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components';
import type { ThemeName } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeProvider';

type ThemeSelectionProps = {
  onFinish: () => void;
};

const choices: readonly { name: ThemeName; title: string; description: string }[] = [
  { name: 'hedge', title: 'Hedge', description: 'Verdes serenos para o dia a dia.' },
  { name: 'ocean', title: 'Ocean', description: 'Azuis profundos e tranquilos.' },
];

export function ThemeSelection({ onFinish }: ThemeSelectionProps) {
  const { setThemeName, themeName, tokens } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function selectTheme(name: ThemeName) {
    setIsSaving(true);
    setError(null);
    const saved = await setThemeName(name);
    setIsSaving(false);
    if (!saved) {
      setError('O tema foi aplicado nesta sessão, mas não pôde ser salvo.');
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View>
          <Text variant="heading">Escolha seu tema</Text>
          <Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>
            Você poderá mudar essa preferência depois.
          </Text>
        </View>
        <View style={styles.choices}>
          {choices.map((choice) => {
            const selected = themeName === choice.name;
            return (
              <Pressable key={choice.name} onPress={() => void selectTheme(choice.name)}>
                <Card elevated={selected} style={[
                  styles.choice,
                  { borderColor: selected ? tokens.primary : tokens.border },
                ]}>
                  <Text variant="title">{choice.title}</Text>
                  <Text tone="muted" style={{ marginTop: tokens.spacing.xs }}>{choice.description}</Text>
                  {selected ? <Text style={{ color: tokens.primary, marginTop: tokens.spacing.sm }}>Selecionado</Text> : null}
                </Card>
              </Pressable>
            );
          })}
        </View>
        {error ? <Text tone="warning">{error}</Text> : null}
        <Button
          disabled={isSaving}
          label={isSaving ? 'Salvando tema…' : 'Entrar no Hedge'}
          onPress={onFinish}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 12 },
  choice: { borderWidth: 2 },
  container: { flex: 1, gap: 24, justifyContent: 'center' },
});
