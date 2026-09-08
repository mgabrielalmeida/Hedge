import type { ComponentProps } from 'react';

import { formatBrazilianCurrency } from '@/domain';

import { Text } from './Text';

type MoneyTextProps = Omit<ComponentProps<typeof Text>, 'children' | 'tone'> & {
  cents: number;
  hidden?: boolean;
  tone?: ComponentProps<typeof Text>['tone'];
};

export function MoneyText({ cents, hidden = false, tone, ...props }: MoneyTextProps) {
  return (
    <Text
      {...props}
      accessibilityLabel={hidden ? 'Saldo oculto' : props.accessibilityLabel}
      tone={tone}
    >
      {hidden ? '••••••' : formatBrazilianCurrency(cents)}
    </Text>
  );
}
