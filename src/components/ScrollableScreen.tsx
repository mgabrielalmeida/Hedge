import type { ComponentProps, PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Screen } from './Screen';

type ScrollableScreenProps = PropsWithChildren<Omit<ComponentProps<typeof ScrollView>, 'children' | 'contentContainerStyle' | 'style'> & {
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}>;

export function ScrollableScreen({ children, contentContainerStyle, style, ...props }: ScrollableScreenProps) {
  const { tokens } = useTheme();

  return (
    <Screen style={style}>
      <ScrollView
        {...props}
        contentContainerStyle={[
          styles.content,
          { gap: tokens.spacing.xl, paddingVertical: tokens.spacing.xl },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { flexGrow: 1 } });
