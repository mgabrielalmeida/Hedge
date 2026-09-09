import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  FormFeedback,
  ScreenHeader,
  SegmentedControl,
  ScrollableScreen,
  Text,
  hexToHsl,
  hslToHex,
  useSuccessFeedback,
} from '@/components';
import type { CustomThemeDefinition } from '@/theme/customTheme';
import { getThemeTokens } from '@/theme/theme';
import { useTheme } from '@/theme/ThemeProvider';

type CustomThemeEditorScreenProps = {
  onBack: () => void;
};

const HUE_OPTIONS = [
  { label: 'Vermelho', value: 0 },
  { label: 'Laranja', value: 30 },
  { label: 'Dourado', value: 55 },
  { label: 'Lima', value: 85 },
  { label: 'Verde', value: 125 },
  { label: 'Menta', value: 160 },
  { label: 'Ciano', value: 190 },
  { label: 'Azul', value: 215 },
  { label: 'Índigo', value: 245 },
  { label: 'Violeta', value: 275 },
  { label: 'Magenta', value: 310 },
  { label: 'Rosa', value: 335 },
] as const;

const NEUTRAL_OPTIONS = [
  { label: 'Preto', lightness: 0 },
  { label: 'Cinza grafite', lightness: 18 },
  { label: 'Cinza escuro', lightness: 35 },
  { label: 'Cinza médio', lightness: 52 },
  { label: 'Cinza claro', lightness: 72 },
  { label: 'Prata', lightness: 86 },
  { label: 'Branco', lightness: 100 },
] as const;

type ColorGroup = 'colored' | 'neutral';

export function CustomThemeEditorScreen({ onBack }: CustomThemeEditorScreenProps) {
  const { activateCustomTheme, customTheme, isDark } = useTheme();
  const { showSuccess } = useSuccessFeedback();
  const [draft, setDraft] = useState<CustomThemeDefinition>(customTheme);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = getThemeTokens('custom', isDark ? 'dark' : 'light', draft);

  async function save() {
    setIsSaving(true);
    setError(null);
    const saved = await activateCustomTheme(draft);
    setIsSaving(false);

    if (!saved) {
      setError('O tema foi aplicado nesta sessão, mas não pôde ser salvo no aparelho.');
      return;
    }

    showSuccess('Tema Custom salvo e ativado.');
    onBack();
  }

  return (
    <ScrollableScreen contentContainerStyle={styles.content}>
      <ScreenHeader
        description="Escolha duas cores. O Hedge cria automaticamente superfícies, textos e estados com contraste para os modos claro e escuro."
        onBack={onBack}
        title="Editar tema Custom"
      />

      <ThemePreview preview={preview} />

      <ColorSeedPicker
        description="Usada em botões, seleção, foco e elementos de maior destaque."
        label="Cor principal"
        onChange={(primary) => setDraft((current) => ({ ...current, primary }))}
        value={draft.primary}
      />

      <ColorSeedPicker
        description="Define o tom das superfícies e dos elementos informativos."
        label="Cor secundária"
        onChange={(secondary) => setDraft((current) => ({ ...current, secondary }))}
        value={draft.secondary}
      />

      {error ? <FormFeedback message={error} title="Não foi possível salvar" /> : null}
      <Button
        disabled={isSaving}
        label={isSaving ? 'Salvando…' : 'Salvar e usar este tema'}
        onPress={() => void save()}
      />
    </ScrollableScreen>
  );
}

function ThemePreview({ preview }: { preview: ReturnType<typeof getThemeTokens> }) {
  return (
    <View
      accessibilityLabel="Prévia do tema personalizado"
      style={[
        styles.preview,
        {
          backgroundColor: preview.background,
          borderColor: preview.border,
          borderRadius: preview.radius.lg,
          padding: preview.spacing.lg,
        },
      ]}
    >
      <Text style={{ color: preview.text, fontSize: preview.typography.title, fontWeight: '700' }}>
        Prévia simples
      </Text>
      <Text style={{ color: preview.textMuted, marginTop: preview.spacing.xs }}>
        Uma visão rápida das cores principais do aplicativo.
      </Text>
      <View style={[styles.previewCard, {
        backgroundColor: preview.surface,
        borderColor: preview.border,
        borderRadius: preview.radius.md,
        marginTop: preview.spacing.md,
        padding: preview.spacing.md,
      }]}
      >
        <View style={styles.previewValues}>
          <View>
            <Text style={{ color: preview.textMuted, fontSize: preview.typography.caption }}>Saldo mensal</Text>
            <Text style={{ color: preview.text, fontSize: preview.typography.title, fontWeight: '700' }}>R$ 2.450,00</Text>
          </View>
          <View style={[styles.infoBadge, { backgroundColor: preview.infoContainer, borderRadius: preview.radius.pill }]}>
            <Text style={{ color: preview.onInfoContainer, fontSize: preview.typography.caption }}>Em dia</Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.status, { backgroundColor: preview.positive }]} />
          <View style={[styles.status, { backgroundColor: preview.warning }]} />
          <View style={[styles.status, { backgroundColor: preview.negative }]} />
        </View>
      </View>
      <View style={[styles.previewButton, {
        backgroundColor: preview.primary,
        borderRadius: preview.radius.md,
        marginTop: preview.spacing.md,
      }]}
      >
        <Text style={{ color: preview.onPrimary, fontWeight: '700' }}>Nova transação</Text>
      </View>
    </View>
  );
}

function ColorSeedPicker({
  description,
  label,
  onChange,
  value,
}: {
  description: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const { tokens } = useTheme();
  const current = hexToHsl(value) ?? { hue: 0, saturation: 65, lightness: 50 };
  const [activeColorGroup, setActiveColorGroup] = useState<ColorGroup>(
    current.saturation < 2 ? 'neutral' : 'colored',
  );
  const selectedHue = current.saturation < 2 ? null : findClosestHue(current.hue);

  return (
    <Card>
      <Text variant="title">{label}</Text>
      <Text tone="muted" variant="caption" style={{ marginTop: tokens.spacing.xs }}>
        {description}
      </Text>
      <View style={{ marginTop: tokens.spacing.md }}>
        <SegmentedControl
          accessibilityLabel={`Tipo de ${label.toLowerCase()}`}
          onChange={setActiveColorGroup}
          options={[
            { label: 'Coloridas', value: 'colored' },
            { label: 'Neutras', value: 'neutral' },
          ]}
          value={activeColorGroup}
        />
      </View>
      <View
        accessibilityLabel={activeColorGroup === 'colored' ? `${label}: cores coloridas` : `${label}: cores neutras`}
        accessibilityRole="radiogroup"
        style={[styles.colorGrid, { marginTop: tokens.spacing.md }]}
      >
        {activeColorGroup === 'colored' ? HUE_OPTIONS.map((option) => {
          const selected = option.value === selectedHue;
          const swatchColor = hslToHex(option.value, 76, 50);

          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onChange(hslToHex(
                option.value,
                Math.max(current.saturation, 50),
                Math.min(Math.max(current.lightness, 36), 62),
              ))}
              style={({ pressed }) => [
                styles.colorChoice,
                {
                  backgroundColor: swatchColor,
                  borderColor: selected ? tokens.focusRing : tokens.border,
                  borderRadius: tokens.radius.pill,
                  borderWidth: selected ? 4 : 1,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            />
          );
        }) : NEUTRAL_OPTIONS.map((option) => {
          const selected = current.saturation < 2 && Math.abs(current.lightness - option.lightness) < 0.5;
          const swatchColor = hslToHex(0, 0, option.lightness);

          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option.label}
              onPress={() => onChange(swatchColor)}
              style={({ pressed }) => [
                styles.colorChoice,
                {
                  backgroundColor: swatchColor,
                  borderColor: selected ? tokens.focusRing : tokens.borderStrong,
                  borderRadius: tokens.radius.pill,
                  borderWidth: selected ? 4 : 1,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            />
          );
        })}
      </View>
    </Card>
  );
}

function findClosestHue(hue: number): number {
  return HUE_OPTIONS.reduce((closest, option) => {
    const closestDistance = Math.min(Math.abs(closest - hue), 360 - Math.abs(closest - hue));
    const optionDistance = Math.min(Math.abs(option.value - hue), 360 - Math.abs(option.value - hue));
    return optionDistance < closestDistance ? option.value : closest;
  }, HUE_OPTIONS[0].value as number);
}

const styles = StyleSheet.create({
  colorChoice: { height: 42, width: 42 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  content: { gap: 24, paddingBottom: 32 },
  infoBadge: { paddingHorizontal: 10, paddingVertical: 5 },
  preview: { borderWidth: 1 },
  previewButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  previewCard: { borderWidth: 1 },
  previewValues: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  status: { borderRadius: 5, height: 10, width: 38 },
  statusRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
});
