import {
  addCents,
  formatBrazilianCurrency,
  parseMoneyInput,
} from './money';

describe('money conversion', () => {
  it.each([
    ['0', 0],
    ['12,5', 1250],
    ['12.50', 1250],
    [' 001.02 ', 102],
    ['-10,25', -1025],
  ])('parses %s without floating point rounding', (input, expected) => {
    expect(parseMoneyInput(input, { allowNegative: true })).toEqual({ ok: true, value: expected });
  });

  it('rejects formats outside the agreed input grammar', () => {
    expect(parseMoneyInput('')).toEqual({ ok: false, error: 'empty_money_input' });
    expect(parseMoneyInput('R$ 10,00')).toEqual({ ok: false, error: 'invalid_money_format' });
    expect(parseMoneyInput('1.234,56')).toEqual({ ok: false, error: 'invalid_money_format' });
    expect(parseMoneyInput('1.234')).toEqual({ ok: false, error: 'invalid_money_format' });
    expect(parseMoneyInput('.50')).toEqual({ ok: false, error: 'invalid_money_format' });
    expect(parseMoneyInput('10,999')).toEqual({ ok: false, error: 'invalid_money_format' });
    expect(parseMoneyInput('-1,00')).toEqual({ ok: false, error: 'negative_amount_not_allowed' });
  });

  it('rejects amounts outside the safe integer interval', () => {
    expect(parseMoneyInput('90071992547410,00')).toEqual({ ok: false, error: 'money_out_of_range' });
  });

  it('formats cents in the Brazilian presentation format', () => {
    expect(formatBrazilianCurrency(0)).toBe('R$ 0,00');
    expect(formatBrazilianCurrency(123456)).toBe('R$ 1.234,56');
    expect(formatBrazilianCurrency(-1000)).toBe('-R$ 10,00');
  });

  it('fails explicitly on arithmetic overflow', () => {
    expect(() => addCents(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
  });
});
