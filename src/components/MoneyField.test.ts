import { formatMoneyFieldInput } from './MoneyField';

describe('formatMoneyFieldInput', () => {
  it('formats typed digits as Brazilian cents', () => {
    expect(formatMoneyFieldInput('1')).toBe('0,01');
    expect(formatMoneyFieldInput('200000')).toBe('2.000,00');
    expect(formatMoneyFieldInput('2.000,00')).toBe('2.000,00');
  });

  it('keeps a negative sign only when the field allows it', () => {
    expect(formatMoneyFieldInput('-1250', true)).toBe('-12,50');
    expect(formatMoneyFieldInput('-1250')).toBe('12,50');
  });
});
