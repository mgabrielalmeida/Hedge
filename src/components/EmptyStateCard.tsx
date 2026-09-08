import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

type EmptyStateCardProps = {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title?: string;
};

export function EmptyStateCard({ actionLabel, message, onAction, title }: EmptyStateCardProps) {
  const { tokens } = useTheme();
  return (
    <Card>
      <View style={{ gap: tokens.spacing.sm }}>
        {title ? <Text variant="title">{title}</Text> : null}
        <Text tone="muted">{message}</Text>
        {onAction && actionLabel ? <Button label={actionLabel} onPress={onAction} variant="secondary" /> : null}
      </View>
    </Card>
  );
}
