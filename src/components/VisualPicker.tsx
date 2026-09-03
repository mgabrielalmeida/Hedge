import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AccountVisualType, CategoryVisualType } from '@/domain';
import { useTheme } from '@/theme/ThemeProvider';

import { Text } from './Text';
import { Field } from './Field';
import {
  formatHexColorDraft,
  normalizeHexColor,
  VISUAL_COLOR_OPTIONS,
  type IconOption,
} from './visualOptions';

type VisualType = AccountVisualType | CategoryVisualType;

type VisualPickerProps = {
  iconOptions: readonly IconOption[];
  label?: string;
  onChange: (value: string) => void;
  onTypeChange: (visualType: VisualType) => void;
  value: string;
  visualType: VisualType;
};

export function VisualPicker({
  iconOptions,
  label = 'Indicador visual',
  onChange,
  onTypeChange,
  value,
  visualType,
}: VisualPickerProps) {
  const { tokens } = useTheme();
  const options = visualType === 'icon' ? iconOptions : VISUAL_COLOR_OPTIONS;

  function selectType(nextType: VisualType) {
    onTypeChange(nextType);

    const nextOptions = nextType === 'icon' ? iconOptions : VISUAL_COLOR_OPTIONS;
    if (!nextOptions.some((option) => option.value === value)) {
      onChange(nextOptions[0].value);
    }
  }

  return (
    <View style={styles.container}>
      <View>
        <Text variant="caption" style={{ color: tokens.textMuted }}>{label}</Text>
        <Text tone="muted" variant="caption" style={{ marginTop: tokens.spacing.xs }}>
          Escolha um ícone ou uma cor para encontrar este item rapidamente.
        </Text>
      </View>

      <View
        accessibilityLabel="Tipo do indicador visual"
        accessibilityRole="radiogroup"
        style={[styles.segmentedControl, { backgroundColor: tokens.surfaceSubtle, borderRadius: tokens.radius.md }]}
      >
        <TypeButton label="Ícone" onPress={() => selectType('icon')} selected={visualType === 'icon'} />
        <TypeButton label="Cor" onPress={() => selectType('color')} selected={visualType === 'color'} />
      </View>

      <View style={styles.grid}>
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: visualType === 'color' ? option.value : selected ? tokens.primaryContainer : tokens.surfaceSubtle,
                  borderColor: selected ? tokens.focusRing : tokens.border,
                  borderRadius: tokens.radius.md,
                  borderWidth: selected ? 3 : 1,
                  opacity: pressed ? 0.74 : 1,
                },
              ]}
            >
              {visualType === 'icon' && 'symbol' in option && typeof option.symbol === 'string' ? (
                <Text style={styles.icon}>{option.symbol}</Text>
              ) : null}
              {selected ? (
                <View style={[styles.badge, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                  <Text style={[styles.check, { color: tokens.primary }]}>✓</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {visualType === 'color' ? (
        <ExactColorPicker
          onChange={onChange}
          value={value}
        />
      ) : null}
    </View>
  );
}

function ExactColorPicker({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const { tokens } = useTheme();
  const [partialColor, setPartialColor] = useState<{ baseValue: string; draft: string } | null>(null);
  const customColor = partialColor?.baseValue === value
    ? partialColor.draft
    : normalizeHexColor(value) ?? VISUAL_COLOR_OPTIONS[0].value;
  const normalizedCustomColor = normalizeHexColor(customColor);
  const missingDigits = 6 - Math.max(customColor.length - 1, 0);

  function updateCustomColor(input: string) {
    const draft = formatHexColorDraft(input);
    const normalized = normalizeHexColor(draft);
    if (normalized) {
      setPartialColor(null);
      onChange(normalized);
    } else {
      setPartialColor({ baseValue: value, draft });
    }
  }

  return (
    <View
      style={[
        styles.exactPicker,
        {
          backgroundColor: tokens.surfaceSubtle,
          borderColor: tokens.border,
          borderRadius: tokens.radius.lg,
        },
      ]}
    >
      <View style={styles.exactPickerHeader}>
        <View>
          <Text variant="title">Cor exata</Text>
          <Text tone="muted" variant="caption">Informe um código hexadecimal.</Text>
        </View>
        <View
          accessible
          accessibilityLabel={normalizedCustomColor ? `Prévia da cor ${normalizedCustomColor}` : 'Cor incompleta'}
          style={[
            styles.exactPreview,
            {
              backgroundColor: normalizedCustomColor ?? tokens.surface,
              borderColor: normalizedCustomColor === value ? tokens.focusRing : tokens.borderStrong,
              borderRadius: tokens.radius.md,
            },
          ]}
        >
          {normalizedCustomColor === value ? (
            <View style={[styles.badge, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              <Text style={[styles.check, { color: tokens.primary }]}>✓</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Field
        autoCapitalize="characters"
        autoCorrect={false}
        helperText={
          normalizedCustomColor
            ? 'A cor é aplicada automaticamente ao completar os 6 dígitos.'
            : `Digite mais ${missingDigits} ${missingDigits === 1 ? 'dígito' : 'dígitos'}.`
        }
        label="Código HEX"
        maxLength={7}
        onChangeText={updateCustomColor}
        placeholder="#1F6B45"
        spellCheck={false}
        value={customColor}
      />
    </View>
  );
}

function TypeButton({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { tokens } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.typeButton,
        {
          backgroundColor: selected ? tokens.primary : 'transparent',
          borderRadius: tokens.radius.sm,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text variant="caption" style={{ color: selected ? tokens.onPrimary : tokens.text }}>
        {label}
      </Text>
    </Pressable>
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
  exactPicker: { borderWidth: 1, gap: 14, padding: 14 },
  exactPickerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  exactPreview: { borderWidth: 3, height: 48, width: 48 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  icon: { fontSize: 22, lineHeight: 28 },
  option: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  segmentedControl: { flexDirection: 'row', gap: 4, padding: 4 },
  typeButton: { alignItems: 'center', flex: 1, minHeight: 40, justifyContent: 'center' },
});
