import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColorIndex } from '@/domain';

import { Text } from './Text';
import { EntityVisual } from './EntityVisual';
import { IconGlyph } from './IconGlyph';
import { SegmentedControl } from './SegmentedControl';
import { useReducedMotion } from './useReducedMotion';
import {
  hexToHsl,
  hslToHex,
  getThemeColorOptions,
  normalizeHexColor,
  resolveThemeColorValue,
  type IconOption,
} from './visualOptions';

type VisualPickerProps = {
  backgroundColorValue: string;
  backgroundThemeColorIndex: number | null;
  colorValue: string;
  iconOptions: readonly IconOption[];
  iconValue: string;
  label?: string;
  onCustomColorChange: (value: string) => void;
  onCustomBackgroundColorChange: (value: string) => void;
  onIconChange: (value: string) => void;
  onThemeColorChange: (index: ThemeColorIndex, value: string) => void;
  onBackgroundThemeColorChange: (index: ThemeColorIndex, value: string) => void;
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

const NEUTRAL_COLOR_OPTIONS = [
  { label: 'Preto', value: '#1C1B1F' },
  { label: 'Cinza', value: '#757575' },
  { label: 'Branco', value: '#FFFFFF' },
] as const;

const MINIMALIST_ICON_PAGE_SIZE = 24;
const SELECTION_ANIMATION_DURATION = 130;

export function VisualPicker({
  backgroundColorValue,
  backgroundThemeColorIndex,
  colorValue,
  iconOptions,
  iconValue,
  onCustomColorChange,
  onCustomBackgroundColorChange,
  onIconChange,
  onThemeColorChange,
  onBackgroundThemeColorChange,
  themeColorIndex,
}: VisualPickerProps) {
  const { tokens } = useTheme();
  const selectedIconKind = iconOptions.find((option) => option.value === iconValue)?.kind;
  const [activeIconKind, setActiveIconKind] = useState<'emoji' | 'minimalist'>(
    selectedIconKind ?? 'minimalist',
  );
  const [minimalistPage, setMinimalistPage] = useState(() => getMinimalistPage(iconOptions, iconValue));
  const [activeMixer, setActiveMixer] = useState<'background' | 'icon' | null>(null);
  const themeColorOptions = getThemeColorOptions(tokens.primary);
  const resolvedColorValue = resolveThemeColorValue(colorValue, themeColorIndex, tokens.primary);
  const backgroundThemeColorOptions = getThemeColorOptions(tokens.primaryContainer);
  const resolvedBackgroundColorValue = resolveThemeColorValue(backgroundColorValue, backgroundThemeColorIndex, tokens.primaryContainer);

  const minimalistIconOptions = iconOptions.filter((option) => option.kind === 'minimalist');
  const emojiIconOptions = iconOptions.filter((option) => option.kind === 'emoji');
  const minimalistPageCount = Math.ceil(minimalistIconOptions.length / MINIMALIST_ICON_PAGE_SIZE);
  const visibleIconOptions = activeIconKind === 'minimalist'
    ? minimalistIconOptions.slice(
      minimalistPage * MINIMALIST_ICON_PAGE_SIZE,
      (minimalistPage + 1) * MINIMALIST_ICON_PAGE_SIZE,
    )
    : emojiIconOptions;

  return (
    <View style={styles.container}>
      <Text variant="caption" style={{ color: tokens.textMuted }}>Ícone</Text>
      <SegmentedControl
        accessibilityLabel="Tipo de ícone"
        onChange={(kind) => {
          setActiveIconKind(kind);
          if (kind === 'minimalist') setMinimalistPage(getMinimalistPage(iconOptions, iconValue));
        }}
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
            <SelectionMotion key={option.value} selected={selected}>
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onIconChange(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: resolvedBackgroundColorValue,
                    borderColor: selected ? tokens.focusRing : tokens.border,
                    borderRadius: tokens.radius.md,
                    borderWidth: selected ? 3 : 1,
                    opacity: pressed ? 0.74 : 1,
                  },
                ]}
              >
                <IconGlyph color={resolvedColorValue} size={22} value={option.value} />
                {selected ? <SelectionBadge /> : null}
              </Pressable>
            </SelectionMotion>
          );
        })}
      </View>

      {activeIconKind === 'minimalist' ? (
        <IconPageNavigation
          onNext={() => setMinimalistPage((page) => Math.min(page + 1, minimalistPageCount - 1))}
          onPrevious={() => setMinimalistPage((page) => Math.max(page - 1, 0))}
          page={minimalistPage}
          pageCount={minimalistPageCount}
        />
      ) : null}

      {activeIconKind === 'minimalist' ? (
        <ColorSelection
          colorOptions={themeColorOptions}
          customSelected={themeColorIndex === null}
          label="Cor do ícone"
          onCustomColorChange={onCustomColorChange}
          onCustomPress={() => setActiveMixer('icon')}
          onThemeColorChange={onThemeColorChange}
          selectedIndex={themeColorIndex}
          selectedCustomColor={resolvedColorValue}
        />
      ) : null}
      <ColorSelection
        colorOptions={backgroundThemeColorOptions}
        customSelected={backgroundThemeColorIndex === null}
        label="Cor de fundo"
        onCustomColorChange={onCustomBackgroundColorChange}
        onCustomPress={() => setActiveMixer('background')}
        onThemeColorChange={onBackgroundThemeColorChange}
        selectedIndex={backgroundThemeColorIndex}
        selectedCustomColor={resolvedBackgroundColorValue}
      />
      <ColorMixerMenu
        activeMixer={activeMixer}
        backgroundColor={resolvedBackgroundColorValue}
        iconColor={resolvedColorValue}
        iconValue={iconValue}
        onChange={activeMixer === 'background' ? onCustomBackgroundColorChange : onCustomColorChange}
        onClose={() => setActiveMixer(null)}
        value={activeMixer === 'background' ? resolvedBackgroundColorValue : resolvedColorValue}
      />
    </View>
  );
}

function ColorMixerMenu({
  activeMixer,
  backgroundColor,
  iconColor,
  iconValue,
  onChange,
  onClose,
  value,
}: {
  activeMixer: 'background' | 'icon' | null;
  backgroundColor: string;
  iconColor: string;
  iconValue: string;
  onChange: (value: string) => void;
  onClose: () => void;
  value: string;
}) {
  const { tokens } = useTheme();
  const title = activeMixer === 'background' ? 'Cor de fundo personalizada' : 'Cor do ícone personalizada';

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={activeMixer !== null}
    >
      <View style={[styles.modalOverlay, { backgroundColor: tokens.overlay }]}>
        <Pressable
          accessibilityLabel="Fechar seleção de cor"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.modalPanel,
            {
              backgroundColor: tokens.surface,
              borderColor: tokens.border,
              borderRadius: tokens.radius.xl,
              shadowColor: tokens.text,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeading}>
              <Text variant="title">{title}</Text>
              <Text tone="muted" variant="caption">Ajuste a cor e confira a combinação antes de concluir.</Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar seleção de cor"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: tokens.surfaceSubtle,
                  borderColor: tokens.border,
                  borderRadius: tokens.radius.pill,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Text style={[styles.closeButtonLabel, { color: tokens.text }]}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.modalScroll}
          >
            <View
              accessible
              accessibilityLabel="Prévia da combinação atual"
              style={[
                styles.entityPreview,
                {
                  backgroundColor: tokens.surfaceSubtle,
                  borderColor: tokens.border,
                  borderRadius: tokens.radius.lg,
                },
              ]}
            >
              <EntityVisual
                backgroundColor={backgroundColor}
                iconColor={iconColor}
                iconValue={iconValue}
                size="large"
              />
              <View style={styles.entityPreviewText}>
                <Text variant="caption">Prévia da combinação</Text>
                <Text tone="muted" variant="caption">
                  Ícone e fundo são atualizados enquanto você escolhe.
                </Text>
              </View>
            </View>

            <ColorMixer onChange={onChange} value={value} />

            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.doneButton,
                {
                  backgroundColor: tokens.primary,
                  borderRadius: tokens.radius.md,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <Text style={{ color: tokens.onPrimary }}>Concluído</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function IconPageNavigation({
  onNext,
  onPrevious,
  page,
  pageCount,
}: {
  onNext: () => void;
  onPrevious: () => void;
  page: number;
  pageCount: number;
}) {
  const { tokens } = useTheme();
  const previousDisabled = page === 0;
  const nextDisabled = page >= pageCount - 1;

  return (
    <View accessibilityLabel="Navegação de páginas dos ícones minimalistas" style={styles.pageNavigation}>
      <Pressable
        accessibilityLabel="Página anterior de ícones minimalistas"
        accessibilityRole="button"
        disabled={previousDisabled}
        onPress={onPrevious}
        style={({ pressed }) => [
          styles.pageButton,
          {
            backgroundColor: tokens.surfaceSubtle,
            borderColor: tokens.border,
            borderRadius: tokens.radius.md,
            opacity: previousDisabled ? 0.48 : pressed ? 0.76 : 1,
          },
        ]}
      >
        <Text style={{ color: tokens.text }}>Anterior</Text>
      </Pressable>
      <Text tone="muted" variant="caption">Página {page + 1} de {pageCount}</Text>
      <Pressable
        accessibilityLabel="Próxima página de ícones minimalistas"
        accessibilityRole="button"
        disabled={nextDisabled}
        onPress={onNext}
        style={({ pressed }) => [
          styles.pageButton,
          {
            backgroundColor: tokens.surfaceSubtle,
            borderColor: tokens.border,
            borderRadius: tokens.radius.md,
            opacity: nextDisabled ? 0.48 : pressed ? 0.76 : 1,
          },
        ]}
      >
        <Text style={{ color: tokens.text }}>Próxima</Text>
      </Pressable>
    </View>
  );
}

function ColorSelection({
  colorOptions,
  customSelected,
  label,
  onCustomColorChange,
  onCustomPress,
  onThemeColorChange,
  selectedIndex,
  selectedCustomColor,
}: {
  colorOptions: readonly { label: string; value: string }[];
  customSelected: boolean;
  label: string;
  onCustomColorChange: (value: string) => void;
  onCustomPress: () => void;
  onThemeColorChange: (index: ThemeColorIndex, value: string) => void;
  selectedIndex: number | null;
  selectedCustomColor: string;
}) {
  const { tokens } = useTheme();
  const hasNeutralSelected = customSelected && NEUTRAL_COLOR_OPTIONS.some((option) => option.value === selectedCustomColor);
  return (
    <View style={styles.colorSelection}>
      <Text variant="caption" style={{ color: tokens.textMuted }}>{label}</Text>
      <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.grid}>
        {colorOptions.map((option, index) => <ColorOption key={`theme-${option.value}`} color={option.value} label={option.label} onPress={() => onThemeColorChange(index as ThemeColorIndex, option.value)} selected={selectedIndex === index} />)}
        {NEUTRAL_COLOR_OPTIONS.map((option) => <ColorOption key={`neutral-${option.value}`} color={option.value} label={option.label} onPress={() => onCustomColorChange(option.value)} selected={customSelected && selectedCustomColor === option.value} />)}
        <SelectionMotion selected={customSelected && !hasNeutralSelected}>
          <Pressable accessibilityLabel="Misture sua cor" accessibilityRole="radio" accessibilityState={{ selected: customSelected && !hasNeutralSelected }} onPress={onCustomPress} style={({ pressed }) => [styles.option, { backgroundColor: tokens.surface, borderColor: customSelected && !hasNeutralSelected ? tokens.focusRing : tokens.border, borderRadius: tokens.radius.md, borderWidth: customSelected && !hasNeutralSelected ? 3 : 1, opacity: pressed ? 0.74 : 1 }]}>
            <IconGlyph color={tokens.primary} size={22} value="lucide:sliders-horizontal" />
            {customSelected && !hasNeutralSelected ? <SelectionBadge /> : null}
          </Pressable>
        </SelectionMotion>
      </View>
    </View>
  );
}

function ColorOption({ color, label, onPress, selected }: { color: string; label: string; onPress: () => void; selected: boolean }) {
  const { tokens } = useTheme();
  return <SelectionMotion selected={selected}><Pressable accessibilityLabel={label} accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.option, { backgroundColor: color, borderColor: selected ? tokens.focusRing : tokens.border, borderRadius: tokens.radius.md, borderWidth: selected ? 3 : 1, opacity: pressed ? 0.74 : 1 }]}>{selected ? <SelectionBadge /> : null}</Pressable></SelectionMotion>;
}

function SelectionMotion({ children, selected, style }: { children: ReactNode; selected: boolean; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const previousSelected = useRef(selected);

  useLayoutEffect(() => {
    if (previousSelected.current === selected) return;
    previousSelected.current = selected;

    if (reduceMotion !== false) {
      scale.setValue(1);
      return;
    }

    scale.stopAnimation();
    scale.setValue(0.94);
    const animation = Animated.timing(scale, {
      duration: SELECTION_ANIMATION_DURATION,
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, scale, selected]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
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
      <Text tone="muted" variant="caption">Escolha um tom na roda e ajuste sua aparência.</Text>

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
            <SelectionMotion
              key={option.value}
              selected={selected}
              style={[
                styles.hueButton,
                {
                  left: 88 + Math.cos(angle) * 78,
                  top: 88 + Math.sin(angle) * 78,
                },
              ]}
            >
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => onChange(hslToHex(
                  option.value,
                  color.saturation < 20 ? 65 : color.saturation,
                  color.lightness,
                ))}
                style={({ pressed }) => [
                  styles.hueButtonContent,
                  {
                    backgroundColor: selected ? tokens.primaryContainer : tokens.surfaceSubtle,
                    borderColor: selected ? tokens.focusRing : 'transparent',
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <View style={[styles.hueSwatch, { backgroundColor: swatchColor }]} />
              </Pressable>
            </SelectionMotion>
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
            <SelectionMotion key={option.value} selected={selected}>
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
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
            </SelectionMotion>
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

function getMinimalistPage(iconOptions: readonly IconOption[], iconValue: string): number {
  const minimalistIndex = iconOptions
    .filter((option) => option.kind === 'minimalist')
    .findIndex((option) => option.value === iconValue);
  return minimalistIndex < 0 ? 0 : Math.floor(minimalistIndex / MINIMALIST_ICON_PAGE_SIZE);
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
  colorSelection: { gap: 8 },
  container: { gap: 12 },
  control: { gap: 8 },
  controlOption: { alignItems: 'center', borderWidth: 1, flex: 1, gap: 5, minHeight: 58, padding: 7 },
  controlOptions: { flexDirection: 'row', gap: 8 },
  controlSwatch: { borderRadius: 9, height: 18, width: 18 },
  closeButton: { alignItems: 'center', borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  closeButtonLabel: { fontSize: 28, lineHeight: 30 },
  doneButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 18 },
  entityPreview: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 12, padding: 12 },
  entityPreviewText: { flex: 1, gap: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hueButton: {
    height: 44,
    position: 'absolute',
    width: 44,
  },
  hueButtonContent: { alignItems: 'center', borderRadius: 22, borderWidth: 2, flex: 1, justifyContent: 'center' },
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
  modalContent: { gap: 16, padding: 18 },
  modalHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingBottom: 0, paddingHorizontal: 18, paddingTop: 18 },
  modalHeading: { flex: 1, gap: 4 },
  modalOverlay: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 16 },
  modalPanel: {
    borderWidth: 1,
    elevation: 12,
    maxHeight: '90%',
    maxWidth: 440,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    width: '100%',
  },
  modalScroll: { flexShrink: 1 },
  option: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48 },
  pageButton: { alignItems: 'center', borderWidth: 1, justifyContent: 'center', minHeight: 40, paddingHorizontal: 12 },
  pageNavigation: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  selectedHueLabel: { textAlign: 'center' },
  wheel: { alignSelf: 'center', borderWidth: 1, height: 220, position: 'relative', width: 220 },
});
