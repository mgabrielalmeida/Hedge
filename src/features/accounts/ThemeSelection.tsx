import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, ScreenHeader, ScrollableScreen, Text } from '@/components';
import {
  getThemeTokens,
  THEME_OPTIONS,
  type AppearancePreference,
  type ThemeName,
} from '@/theme/theme';
import { useTheme } from '@/theme/ThemeProvider';

type ThemeSelectionProps = {
  actionLabel?: string;
  onFinish: () => void;
  showDescription?: boolean;
  title?: string;
};

const appearanceOptions: readonly {
  description: string;
  label: string;
  value: AppearancePreference;
}[] = [
  { value: 'system', label: 'Sistema', description: 'Acompanha o aparelho' },
  { value: 'light', label: 'Claro', description: 'Sempre claro' },
  { value: 'dark', label: 'Escuro', description: 'Sempre escuro' },
];

export function ThemeSelection({
  actionLabel = 'Continuar',
  onFinish,
  showDescription = true,
  title = 'Escolha seu tema',
}: ThemeSelectionProps) {
  const {
    appearance,
    isDark,
    setAppearance,
    setThemeName,
    themeName,
    tokens,
  } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function savePreference(update: () => Promise<boolean>) {
    setIsSaving(true);
    setError(null);
    const saved = await update();
    setIsSaving(false);

    if (!saved) {
      setError('A escolha foi aplicada nesta sessão, mas não pôde ser salva.');
    }
  }

  function selectTheme(name: ThemeName) {
    void savePreference(() => setThemeName(name));
  }

  function selectAppearance(nextAppearance: AppearancePreference) {
    void savePreference(() => setAppearance(nextAppearance));
  }

  return (
    <ScrollableScreen contentContainerStyle={styles.content}>
        <ScreenHeader description={showDescription ? 'Personalize as cores e escolha como o Hedge acompanha a aparência do aparelho.' : undefined} title={title} />

        <View style={styles.section}>
          <Text variant="title">Paleta</Text>
          <View style={styles.choices}>
            {THEME_OPTIONS.map((choice) => {
              const selected = themeName === choice.name;
              const preview = getThemeTokens(choice.name, isDark ? 'dark' : 'light');

              return (
                <Pressable
                  accessibilityLabel={`Tema ${choice.title}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={choice.name}
                  onPress={() => selectTheme(choice.name)}
                >
                  {({ pressed }) => (
                    <Card
                      elevated={selected}
                      style={[
                        styles.choice,
                        {
                          borderColor: selected ? tokens.focusRing : tokens.border,
                          borderWidth: selected ? 2 : 1,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <ThemePreview preview={preview} selected={selected} />
                      <View style={styles.choiceText}>
                        <Text variant="title">{choice.title}</Text>
                        <Text tone="muted" variant="caption">{choice.description}</Text>
                      </View>
                    </Card>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text variant="title">Aparência</Text>
          <View style={styles.appearanceChoices}>
            {appearanceOptions.map((option) => {
              const selected = appearance === option.value;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => selectAppearance(option.value)}
                  style={({ pressed }) => [
                    styles.appearanceChoice,
                    {
                      backgroundColor: selected ? tokens.primaryContainer : tokens.surface,
                      borderColor: selected ? tokens.focusRing : tokens.border,
                      borderRadius: tokens.radius.md,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    variant="caption"
                    style={{ color: selected ? tokens.onPrimaryContainer : tokens.text, fontWeight: '700' }}
                  >
                    {option.label}
                  </Text>
                  <Text
                    variant="caption"
                    style={{ color: selected ? tokens.onPrimaryContainer : tokens.textMuted }}
                  >
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <Text tone="warning">{error}</Text> : null}
        <Button disabled={isSaving} label={isSaving ? 'Salvando…' : actionLabel} onPress={onFinish} />
    </ScrollableScreen>
  );
}

function ThemePreview({
  preview,
  selected,
}: {
  preview: ReturnType<typeof getThemeTokens>;
  selected: boolean;
}) {
  return (
    <View style={[styles.preview, { backgroundColor: preview.background, borderColor: preview.border }]}>
      <View style={[styles.previewSurface, { backgroundColor: preview.surface }]}>
        <View style={styles.swatches}>
          <View style={[styles.swatch, { backgroundColor: preview.primary }]} />
          <View style={[styles.swatch, { backgroundColor: preview.positive }]} />
          <View style={[styles.swatch, { backgroundColor: preview.warning }]} />
        </View>
        <Text style={{ color: preview.text, fontWeight: '700' }}>{selected ? '✓ Ativo' : 'Hedge'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appearanceChoice: { borderWidth: 1, flex: 1, gap: 2, minHeight: 68, padding: 10 },
  appearanceChoices: { flexDirection: 'row', gap: 8 },
  choice: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  choices: { gap: 10 },
  choiceText: { flex: 1, gap: 2 },
  content: { flexGrow: 1, gap: 24, paddingBottom: 32, paddingTop: 24 },
  preview: { borderRadius: 12, borderWidth: 1, padding: 7, width: 104 },
  previewSurface: { borderRadius: 8, gap: 7, padding: 8 },
  section: { gap: 12 },
  swatch: { borderRadius: 8, height: 16, width: 16 },
  swatches: { flexDirection: 'row', gap: 5 },
});
