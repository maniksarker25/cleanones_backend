import httpStatus from 'http-status';
import mongoose from 'mongoose';
import AppError from '../../error/appError';
import { normalizeToUTCDateOnly } from '../cleaning_plan/availability.util';
import { WorkerType } from '../worker/worker.constant';
import { Worker } from '../worker/worker.model';
import { IssueReport } from '../issue_report/issue_report.model';
import { IShiftTask } from './shift.interface';
import { Shift } from './shift.model';
import { roundToTwoDecimals } from './shift.shared.util';

// ─── Manager report (week/month/quarter/year) ───────────────────────────────

export const REPORT_PERIODS = ['week', 'month', 'quarter', 'year'] as const;
export type TReportPeriod = (typeof REPORT_PERIODS)[number];

// "This week/month/quarter/year" as an inclusive UTC [from, to] range. Week starts Monday.
const getReportDateRange = (period: TReportPeriod, now: Date) => {
    const today = normalizeToUTCDateOnly(now);

    if (period === 'week') {
        const dayOfWeek = today.getUTCDay(); // 0=Sun..6=Sat
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const from = new Date(today);
        from.setUTCDate(from.getUTCDate() + diffToMonday);
        const to = new Date(from);
        to.setUTCDate(to.getUTCDate() + 6);
        return { from, to };
    }

    if (period === 'month') {
        const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
        const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
        return { from, to };
    }

    if (period === 'quarter') {
        const quarterStartMonth = Math.floor(today.getUTCMonth() / 3) * 3;
        const from = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth, 1));
        const to = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth + 3, 0));
        return { from, to };
    }

    // year
    const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
    return { from, to };
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Bucket size scales with range length so every period renders a readable number of bars. */
const buildShiftTrendBuckets = (
    period: TReportPeriod,
    from: Date,
    to: Date,
    shiftDates: Date[]
) => {
    if (period === 'week') {
        return WEEKDAY_LABELS.map((label, index) => {
            const date = new Date(from);
            date.setUTCDate(date.getUTCDate() + index);
            const count = shiftDates.filter((d) => d.getTime() === date.getTime()).length;
            return { label, date: date.toISOString().slice(0, 10), total_shift: count };
        });
    }

    if (period === 'month') {
        const daysInMonth = to.getUTCDate();
        return Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), i + 1));
            const count = shiftDates.filter((d) => d.getTime() === date.getTime()).length;
            return { label: String(i + 1), date: date.toISOString().slice(0, 10), total_shift: count };
        });
    }

    if (period === 'quarter') {
        const buckets: { label: string; date: string; total_shift: number }[] = [];
        let cursor = new Date(from);
        let weekIndex = 1;
        while (cursor <= to) {
            const bucketEnd = new Date(cursor);
            bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 6);
            const cappedEnd = bucketEnd > to ? to : bucketEnd;
            const count = shiftDates.filter(
                (d) => d >= cursor && d <= cappedEnd
            ).length;
            buckets.push({
                label: `Week ${weekIndex}`,
                date: cursor.toISOString().slice(0, 10),
                total_shift: count,
            });
            cursor = new Date(cappedEnd);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            weekIndex += 1;
        }
        return buckets;
    }

    // year
    return MONTH_LABELS.map((label, monthIndex) => {
        const count = shiftDates.filter(
            (d) => d.getUTCFullYear() === from.getUTCFullYear() && d.getUTCMonth() === monthIndex
        ).length;
        return { label, total_shift: count };
    });
};

/** Dashboard report: shift + issue-report totals for the period, plus a trend chart and status breakdown. */
export const getManagerReportFromDB = async (period: TReportPeriod) => {
    const now = new Date();
    const { from, to } = getReportDateRange(period, now);
    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    const [shifts, issueReports] = await Promise.all([
        Shift.find({ date: { $gte: from, $lt: toExclusive } })
            .select('date')
            .lean(),
        IssueReport.find({ createdAt: { $gte: from, $lt: toExclusive } })
            .select('status')
            .lean(),
    ]);

    const shiftDates = shifts.map((s) => s.date);

    const issueReportStatus = {
        PENDING: issueReports.filter((r) => r.status === 'PENDING').length,
        IN_PROGRESS: issueReports.filter((r) => r.status === 'IN_PROGRESS').length,
        RESOLVED: issueReports.filter((r) => r.status === 'RESOLVED').length,
    };

    return {
        period,
        range: {
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
        },
        summary: {
            total_shift: shifts.length,
            total_issue_report: issueReports.length,
        },
        shift_trends: buildShiftTrendBuckets(period, from, to, shiftDates),
        issue_report_status: issueReportStatus,
    };
};

/**
 * One worker's monthly performance, from materialized shifts only (the
 * source of truth for check-in/check-out data). late = checked in after the
 * scheduled start; absent = past date, status not cancelled, never checked in.
 */
export const getWorkerPerformanceFromDB = async (
    workerId: string,
    month?: number,
    year?: number
) => {
    const now = new Date();
    const targetYear = year ?? now.getUTCFullYear();
    const targetMonth = month ?? now.getUTCMonth() + 1; // 1-12
    if (targetMonth < 1 || targetMonth > 12) {
        throw new AppError(httpStatus.BAD_REQUEST, 'month must be between 1 and 12');
    }

    const monthStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const monthEnd = new Date(Date.UTC(targetYear, targetMonth, 0)); // last day of the month
    const today = normalizeToUTCDateOnly(now);

    // A worker only ever appears on a real, staffed Shift.
    const materialized = await Shift.find({
        'assigned_workers.worker': workerId,
        date: { $gte: monthStart, $lte: monthEnd },
    }).lean();

    let completed = 0;
    let inProgress = 0;
    let upcomingMaterialized = 0;
    let late = 0;
    let absent = 0;
    let workedMs = 0;

    for (const shift of materialized) {
        if (shift.status === 'completed') completed += 1;
        if (shift.status === 'in_progress') inProgress += 1;
        if (shift.status === 'upcoming') upcomingMaterialized += 1;

        const entry = shift.assigned_workers.find(
            (aw) => aw.worker.toString() === workerId
        );
        if (!entry) continue;

        if (entry.check_in_at && entry.check_in_at > shift.date_time) {
            late += 1;
        }

        if (shift.date < today && shift.status !== 'cancelled' && !entry.check_in_at) {
            absent += 1;
        }

        if (entry.check_in_at && entry.check_out_at) {
            workedMs += entry.check_out_at.getTime() - entry.check_in_at.getTime();
        }
    }

    const photo_quality = summarisePhotoQuality(materialized);

    return {
        month: targetMonth,
        year: targetYear,
        total_shift_on_this_month: materialized.length,
        total_completed_on_this_month: completed,
        total_in_progress: inProgress,
        total_upcoming_on_this_month: upcomingMaterialized,
        total_late_on_this_month: late,
        total_absent_on_this_month: absent,
        total_work_on_this_month: roundToTwoDecimals(workedMs / 3_600_000),
        photo_quality,
    };
};

export interface IWorkerPhotoQuality {
    total_photos: number;
    approved: number;
    rejected: number;
    /** Share of decided photos that were approved, or null if none were. */
    approval_rate: number | null;
    /** Decided by a person rather than automatically. */
    reviewed_by_manager: number;
    /** Gate rejections the worker had to retake past, across all photos. */
    retakes: number;
    /** Accepted only because the retake limit was reached. */
    forced_accepts: number;
}

/**
 * Photo quality for one worker. Uses a manager's verdict where there is
 * one, the automatic decision otherwise — but reports both counts
 * separately, since an all-machine approval rate means something different.
 */
const summarisePhotoQuality = (
    shifts: { tasks?: IShiftTask[] }[]
): IWorkerPhotoQuality => {
    let total = 0;
    let approved = 0;
    let rejected = 0;
    let reviewedByManager = 0;
    let retakes = 0;
    let forcedAccepts = 0;

    for (const shift of shifts) {
        for (const task of shift.tasks ?? []) {
            for (const requirement of task.photo_requirements ?? []) {
                if (!requirement.is_uploaded) continue;
                total += 1;

                if (requirement.attempt_count && requirement.attempt_count > 1) {
                    retakes += requirement.attempt_count - 1;
                }
                if (requirement.forced_accept) forcedAccepts += 1;

                const verdict =
                    requirement.manager_verdict ?? requirement.auto_decision;
                if (requirement.manager_verdict) reviewedByManager += 1;
                if (verdict === 'approved') approved += 1;
                if (verdict === 'rejected') rejected += 1;
            }
        }
    }

    const decided = approved + rejected;
    return {
        total_photos: total,
        approved,
        rejected,
        approval_rate: decided ? roundToTwoDecimals((approved / decided) * 100) : null,
        reviewed_by_manager: reviewedByManager,
        retakes,
        forced_accepts: forcedAccepts,
    };
};

export type TAttendanceSummaryPeriod = 'today' | 'weekly' | 'monthly';

/** [start, end) UTC bounds for the requested period, anchored on `now`. Weekly runs Monday-Sunday. */
const getAttendanceSummaryPeriodRange = (
    period: TAttendanceSummaryPeriod,
    now: Date
): { start: Date; end: Date } => {
    const today = normalizeToUTCDateOnly(now);

    if (period === 'today') {
        const end = new Date(today);
        end.setUTCDate(end.getUTCDate() + 1);
        return { start: today, end };
    }

    if (period === 'weekly') {
        const dayIndex = today.getUTCDay(); // 0 = Sun .. 6 = Sat
        const diffToMonday = dayIndex === 0 ? 6 : dayIndex - 1;
        const start = new Date(today);
        start.setUTCDate(start.getUTCDate() - diffToMonday);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 7);
        return { start, end };
    }

    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    return { start, end };
};

/**
 * Attendance summary across all workers for the period. Each assigned-worker
 * entry counts separately. punctuality_percentage is on-time check-ins over
 * total check-ins (on-time = at or before the scheduled start, no grace).
 */
export const getWorkersAttendanceSummaryFromDB = async (
    period: TAttendanceSummaryPeriod
) => {
    const now = new Date();
    const { start, end } = getAttendanceSummaryPeriodRange(period, now);

    const shifts = await Shift.find({
        date: { $gte: start, $lt: end },
    }).lean();

    let completedShifts = 0;
    let workedMs = 0;
    let checkedInCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;

    for (const shift of shifts) {
        if (shift.status === 'completed') completedShifts += 1;

        for (const entry of shift.assigned_workers) {
            if (entry.check_in_at && entry.check_out_at) {
                workedMs += entry.check_out_at.getTime() - entry.check_in_at.getTime();
            }

            if (entry.check_in_at) {
                checkedInCount += 1;
                if (entry.check_in_at > shift.date_time) {
                    lateCount += 1;
                } else {
                    onTimeCount += 1;
                }
            }
        }
    }

    const punctualityPercentage =
        checkedInCount > 0
            ? roundToTwoDecimals((onTimeCount / checkedInCount) * 100)
            : 0;

    return {
        period,
        start_date: start,
        end_date: end,
        total_hours: roundToTwoDecimals(workedMs / 3_600_000),
        completed_shifts: completedShifts,
        punctuality_percentage: punctualityPercentage,
        on_time_check_ins: onTimeCount,
        late_check_ins: lateCount,
    };
};

/**
 * Per-worker attendance rows for the period, filterable by name/worker type.
 * One row per matching active worker, even with zero shifts (an all-0 row).
 */
export const getWorkersAttendanceListFromDB = async (
    period: TAttendanceSummaryPeriod,
    searchTerm?: string,
    workerType?: WorkerType
) => {
    const now = new Date();
    const { start, end } = getAttendanceSummaryPeriodRange(period, now);

    const workerFilter: Record<string, unknown> = { isDeleted: { $ne: true } };
    if (workerType) workerFilter.worker_type = workerType;
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        workerFilter.name = { $regex: escaped, $options: 'i' };
    }

    const workers = await Worker.find(workerFilter)
        .select('name worker_type')
        .lean();

    if (!workers.length) return [];

    const workerIds = new Set(workers.map((w) => w._id.toString()));

    const shifts = await Shift.find({
        date: { $gte: start, $lt: end },
        'assigned_workers.worker': { $in: workers.map((w) => w._id) },
    }).lean();

    const statsByWorker = new Map<
        string,
        { hoursWorkedMs: number; totalShifts: number; lateDays: number }
    >();

    for (const shift of shifts) {
        for (const entry of shift.assigned_workers) {
            const workerId = entry.worker.toString();
            if (!workerIds.has(workerId)) continue;

            const stats = statsByWorker.get(workerId) ?? {
                hoursWorkedMs: 0,
                totalShifts: 0,
                lateDays: 0,
            };
            stats.totalShifts += 1;
            if (entry.check_in_at && entry.check_out_at) {
                stats.hoursWorkedMs +=
                    entry.check_out_at.getTime() - entry.check_in_at.getTime();
            }
            if (entry.check_in_at && entry.check_in_at > shift.date_time) {
                stats.lateDays += 1;
            }
            statsByWorker.set(workerId, stats);
        }
    }

    return workers.map((worker) => {
        const stats = statsByWorker.get(worker._id.toString());
        return {
            worker_id: worker._id,
            name: worker.name,
            worker_type: worker.worker_type,
            hours_worked: roundToTwoDecimals((stats?.hoursWorkedMs ?? 0) / 3_600_000),
            total_shifts: stats?.totalShifts ?? 0,
            late_days: stats?.lateDays ?? 0,
        };
    });
};

/** Same as getWorkersAttendanceSummaryFromDB, scoped to one worker — powers the profile's Attendance tab. */
export const getWorkerAttendanceSummaryFromDB = async (
    workerId: string,
    period: TAttendanceSummaryPeriod
) => {
    if (!mongoose.isObjectIdOrHexString(workerId)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid worker ID');
    }
    const worker = await Worker.findOne({
        _id: workerId,
        isDeleted: { $ne: true },
    }).select('_id').lean();
    if (!worker) throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');

    const now = new Date();
    const { start, end } = getAttendanceSummaryPeriodRange(period, now);

    const shifts = await Shift.find({
        date: { $gte: start, $lt: end },
        'assigned_workers.worker': workerId,
    })
        .select('date_time status assigned_workers.worker assigned_workers.check_in_at assigned_workers.check_out_at')
        .lean();

    let completedShifts = 0;
    let workedMs = 0;
    let onTimeCount = 0;
    let lateCount = 0;

    for (const shift of shifts) {
        const entry = shift.assigned_workers.find(
            (aw) => aw.worker.toString() === workerId
        );
        if (!entry) continue;

        if (shift.status === 'completed') completedShifts += 1;

        if (entry.check_in_at && entry.check_out_at) {
            workedMs += entry.check_out_at.getTime() - entry.check_in_at.getTime();
        }

        if (entry.check_in_at) {
            if (entry.check_in_at > shift.date_time) {
                lateCount += 1;
            } else {
                onTimeCount += 1;
            }
        }
    }

    const checkedInCount = onTimeCount + lateCount;
    const punctualityPercentage =
        checkedInCount > 0
            ? roundToTwoDecimals((onTimeCount / checkedInCount) * 100)
            : 0;

    return {
        period,
        start_date: start,
        end_date: end,
        total_hours: roundToTwoDecimals(workedMs / 3_600_000),
        completed_shifts: completedShifts,
        punctuality_percentage: punctualityPercentage,
        total_check_ins: checkedInCount,
        on_time_check_ins: onTimeCount,
        late_check_ins: lateCount,
    };
};
