import { StyleSheet, View } from 'react-native';

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
  const dimensions = sizes[size];
  return (
    <View style={[styles.visual, { backgroundColor: color, borderRadius: dimensions.tile / 4, height: dimensions.tile, width: dimensions.tile }]}>
      <IconGlyph color={getReadableIconColor(color)} size={dimensions.icon} value={iconValue} />
    </View>
  );
}

function getReadableIconColor(color: string): string {
  const value = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return '#1F2937';
  const [red, green, blue] = value.match(/../g)!.map((part) => Number.parseInt(part, 16));
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance < 150 ? '#FFFFFF' : '#1F2937';
}

const styles = StyleSheet.create({ visual: { alignItems: 'center', justifyContent: 'center' } });
