import { describe, expect, it } from 'vitest';
import { calendarDayDifference, dateKeyInTimezone, daysUntilDate, greetingFor, localDateTimeLabels, preparationDay } from './date';

describe('calendar and greeting helpers', () => {
  it('uses calendar days without daylight-saving drift', () => {
    expect(calendarDayDifference('2026-03-07', '2026-03-09')).toBe(2);
    expect(calendarDayDifference('2026-02-30', '2026-03-01')).toBeNull();
  });

  it('formats the same instant in the learner timezone', () => {
    const instant = new Date('2026-08-31T19:30:00.000Z');
    expect(dateKeyInTimezone(instant, 'Asia/Qyzylorda')).toBe('2026-09-01');
    expect(dateKeyInTimezone(instant, 'America/New_York')).toBe('2026-08-31');
  });

  it('shows an unambiguous local date, time, and IANA timezone while travelling', () => {
    const instant = new Date('2026-08-31T19:30:00.000Z');
    expect(localDateTimeLabels(instant, 'Asia/Shanghai')).toEqual({
      date: 'Tue, Sep 1, 2026',
      time: '03:30',
      zone: 'Asia/Shanghai',
    });
    expect(localDateTimeLabels(instant, 'America/New_York')).toEqual({
      date: 'Mon, Aug 31, 2026',
      time: '15:30',
      zone: 'America/New_York',
    });
    expect(localDateTimeLabels(instant, 'Australia/Sydney')).toEqual({
      date: 'Tue, Sep 1, 2026',
      time: '05:30',
      zone: 'Australia/Sydney',
    });
  });

  it('shows the correct greeting in the learner timezone', () => {
    expect(greetingFor(new Date('2026-08-31T04:44:00.000Z'), 'Asia/Qyzylorda')).toBe('Good morning');
    expect(greetingFor(new Date('2026-08-31T09:00:00.000Z'), 'Asia/Qyzylorda')).toBe('Good afternoon');
    expect(greetingFor(new Date('2026-08-31T14:00:00.000Z'), 'Asia/Qyzylorda')).toBe('Good evening');
  });

  it('derives the real preparation day and exam countdown', () => {
    const now = new Date('2026-08-31T10:00:00.000Z');
    expect(preparationDay('2026-08-30T06:00:00.000Z', now, 'UTC')).toBe(2);
    expect(daysUntilDate('2026-09-10', now, 'UTC')).toBe(10);
    expect(daysUntilDate(null, now, 'UTC')).toBeNull();
  });
});
