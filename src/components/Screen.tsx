import type { PropsWithChildren } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';

type ScreenProps = PropsWithChildren<{ padded?: boolean; style?: StyleProp<ViewStyle> }>;

export function Screen({ children, padded = true, style }: ScreenProps) {
  const { tokens } = useTheme();

  return (
    <SafeAreaView
      style={[
        styles.screen,
        { backgroundColor: tokens.background, paddingHorizontal: padded ? tokens.spacing.lg : 0 },
        style,
      ]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
