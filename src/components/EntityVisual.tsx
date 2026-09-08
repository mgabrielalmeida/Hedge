import { StyleSheet, View } from 'react-native';

import { getHighestContrastColor } from '@/theme/colorContrast';
import { useTheme } from '@/theme/ThemeProvider';

import { IconGlyph } from './IconGlyph';

type EntityVisualProps = {
  color: string;
  iconValue: string;
  size?: 'large' | 'medium' | 'small';
};

const sizes = {
  large: { icon: 22, tile: 48 },
  medium: { icon: 20, tile: 44 },
  small: { icon: 15, tile: 24 },
} as const;

export function EntityVisual({ color, iconValue, size = 'medium' }: EntityVisualProps) {
  const { tokens } = useTheme();
  const dimensions = sizes[size];
  const backgroundColor = isHexColor(color) ? color : tokens.primary;
  const iconColor = getHighestContrastColor(
    backgroundColor,
    [tokens.onPrimary, tokens.text, tokens.onPrimaryContainer],
    tokens.text,
  );

  return (
    <View style={[styles.visual, { backgroundColor, borderRadius: dimensions.tile / 4, height: dimensions.tile, width: dimensions.tile }]}>
      <IconGlyph color={iconColor} size={dimensions.icon} value={iconValue} />
    </View>
  );
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

const styles = StyleSheet.create({ visual: { alignItems: 'center', justifyContent: 'center' } });
