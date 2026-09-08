import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { IconGlyph } from './IconGlyph';
import { Text } from './Text';

type ScreenHeaderProps = {
  description?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  title: string;
};

export function ScreenHeader({ description, onBack, title, trailing }: ScreenHeaderProps) {
  const { tokens } = useTheme();

  return (
    <View style={styles.header}>
      <View style={styles.heading}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.72 : 1 }]}
          >
            <IconGlyph color={tokens.primary} size={20} value="lucide:move-left" />
            <Text style={{ color: tokens.primary, fontWeight: '600' }}>Voltar</Text>
          </Pressable>
        ) : null}
        <Text variant="heading">{title}</Text>
        {description ? <Text tone="muted" style={{ marginTop: tokens.spacing.sm }}>{description}</Text> : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 6, minHeight: 44 },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  heading: { flex: 1 },
});
