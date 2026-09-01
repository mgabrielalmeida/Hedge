import { invalid, valid, type ValidationResult } from './money';
import type { CivilDate, YearMonth } from './financial';

export type CivilDateError = 'invalid_civil_date' | 'future_civil_date' | 'invalid_date_range';
export type YearMonthError = 'invalid_year_month';

interface CivilDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function parseCivilDate(value: string): ValidationResult<CivilDate, CivilDateError> {
  if (!isCivilDate(value)) {
    return invalid('invalid_civil_date');
  }

  return valid(value);
}

export function isCivilDate(value: string): value is CivilDate {
  const parts = parseCivilDateParts(value);
  return parts !== null && parts.year >= 1 && parts.year <= 9999;
}

export function parseYearMonth(value: string): ValidationResult<YearMonth, YearMonthError> {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value) || value.slice(0, 4) === '0000') {
    return invalid('invalid_year_month');
  }

  return valid(value);
}

export function compareCivilDates(left: CivilDate, right: CivilDate): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function validateDateRange(
  startDate: CivilDate,
  endDate: CivilDate | null,
): ValidationResult<void, CivilDateError> {
  if (endDate !== null && compareCivilDates(endDate, startDate) < 0) {
    return invalid('invalid_date_range');
  }

  return valid(undefined);
}

export function validateNotFuture(
  date: CivilDate,
  referenceDate: CivilDate,
): ValidationResult<void, CivilDateError> {
  if (compareCivilDates(date, referenceDate) > 0) {
    return invalid('future_civil_date');
  }

  return valid(undefined);
}

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('Year and month must identify a calendar month.');
  }

  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function getCivilDateParts(date: CivilDate): CivilDateParts {
  const parts = parseCivilDateParts(date);
  if (!parts || !isCivilDate(date)) {
    throw new RangeError('Expected a valid civil date.');
  }

  return parts;
}

export function getMondayBasedWeekday(date: CivilDate): number {
  const { year, month, day } = getCivilDateParts(date);
  const monthOffsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;
  const sundayBasedWeekday =
    (adjustedYear + Math.floor(adjustedYear / 4) - Math.floor(adjustedYear / 100) +
      Math.floor(adjustedYear / 400) +
      monthOffsets[month - 1] +
      day) %
    7;

  return sundayBasedWeekday === 0 ? 7 : sundayBasedWeekday;
}

function parseCivilDateParts(value: string): CivilDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }

  return { year, month, day };
}
