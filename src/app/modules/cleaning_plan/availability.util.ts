import { TTask, TTaskFrequency, WEEKDAYS } from '../task/task.interface';

const MAX_PROJECTION_HORIZON_DAYS = 90;

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

/**
 * Whether the two patterns' active date ranges (anchor_date..end_date, end_date
 * = indefinite when absent) overlap at all. A prerequisite for every fast-path
 * decision below — two "every Monday" patterns that are months apart with no
 * date-range overlap must never be reported as conflicting just because they
 * share a weekday label.
 */
const dateRangesOverlap = (a: RecurrencePattern, b: RecurrencePattern): boolean => {
    const laterStart = a.anchor_date > b.anchor_date ? a.anchor_date : b.anchor_date;
    const ends = [a.end_date, b.end_date].filter((d): d is Date => !!d);
    if (ends.length === 0) return true; // both indefinite: always overlap from laterStart onward
    const earlierEnd = ends.reduce((min, d) => (d < min ? d : min));
    return laterStart <= earlierEnd;
};

/**
 * Fast path: when both patterns share the same frequency type (and their date
 * ranges overlap), conflict can be decided by intersecting their day sets
 * directly, without projecting real calendar dates. This is a deliberate
 * approximation for very short overlap windows (e.g. a 2-day overlap that
 * happens not to contain either pattern's weekday) — acceptable here since
 * this feeds a human-reviewed warning (with a `force` override), not a hard
 * constraint, and erring toward over-flagging is the safer default.
 */
const sameTypeFastOverlap = (
    a: RecurrencePattern,
    b: RecurrencePattern
): boolean | null => {
    if (!dateRangesOverlap(a, b)) return false;

    if (a.frequency_type === 'daily' || b.frequency_type === 'daily') {
        return true;
    }
    if (a.frequency_type !== b.frequency_type) return null;

    if (a.frequency_type === 'weekly') {
        const setA = new Set(a.days_of_week ?? []);
        return (b.days_of_week ?? []).some((d) => setA.has(d));
    }
    if (a.frequency_type === 'monthly') {
        const setA = new Set(a.days_of_month ?? []);
        return (b.days_of_month ?? []).some((d) => setA.has(d));
    }
    return null;
};

export interface RecurrencePattern {
    frequency_type: TTaskFrequency | 'once';
    anchor_date: Date;
    days_of_week?: string[] | null;
    days_of_month?: number[] | null;
    end_date?: Date | null;
}

/**
 * Whether two recurring/one-off patterns ever land on the same calendar date,
 * bounded by MAX_PROJECTION_HORIZON_DAYS when a real date projection is required
 * (i.e. mismatched frequency types such as weekly vs monthly).
 */
export const patternsShareADate = (a: RecurrencePattern, b: RecurrencePattern): boolean => {
    const fast = sameTypeFastOverlap(a, b);
    if (fast !== null) return fast;

    const rangeStart = new Date(
        Math.max(a.anchor_date.getTime(), b.anchor_date.getTime())
    );
    const rangeEndCap = new Date(rangeStart);
    rangeEndCap.setUTCDate(rangeEndCap.getUTCDate() + MAX_PROJECTION_HORIZON_DAYS);

    const rangeEnd = [a.end_date, b.end_date, rangeEndCap]
        .filter((d): d is Date => !!d)
        .reduce((min, d) => (d < min ? d : min), rangeEndCap);

    for (
        let cursor = new Date(rangeStart);
        cursor <= rangeEnd;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
        if (occursOnDate(cursor, a) && occursOnDate(cursor, b)) return true;
    }
    return false;
};

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
