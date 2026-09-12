/* eslint-disable @typescript-eslint/no-explicit-any */
type DateRangeResult = {
    currentStart?: Date;
    currentEnd?: Date;
    previousStart?: Date;
    previousEnd?: Date;
};

export const buildDateRangesByType = (query: any): DateRangeResult => {
    const { type, date, year, month, week } = query;

    let currentStart: Date | undefined;
    let currentEnd: Date | undefined;
    let previousStart: Date | undefined;
    let previousEnd: Date | undefined;

    /* ---------------- DAILY ---------------- */
    if (type === 'daily' && date) {
        currentStart = new Date(date);
        currentStart.setHours(0, 0, 0, 0);

        currentEnd = new Date(date);
        currentEnd.setHours(23, 59, 59, 999);

        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 1);

        previousEnd = new Date(currentEnd);
        previousEnd.setDate(previousEnd.getDate() - 1);
    }

    /* ---------------- WEEKLY ---------------- */
    if (type === 'weekly' && year && week) {
        const firstDayOfYear = new Date(Number(year), 0, 1);
        const weekStart = new Date(firstDayOfYear);

        weekStart.setDate(firstDayOfYear.getDate() + (Number(week) - 1) * 7);
        weekStart.setHours(0, 0, 0, 0);

        currentStart = weekStart;

        currentEnd = new Date(weekStart);
        currentEnd.setDate(currentEnd.getDate() + 6);
        currentEnd.setHours(23, 59, 59, 999);

        previousStart = new Date(currentStart);
        previousStart.setDate(previousStart.getDate() - 7);

        previousEnd = new Date(currentEnd);
        previousEnd.setDate(previousEnd.getDate() - 7);
    }

    /* ---------------- MONTHLY ---------------- */
    if (type === 'monthly' && year && month) {
        currentStart = new Date(Number(year), Number(month) - 1, 1);
        currentStart.setHours(0, 0, 0, 0);

        currentEnd = new Date(Number(year), Number(month), 0);
        currentEnd.setHours(23, 59, 59, 999);

        previousStart = new Date(Number(year), Number(month) - 2, 1);
        previousStart.setHours(0, 0, 0, 0);

        previousEnd = new Date(Number(year), Number(month) - 1, 0);
        previousEnd.setHours(23, 59, 59, 999);
    }

    /* ---------------- YEARLY ---------------- */
    if (type === 'yearly' && year) {
        currentStart = new Date(Number(year), 0, 1);
        currentStart.setHours(0, 0, 0, 0);

        currentEnd = new Date(Number(year), 11, 31);
        currentEnd.setHours(23, 59, 59, 999);

        previousStart = new Date(Number(year) - 1, 0, 1);
        previousStart.setHours(0, 0, 0, 0);

        previousEnd = new Date(Number(year) - 1, 11, 31);
        previousEnd.setHours(23, 59, 59, 999);
    }

    /* ---------------- LIFETIME ---------------- */
    if (type === 'lifetime') {
        return {};
    }

    return {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
    };
};
