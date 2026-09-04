import { formatYearMonth, shiftYearMonth } from './monthNavigation';

describe('month navigation', () => {
  it('formats a year-month in Portuguese', () => {
    expect(formatYearMonth('2026-09')).toBe('setembro de 2026');
  });

  it('moves across year boundaries', () => {
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
  });

  it('does not move before the first supported month', () => {
    expect(shiftYearMonth('0001-01', -1)).toBeNull();
  });
});
