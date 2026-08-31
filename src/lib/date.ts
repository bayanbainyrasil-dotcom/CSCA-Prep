const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function safeTimezone(timezone: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    return timezone;
  } catch {
    return 'UTC';
  }
}

export function deviceTimezone(): string {
  return safeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
}

export function dateKeyInTimezone(date = new Date(), timezone = 'UTC'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function dateKeyToUtcMilliseconds(value: string): number | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? timestamp
    : null;
}

export function calendarDayDifference(from: string, to: string): number | null {
  const start = dateKeyToUtcMilliseconds(from);
  const end = dateKeyToUtcMilliseconds(to);
  return start === null || end === null ? null : Math.round((end - start) / 86_400_000);
}

export function preparationDay(createdAt: string, now: Date, timezone: string, totalDays = 84): number {
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) return 1;
  const elapsed = calendarDayDifference(dateKeyInTimezone(created, timezone), dateKeyInTimezone(now, timezone)) ?? 0;
  return Math.max(1, Math.min(totalDays, elapsed + 1));
}

export function daysUntilDate(targetDate: string | null, now: Date, timezone: string): number | null {
  if (!targetDate) return null;
  return calendarDayDifference(dateKeyInTimezone(now, timezone), targetDate);
}

export function greetingFor(date: Date, timezone: string): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const hourPart = new Intl.DateTimeFormat('en', {
    timeZone: safeTimezone(timezone),
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date).find((part) => part.type === 'hour')?.value;
  const hour = Number(hourPart ?? 0);
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function weekdayFor(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en', { timeZone: safeTimezone(timezone), weekday: 'long' }).format(date);
}

export function localDateTimeLabels(date: Date, timezone: string): { date: string; time: string; zone: string } {
  const zone = safeTimezone(timezone);
  return {
    date: new Intl.DateTimeFormat('en', {
      timeZone: zone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('en', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date),
    zone,
  };
}
