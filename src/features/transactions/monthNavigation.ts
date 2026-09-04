import type { YearMonth } from '@/domain';

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

export function formatYearMonth(yearMonth: YearMonth): string {
  const { month, year } = getYearMonthParts(yearMonth);
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

export function shiftYearMonth(
  yearMonth: YearMonth,
  direction: -1 | 1,
): YearMonth | null {
  const { month, year } = getYearMonthParts(yearMonth);
  const totalMonths = year * 12 + month - 1 + direction;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;

  if (nextYear < 1 || nextYear > 9999) {
    return null;
  }

  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`;
}

function getYearMonthParts(yearMonth: YearMonth): { month: number; year: number } {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);

  if (!match || match[1] === '0000') {
    throw new RangeError('Expected a valid year-month value.');
  }

  return { month: Number(match[2]), year: Number(match[1]) };
}
