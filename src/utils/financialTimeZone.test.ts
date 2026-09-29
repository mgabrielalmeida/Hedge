import { getCivilDateInTimeZone, isValidTimeZone } from './financialTimeZone';

describe('financial timezone', () => {
  it('derives the ledger civil date from the persisted timezone', () => {
    const instant = new Date('2026-01-01T01:30:00.000Z');
    expect(getCivilDateInTimeZone(instant, 'America/Fortaleza')).toBe('2025-12-31');
    expect(getCivilDateInTimeZone(instant, 'UTC')).toBe('2026-01-01');
  });

  it('rejects invalid timezones and instants', () => {
    expect(isValidTimeZone('Invalid/Zone')).toBe(false);
    expect(() => getCivilDateInTimeZone(new Date('invalid'), 'UTC')).toThrow('Invalid financial date or timezone');
  });
});
