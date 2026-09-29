import type { CivilDate } from '@/domain';

export function resolveSystemTimeZone(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidTimeZone(timeZone) ? timeZone : 'UTC';
}

export function getCivilDateInTimeZone(instant: Date, timeZone: string): CivilDate {
  if (!Number.isFinite(instant.getTime()) || !isValidTimeZone(timeZone)) {
    throw new Error('Invalid financial date or timezone.');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
