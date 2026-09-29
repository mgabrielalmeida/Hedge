import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { IconGlyph } from './IconGlyph';

type EntityVisualProps = {
  backgroundColor: string;
  iconValue: string;
  iconColor: string;
  size?: 'large' | 'medium' | 'small';
};

const sizes = {
  large: { icon: 22, tile: 48 },
  medium: { icon: 20, tile: 44 },
  small: { icon: 15, tile: 24 },
} as const;

export function EntityVisual({ backgroundColor, iconColor, iconValue, size = 'medium' }: EntityVisualProps) {
  const { tokens } = useTheme();
  const dimensions = sizes[size];
  const resolvedIconColor = isHexColor(iconColor) ? iconColor : tokens.primary;
  const resolvedBackgroundColor = isHexColor(backgroundColor) ? backgroundColor : tokens.primaryContainer;

  return (
    <View
      style={[
        styles.visual,
        {
          backgroundColor: resolvedBackgroundColor,
          borderColor: tokens.border,
          borderRadius: dimensions.tile / 4,
          height: dimensions.tile,
          width: dimensions.tile,
        },
      ]}
    >
      <IconGlyph color={resolvedIconColor} size={dimensions.icon} value={iconValue} />
    </View>
  );
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

const styles = StyleSheet.create({ visual: { alignItems: 'center', borderWidth: 1, justifyContent: 'center' } });
