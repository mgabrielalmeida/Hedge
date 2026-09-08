import type { ComponentProps } from 'react';

import { formatBrazilianCurrency } from '@/domain';

import { Text } from './Text';

type MoneyTextProps = Omit<ComponentProps<typeof Text>, 'children' | 'tone'> & {
  cents: number;
  tone?: ComponentProps<typeof Text>['tone'];
};

export function MoneyText({ cents, tone, ...props }: MoneyTextProps) {
  return <Text {...props} tone={tone}>{formatBrazilianCurrency(cents)}</Text>;
}
