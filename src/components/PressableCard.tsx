import type { ComponentProps, PropsWithChildren } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from './Card';

type PressableCardProps = PropsWithChildren<Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> & {
  cardStyle?: StyleProp<ViewStyle>;
  elevated?: boolean;
}>;

export function PressableCard({ cardStyle, children, elevated = false, ...props }: PressableCardProps) {
  return (
    <Pressable {...props} accessibilityRole={props.accessibilityRole ?? 'button'}>
      {({ pressed }) => <Card elevated={elevated} style={[cardStyle, { opacity: pressed ? 0.78 : 1 }]}>{children}</Card>}
    </Pressable>
  );
}
