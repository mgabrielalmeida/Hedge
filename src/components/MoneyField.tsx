import type { ComponentProps } from 'react';

import { formatBrazilianMoneyInput } from '@/domain';

import { Field } from './Field';

type MoneyFieldProps = Omit<ComponentProps<typeof Field>, 'keyboardType' | 'onChangeText'> & {
  allowNegative?: boolean;
  onChangeText: (value: string) => void;
};

export function MoneyField({ allowNegative = false, onChangeText, ...props }: MoneyFieldProps) {
  return (
    <Field
      {...props}
      keyboardType={allowNegative ? 'numbers-and-punctuation' : 'decimal-pad'}
      onChangeText={(value) => onChangeText(formatMoneyFieldInput(value, allowNegative))}
    />
  );
}

export function formatMoneyFieldInput(value: string, allowNegative = false): string {
  const isNegative = allowNegative && value.trimStart().startsWith('-');
  const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

  if (digits.length === 0) {
    return isNegative ? '-' : '';
  }

  const cents = Number(digits);
  if (!Number.isSafeInteger(cents)) {
    return `${isNegative ? '-' : ''}${digits}`;
  }

  return formatBrazilianMoneyInput(isNegative ? -cents : cents);
}
