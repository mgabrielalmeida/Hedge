import {
  compareCivilDates,
  getCivilDateParts,
  getMondayBasedWeekday,
  daysInMonth,
} from '../models/civilDate';
import type { CivilDate, RecurringRule } from '../models/financial';

export function isRecurringRuleDueOn(rule: RecurringRule, date: CivilDate): boolean {
  if (!rule.isActive || compareCivilDates(date, rule.startDate) < 0) {
    return false;
  }

  if (rule.endDate !== null && compareCivilDates(date, rule.endDate) > 0) {
    return false;
  }

  const { year, month, day } = getCivilDateParts(date);

  switch (rule.schedule.frequency) {
    case 'weekly':
      return getMondayBasedWeekday(date) === rule.schedule.chargeDay;
    case 'monthly':
      return day === Math.min(rule.schedule.chargeDay, daysInMonth(year, month));
    case 'yearly':
      return month === rule.schedule.chargeMonth &&
        day === Math.min(rule.schedule.chargeDay, daysInMonth(year, month));
  }
}

export function listRecurringRuleDatesDueBy(rule: RecurringRule, processingDate: CivilDate): readonly CivilDate[] {
  if (!rule.isActive || compareCivilDates(processingDate, rule.startDate) < 0) return [];
  const endDate = rule.endDate !== null && compareCivilDates(rule.endDate, processingDate) < 0
    ? rule.endDate
    : processingDate;

  switch (rule.schedule.frequency) {
    case 'weekly': return weeklyDates(rule, endDate);
    case 'monthly': return monthlyDates(rule, endDate);
    case 'yearly': return yearlyDates(rule, endDate);
  }
}

function weeklyDates(rule: RecurringRule, endDate: CivilDate): readonly CivilDate[] {
  const offset = (rule.schedule.chargeDay - getMondayBasedWeekday(rule.startDate) + 7) % 7;
  const dates: CivilDate[] = [];
  for (let date = addDays(rule.startDate, offset); compareCivilDates(date, endDate) <= 0; date = addDays(date, 7)) dates.push(date);
  return dates;
}

function monthlyDates(rule: RecurringRule, endDate: CivilDate): readonly CivilDate[] {
  const start = getCivilDateParts(rule.startDate); const end = getCivilDateParts(endDate); const dates: CivilDate[] = [];
  for (let year = start.year, month = start.month; year < end.year || (year === end.year && month <= end.month); ({ year, month } = nextMonth(year, month))) {
    const date = civilDate(year, month, Math.min(rule.schedule.chargeDay, daysInMonth(year, month)));
    if (compareCivilDates(date, rule.startDate) >= 0 && compareCivilDates(date, endDate) <= 0) dates.push(date);
  }
  return dates;
}

function yearlyDates(rule: RecurringRule, endDate: CivilDate): readonly CivilDate[] {
  const start = getCivilDateParts(rule.startDate); const end = getCivilDateParts(endDate); const dates: CivilDate[] = [];
  for (let year = start.year; year <= end.year; year += 1) {
    const month = rule.schedule.chargeMonth;
    const date = civilDate(year, month, Math.min(rule.schedule.chargeDay, daysInMonth(year, month)));
    if (compareCivilDates(date, rule.startDate) >= 0 && compareCivilDates(date, endDate) <= 0) dates.push(date);
  }
  return dates;
}

function addDays(date: CivilDate, days: number): CivilDate {
  let { year, month, day } = getCivilDateParts(date);
  for (let remaining = days; remaining > 0; remaining -= 1) {
    day += 1;
    if (day > daysInMonth(year, month)) { day = 1; month += 1; if (month === 13) { month = 1; year += 1; } }
  }
  return civilDate(year, month, day);
}

function nextMonth(year: number, month: number) { return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }; }
function civilDate(year: number, month: number, day: number): CivilDate { return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
