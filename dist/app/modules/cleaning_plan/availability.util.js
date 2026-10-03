"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskToPattern = exports.anyPatternOccursOnDate = exports.timeWindowsOverlap = exports.occursOnDate = exports.combineDateWithTimeOfDay = exports.normalizeToUTCDateOnly = exports.laterOf = exports.dayOfMonth = exports.dayOfWeekCode = void 0;
const WEEKDAY_INDEX_TO_CODE = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
};
const dayOfWeekCode = (date) => WEEKDAY_INDEX_TO_CODE[date.getUTCDay()];
exports.dayOfWeekCode = dayOfWeekCode;
const dayOfMonth = (date) => date.getUTCDate();
exports.dayOfMonth = dayOfMonth;
/**
 * The later of two dates — used to anchor a task's recurrence pattern to
 * whichever came second: the task's own creation, or the cleaning plan's
 * (a task reused by/added to a plan is never "due" for that plan before the
 * plan itself existed, even if the task document is older).
 */
const laterOf = (a, b) => (a > b ? a : b);
exports.laterOf = laterOf;
/** Strips the time-of-day, keeping only the UTC calendar date. */
const normalizeToUTCDateOnly = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
exports.normalizeToUTCDateOnly = normalizeToUTCDateOnly;
/** Combines a calendar date with another Date's time-of-day (both read as UTC). */
const combineDateWithTimeOfDay = (date, timeSource) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), timeSource.getUTCHours(), timeSource.getUTCMinutes(), timeSource.getUTCSeconds()));
exports.combineDateWithTimeOfDay = combineDateWithTimeOfDay;
const isSameCalendarDate = (a, b) => a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate();
/**
 * Whether a recurring (or one-off) task/plan occurrence lands on the given date,
 * respecting an optional end_date bound.
 */
const occursOnDate = (date, pattern) => {
    var _a, _b;
    if (pattern.end_date && date > pattern.end_date)
        return false;
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
            return ((_a = pattern.days_of_week) !== null && _a !== void 0 ? _a : []).includes((0, exports.dayOfWeekCode)(date));
        case 'monthly':
            return ((_b = pattern.days_of_month) !== null && _b !== void 0 ? _b : []).includes((0, exports.dayOfMonth)(date));
        default:
            return false;
    }
};
exports.occursOnDate = occursOnDate;
const timeWindowsOverlap = (startA, durationMinutesA, startB, durationMinutesB) => {
    const minutesOfDay = (d) => d.getUTCHours() * 60 + d.getUTCMinutes();
    const startMinA = minutesOfDay(startA);
    const endMinA = startMinA + durationMinutesA;
    const startMinB = minutesOfDay(startB);
    const endMinB = startMinB + durationMinutesB;
    return startMinA < endMinB && startMinB < endMinA;
};
exports.timeWindowsOverlap = timeWindowsOverlap;
/** Whether a plan (represented by its rooms' task patterns) occurs on the given date. */
const anyPatternOccursOnDate = (patterns, date) => patterns.some((p) => (0, exports.occursOnDate)(date, p));
exports.anyPatternOccursOnDate = anyPatternOccursOnDate;
const taskToPattern = (task, anchorDate, endDate) => {
    var _a, _b;
    return ({
        frequency_type: task.frequency_type,
        anchor_date: anchorDate,
        days_of_week: (_a = task.days_of_week) !== null && _a !== void 0 ? _a : null,
        days_of_month: (_b = task.days_of_month) !== null && _b !== void 0 ? _b : null,
        end_date: endDate !== null && endDate !== void 0 ? endDate : null,
    });
};
exports.taskToPattern = taskToPattern;
