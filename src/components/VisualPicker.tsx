import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColorIndex } from '@/domain';

import { Text } from './Text';
import { IconGlyph } from './IconGlyph';
import { SegmentedControl } from './SegmentedControl';
import {
  hexToHsl,
  hslToHex,
  getThemeColorOptions,
  normalizeHexColor,
  resolveThemeColorValue,
  type IconOption,
} from './visualOptions';

type VisualPickerProps = {
  colorValue: string;
  iconOptions: readonly IconOption[];
  iconValue: string;
  label?: string;
  onCustomColorChange: (value: string) => void;
  onIconChange: (value: string) => void;
  onThemeColorChange: (index: ThemeColorIndex, value: string) => void;
  themeColorIndex: number | null;
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

const SATURATION_OPTIONS = [
  { label: 'Suave', value: 35 },
  { label: 'Natural', value: 65 },
  { label: 'Viva', value: 90 },
] as const;

const LIGHTNESS_OPTIONS = [
  { label: 'Clara', value: 68 },
  { label: 'Equilibrada', value: 50 },
  { label: 'Profunda', value: 34 },
] as const;

export function VisualPicker({
  colorValue,
  iconOptions,
  iconValue,
  onCustomColorChange,
  onIconChange,
  onThemeColorChange,
  themeColorIndex,
}: VisualPickerProps) {
  const { tokens } = useTheme();
  const selectedIconKind = iconOptions.find((option) => option.value === iconValue)?.kind;
  const [activeIconKind, setActiveIconKind] = useState<'emoji' | 'minimalist'>(
    selectedIconKind ?? 'minimalist',
  );
  const themeColorOptions = getThemeColorOptions(tokens.primary);
  const resolvedColorValue = resolveThemeColorValue(colorValue, themeColorIndex, tokens.primary);

  const visibleIconOptions = iconOptions.filter((option) => option.kind === activeIconKind);

  return (
    <View style={styles.container}>
      <Text variant="caption" style={{ color: tokens.textMuted }}>Ícone</Text>
      <SegmentedControl
        accessibilityLabel="Tipo de ícone"
        onChange={setActiveIconKind}
        options={[
          { label: 'Minimalistas', value: 'minimalist' },
          { label: 'Emojis', value: 'emoji' },
        ]}
        value={activeIconKind}
      />
      <View
        accessibilityLabel={activeIconKind === 'minimalist' ? 'Ícones minimalistas' : 'Emojis'}
        accessibilityRole="radiogroup"
        style={styles.grid}
      >
        {visibleIconOptions.map((option) => {
          const selected = iconValue === option.value;

          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onIconChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: resolvedColorValue,
                  borderColor: selected ? tokens.focusRing : tokens.border,
                  borderRadius: tokens.radius.md,
                  borderWidth: selected ? 3 : 1,
                  opacity: pressed ? 0.74 : 1,
                },
              ]}
            >
              <IconGlyph size={22} value={option.value} />
              {selected ? <SelectionBadge /> : null}
            </Pressable>
          );
        })}
      </View>

      <Text variant="caption" style={{ color: tokens.textMuted }}>Cor</Text>
      <View accessibilityLabel="Cor do indicador visual" accessibilityRole="radiogroup" style={styles.grid}>
        {themeColorOptions.map((option, index) => {
          const selected = themeColorIndex === index;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onThemeColorChange(index as ThemeColorIndex, option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: option.value,
                  borderColor: selected ? tokens.focusRing : tokens.border,
                  borderRadius: tokens.radius.md,
                  borderWidth: selected ? 3 : 1,
                  opacity: pressed ? 0.74 : 1,
                },
              ]}
            >
              {selected ? <SelectionBadge /> : null}
            </Pressable>
          );
        })}
      </View>

      <ColorMixer onChange={onCustomColorChange} value={resolvedColorValue} />
    </View>
  );
}

function ColorMixer({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const { tokens } = useTheme();
  const selectedColor = normalizeHexColor(value) ?? tokens.primary;
  const color = hexToHsl(selectedColor) ?? { hue: 125, saturation: 65, lightness: 50 };
  const selectedHue = findClosestHue(color.hue);
  const selectedHueLabel = HUE_OPTIONS.find((option) => option.value === selectedHue)?.label;
  const selectedSaturation = findClosestValue(SATURATION_OPTIONS, color.saturation);
  const selectedLightness = findClosestValue(LIGHTNESS_OPTIONS, color.lightness);

  return (
    <View
      style={[
        styles.mixer,
        {
          backgroundColor: tokens.surfaceSubtle,
          borderColor: tokens.border,
          borderRadius: tokens.radius.lg,
        },
      ]}
    >
      <View>
        <Text variant="title">Misture sua cor</Text>
        <Text tone="muted" variant="caption" style={{ marginTop: tokens.spacing.xs }}>
          Escolha um tom na roda e ajuste sua aparência.
        </Text>
      </View>

      <View
        accessibilityLabel="Roda de cores"
        accessibilityRole="radiogroup"
        style={[
          styles.wheel,
          {
            backgroundColor: tokens.surface,
            borderColor: tokens.border,
            borderRadius: tokens.radius.pill,
          },
        ]}
      >
        {HUE_OPTIONS.map((option, index) => {
          const angle = (index / HUE_OPTIONS.length) * Math.PI * 2 - Math.PI / 2;
          const selected = option.value === selectedHue;
          const swatchColor = hslToHex(option.value, 78, 52);

          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onChange(hslToHex(
                option.value,
                color.saturation < 20 ? 65 : color.saturation,
                color.lightness,
              ))}
              style={({ pressed }) => [
                styles.hueButton,
                {
                  backgroundColor: selected ? tokens.primaryContainer : tokens.surfaceSubtle,
                  borderColor: selected ? tokens.focusRing : 'transparent',
                  left: 88 + Math.cos(angle) * 78,
                  opacity: pressed ? 0.72 : 1,
                  top: 88 + Math.sin(angle) * 78,
                },
              ]}
            >
              <View style={[styles.hueSwatch, { backgroundColor: swatchColor }]} />
            </Pressable>
          );
        })}

        <View
          accessible
          accessibilityLabel={`Cor escolhida ${selectedColor}`}
          style={[
            styles.mixerPreview,
            {
              backgroundColor: selectedColor,
              borderColor: tokens.borderStrong,
              borderRadius: tokens.radius.pill,
            },
          ]}
        >
          <SelectionBadge />
        </View>
      </View>
      <Text tone="muted" variant="caption" style={styles.selectedHueLabel}>
        Tom selecionado: {selectedHueLabel}
      </Text>

      <MixerControl
        colorForValue={(saturation) => hslToHex(color.hue, saturation, color.lightness)}
        label="Vivacidade"
        onSelect={(saturation) => onChange(hslToHex(color.hue, saturation, color.lightness))}
        options={SATURATION_OPTIONS}
        selectedValue={selectedSaturation}
      />
      <MixerControl
        colorForValue={(lightness) => hslToHex(color.hue, color.saturation, lightness)}
        label="Luminosidade"
        onSelect={(lightness) => onChange(hslToHex(color.hue, color.saturation, lightness))}
        options={LIGHTNESS_OPTIONS}
        selectedValue={selectedLightness}
      />
    </View>
  );
}

function MixerControl({
  colorForValue,
  label,
  onSelect,
  options,
  selectedValue,
}: {
  colorForValue: (value: number) => string;
  label: string;
  onSelect: (value: number) => void;
  options: readonly { label: string; value: number }[];
  selectedValue: number;
}) {
  const { tokens } = useTheme();

  return (
    <View style={styles.control}>
      <Text variant="caption" style={{ color: tokens.textMuted }}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.controlOptions}>
        {options.map((option) => {
          const selected = option.value === selectedValue;

          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.controlOption,
                {
                  backgroundColor: selected ? tokens.primaryContainer : tokens.surface,
                  borderColor: selected ? tokens.focusRing : tokens.border,
                  borderRadius: tokens.radius.md,
                  opacity: pressed ? 0.76 : 1,
                },
              ]}
            >
              <View style={[styles.controlSwatch, { backgroundColor: colorForValue(option.value) }]} />
              <Text
                variant="caption"
                style={{ color: selected ? tokens.onPrimaryContainer : tokens.text }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SelectionBadge() {
  const { tokens } = useTheme();

  return (
    <View style={[styles.badge, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Text style={[styles.check, { color: tokens.primary }]}>✓</Text>
    </View>
  );
}

function findClosestHue(hue: number): number {
  return HUE_OPTIONS.reduce((closest, option) => {
    const closestDistance = Math.min(Math.abs(closest - hue), 360 - Math.abs(closest - hue));
    const optionDistance = Math.min(Math.abs(option.value - hue), 360 - Math.abs(option.value - hue));
    return optionDistance < closestDistance ? option.value : closest;
  }, HUE_OPTIONS[0].value as number);
}

function findClosestValue(options: readonly { value: number }[], value: number): number {
  return options.reduce(
    (closest, option) => Math.abs(option.value - value) < Math.abs(closest - value) ? option.value : closest,
    options[0].value,
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -6,
    width: 20,
  },
  check: { fontSize: 12, fontWeight: '800', lineHeight: 16 },
  container: { gap: 12 },
  control: { gap: 8 },
  controlOption: { alignItems: 'center', borderWidth: 1, flex: 1, gap: 5, minHeight: 58, padding: 7 },
  controlOptions: { flexDirection: 'row', gap: 8 },
  controlSwatch: { borderRadius: 9, height: 18, width: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hueButton: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    width: 44,
  },
  hueSwatch: { borderRadius: 16, height: 32, width: 32 },
  mixer: { borderWidth: 1, gap: 16, padding: 14 },
  mixerPreview: {
    borderWidth: 3,
    height: 72,
    left: 74,
    position: 'absolute',
    top: 74,
    width: 72,
  },
  option: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  selectedHueLabel: { textAlign: 'center' },
  wheel: { alignSelf: 'center', borderWidth: 1, height: 220, position: 'relative', width: 220 },
});
