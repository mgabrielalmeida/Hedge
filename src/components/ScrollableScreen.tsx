import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Screen } from './Screen';

type ScrollableScreenProps = PropsWithChildren<Omit<ComponentProps<typeof ScrollView>, 'children' | 'contentContainerStyle' | 'style'> & {
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export function ScrollableScreen({ children, contentContainerStyle, footer, style, ...props }: ScrollableScreenProps) {
  const { tokens } = useTheme();

  return (
    <Screen style={style}>
      <ScrollView
        {...props}
        contentContainerStyle={[
          styles.content,
          { gap: tokens.spacing.xl, paddingBottom: tokens.spacing.xl, paddingTop: tokens.spacing.xl },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingBottom: tokens.spacing.lg, paddingTop: tokens.spacing.sm }}>{footer}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { flexGrow: 1 } });
