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
