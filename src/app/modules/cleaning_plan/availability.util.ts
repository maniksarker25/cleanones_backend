import { TTask, TTaskFrequency, WEEKDAYS } from '../task/task.interface';

const WEEKDAY_INDEX_TO_CODE: Record<number, (typeof WEEKDAYS)[number]> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
};

export const dayOfWeekCode = (date: Date): (typeof WEEKDAYS)[number] =>
    WEEKDAY_INDEX_TO_CODE[date.getUTCDay()];

export const dayOfMonth = (date: Date): number => date.getUTCDate();

/** Strips the time-of-day, keeping only the UTC calendar date. */
export const normalizeToUTCDateOnly = (date: Date): Date =>
    new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );

/** Combines a calendar date with another Date's time-of-day (both read as UTC). */
export const combineDateWithTimeOfDay = (date: Date, timeSource: Date): Date =>
    new Date(
        Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            timeSource.getUTCHours(),
            timeSource.getUTCMinutes(),
            timeSource.getUTCSeconds()
        )
    );

const isSameCalendarDate = (a: Date, b: Date): boolean =>
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();

/**
 * Whether a recurring (or one-off) task/plan occurrence lands on the given date,
 * respecting an optional end_date bound.
 */
export const occursOnDate = (
    date: Date,
    pattern: {
        frequency_type: TTaskFrequency | 'once';
        anchor_date: Date;
        days_of_week?: string[] | null;
        days_of_month?: number[] | null;
        end_date?: Date | null;
    }
): boolean => {
    if (pattern.end_date && date > pattern.end_date) return false;
    if (date < pattern.anchor_date && !isSameCalendarDate(date, pattern.anchor_date)) {
        // Occurrences never precede the anchor/start date.
        return false;
    }

    switch (pattern.frequency_type) {
        case 'once':
            return isSameCalendarDate(date, pattern.anchor_date);
        case 'daily':
            return true;
        case 'weekly':
            return (pattern.days_of_week ?? []).includes(dayOfWeekCode(date));
        case 'monthly':
            return (pattern.days_of_month ?? []).includes(dayOfMonth(date));
        default:
            return false;
    }
};

export interface RecurrencePattern {
    frequency_type: TTaskFrequency | 'once';
    anchor_date: Date;
    days_of_week?: string[] | null;
    days_of_month?: number[] | null;
    end_date?: Date | null;
}

export const timeWindowsOverlap = (
    startA: Date,
    durationMinutesA: number,
    startB: Date,
    durationMinutesB: number
): boolean => {
    const minutesOfDay = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
    const startMinA = minutesOfDay(startA);
    const endMinA = startMinA + durationMinutesA;
    const startMinB = minutesOfDay(startB);
    const endMinB = startMinB + durationMinutesB;
    return startMinA < endMinB && startMinB < endMinA;
};

/** Whether a plan (represented by its rooms' task patterns) occurs on the given date. */
export const anyPatternOccursOnDate = (
    patterns: RecurrencePattern[],
    date: Date
): boolean => patterns.some((p) => occursOnDate(date, p));

export const taskToPattern = (
    task: Pick<TTask, 'frequency_type' | 'days_of_week' | 'days_of_month'>,
    anchorDate: Date,
    endDate?: Date | null
): RecurrencePattern => ({
    frequency_type: task.frequency_type,
    anchor_date: anchorDate,
    days_of_week: task.days_of_week ?? null,
    days_of_month: task.days_of_month ?? null,
    end_date: endDate ?? null,
});
