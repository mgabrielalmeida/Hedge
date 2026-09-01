import type { Cents } from './financial';

export const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER;
export const MIN_SAFE_CENTS = Number.MIN_SAFE_INTEGER;

export type MoneyInputError =
  | 'empty_money_input'
  | 'invalid_money_format'
  | 'negative_amount_not_allowed'
  | 'money_out_of_range';

export type ValidationResult<T, E extends string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function valid<T>(value: T): ValidationResult<T, never> {
  return { ok: true, value };
}

export function invalid<E extends string>(error: E): ValidationResult<never, E> {
  return { ok: false, error };
}

export function isSafeCents(value: number): value is Cents {
  return Number.isSafeInteger(value);
}

export function parseMoneyInput(
  input: string,
  options: { readonly allowNegative?: boolean } = {},
): ValidationResult<Cents, MoneyInputError> {
  const normalized = input.trim();

  if (normalized.length === 0) {
    return invalid('empty_money_input');
  }

  const match = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(normalized);
  if (!match) {
    return invalid('invalid_money_format');
  }

  const [, sign, integerPart, decimalPart = ''] = match;
  if (sign === '-' && !options.allowNegative) {
    return invalid('negative_amount_not_allowed');
  }

  const wholeReais = Number(integerPart);
  const fractionalCents = decimalPart.length === 0 ? 0 : Number(decimalPart.padEnd(2, '0'));
  const absoluteCents = wholeReais * 100 + fractionalCents;

  if (!Number.isSafeInteger(wholeReais) || !Number.isSafeInteger(absoluteCents)) {
    return invalid('money_out_of_range');
  }

  return valid(sign === '-' ? -absoluteCents : absoluteCents);
}

export function formatBrazilianCurrency(cents: Cents): string {
  assertSafeCents(cents);

  const isNegative = cents < 0;
  const absoluteCents = Math.abs(cents);
  const decimalPart = absoluteCents % 100;
  const integerPart = (absoluteCents - decimalPart) / 100;
  const groupedInteger = String(integerPart).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formattedDecimal = String(decimalPart).padStart(2, '0');

  return `${isNegative ? '-' : ''}R$ ${groupedInteger},${formattedDecimal}`;
}

export function assertSafeCents(value: number): asserts value is Cents {
  if (!isSafeCents(value)) {
    throw new RangeError('Money value must be a safe integer number of cents.');
  }
}

export function addCents(left: Cents, right: Cents): Cents {
  assertSafeCents(left);
  assertSafeCents(right);

  const sum = left + right;
  assertSafeCents(sum);
  return sum;
}
