import {
  getMondayBasedWeekday,
  parseCivilDate,
  parseYearMonth,
  validateDateRange,
  validateNotFuture,
} from './civilDate';

describe('civil dates', () => {
  it.each(['2025-02-29', '2026-04-31', '0000-01-01', '2026-2-01', '2026-01-00'])(
    'rejects the invalid civil date %s',
    (date) => {
      expect(parseCivilDate(date)).toEqual({ ok: false, error: 'invalid_civil_date' });
    },
  );

  it('accepts leap-day and validates date intervals', () => {
    const leapDay = parseCivilDate('2024-02-29');
    const endDate = parseCivilDate('2024-03-01');
    expect(leapDay).toEqual({ ok: true, value: '2024-02-29' });
    if (!leapDay.ok || !endDate.ok) {
      throw new Error('Expected valid dates.');
    }

    expect(validateDateRange(leapDay.value, endDate.value)).toEqual({ ok: true, value: undefined });
    expect(validateNotFuture(endDate.value, leapDay.value)).toEqual({
      ok: false,
      error: 'future_civil_date',
    });
  });

  it('uses Monday as weekday 1 and Sunday as weekday 7', () => {
    expect(getMondayBasedWeekday('2026-09-01')).toBe(2);
    expect(getMondayBasedWeekday('2026-09-06')).toBe(7);
  });

  it('validates a calendar month separately', () => {
    expect(parseYearMonth('2026-09')).toEqual({ ok: true, value: '2026-09' });
    expect(parseYearMonth('2026-13')).toEqual({ ok: false, error: 'invalid_year_month' });
  });
});
