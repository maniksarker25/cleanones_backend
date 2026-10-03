import httpStatus from 'http-status';
import mongoose, { Types } from 'mongoose';
import AppError from '../../error/appError';
import { errorLogger } from '../../shared/logger';
import { combineDateWithTimeOfDay, normalizeToUTCDateOnly } from '../cleaning_plan/availability.util';
import { assertWorkersEligible } from '../worker/worker.eligibility.util';
import { Worker } from '../worker/worker.model';
import { IAssignedWorker } from './shift.interface';
import { Shift } from './shift.model';
import { assignWorkersToShift } from './shift.services';
import { listShiftsInRange } from './shift.query.services';
import { FULL_WEEKDAY_NAMES } from './shift.shared.util';

// Caps how far a bulk-assign preview/confirm can span, so neither walk is unbounded.
export const MAX_BULK_ASSIGN_RANGE_DAYS = 60;

// A due date with nobody covering it: virtual, cancelled, or an empty crew.
const isUnstaffedGap = (entry: {
    is_virtual: boolean;
    status: string;
    assigned_workers: unknown[];
}): boolean =>
    entry.is_virtual || entry.status === 'cancelled' || entry.assigned_workers.length === 0;

export interface BulkAssignDateEntry {
    date: Date;
    weekday: string;
}

export interface BulkAssignPreviewResult {
    worker_id: string;
    worker_name: string;
    range: { from: Date; to: Date };
    /** Due, unstaffed, and this worker's own working_days covers the weekday — would be assigned on confirm. */
    matching_dates: BulkAssignDateEntry[];
    /** Due and unstaffed, but this worker isn't available that weekday — still needs someone else. */
    other_gap_dates: BulkAssignDateEntry[];
    /** Due dates in range that already have an active crew — left untouched either way. */
    already_covered_count: number;
}

/**
 * Read-only preview for bulk-assign: splits this plan's still-unstaffed
 * dates in [from, to] by whether the worker's own working_days covers them.
 */
export const previewBulkAssignForWorker = async (
    planId: string,
    workerId: string,
    from: Date,
    to: Date
): Promise<BulkAssignPreviewResult> => {
    const fromDay = normalizeToUTCDateOnly(from);
    const toDay = normalizeToUTCDateOnly(to);
    if (toDay < fromDay) {
        throw new AppError(httpStatus.BAD_REQUEST, '`to` must not be before `from`');
    }
    const rangeDays =
        Math.round((toDay.getTime() - fromDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (rangeDays > MAX_BULK_ASSIGN_RANGE_DAYS) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Range too large — please select ${MAX_BULK_ASSIGN_RANGE_DAYS} days or fewer`
        );
    }
    if (!mongoose.isValidObjectId(workerId)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid worker ID');
    }

    await assertWorkersEligible([workerId]);
    const worker = await Worker.findById(workerId).select('name working_days').lean();
    if (!worker) {
        throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
    }
    const workingDays = new Set(worker.working_days ?? []);

    const shiftEntries = (await listShiftsInRange(planId, fromDay, toDay)) as Array<{
        date: Date;
        is_virtual: boolean;
        status: string;
        assigned_workers: unknown[];
    }>;

    const matching_dates: BulkAssignDateEntry[] = [];
    const other_gap_dates: BulkAssignDateEntry[] = [];
    let already_covered_count = 0;

    for (const entry of shiftEntries) {
        if (!isUnstaffedGap(entry)) {
            already_covered_count += 1;
            continue;
        }
        const weekday = FULL_WEEKDAY_NAMES[entry.date.getUTCDay()];
        const bucket = workingDays.has(weekday) ? matching_dates : other_gap_dates;
        bucket.push({ date: entry.date, weekday });
    }

    return {
        worker_id: workerId,
        worker_name: worker.name,
        range: { from: fromDay, to: toDay },
        matching_dates,
        other_gap_dates,
        already_covered_count,
    };
};

export interface BulkAssignOutcome {
    assigned: string[];
    skipped_already_staffed: string[];
    /** Skipped — worker's already booked elsewhere that day. Retry with force:true to assign anyway. */
    ignored_due_to_conflict: Array<{ date: string; reason: string }>;
    failed: Array<{ date: string; message: string }>;
    counts: {
        assigned: number;
        skipped_already_staffed: number;
        ignored_due_to_conflict: number;
        failed: number;
    };
}

/**
 * Write side of bulk-assign: stages the worker onto every still-unstaffed
 * date, delegating each one to assignWorkersToShift so eligibility checks
 * and notifications behave the same as a single manual assign. Best-effort,
 * not all-or-nothing — a scheduling conflict is skipped (not a failure)
 * unless `force` is set, in which case it's assigned anyway.
 */
export const bulkAssignWorkerToShifts = async (
    managerId: string,
    planId: string,
    workerId: string,
    role: IAssignedWorker['role'],
    dates: Date[],
    startTime: Date,
    endTime: Date,
    force: boolean
): Promise<BulkAssignOutcome> => {
    if (!(endTime > startTime)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'end_time must be after start_time');
    }
    if (dates.length > MAX_BULK_ASSIGN_RANGE_DAYS) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Too many dates — please select ${MAX_BULK_ASSIGN_RANGE_DAYS} or fewer`
        );
    }
    if (!mongoose.isValidObjectId(workerId)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid worker ID');
    }

    const normalizedDates = dates.map((d) => normalizeToUTCDateOnly(d));

    const existingShifts = await Shift.find({
        cleaning_plan: planId,
        date: { $in: normalizedDates },
    })
        .select('date status assigned_workers')
        .lean();
    const coveredDateKeys = new Set(
        existingShifts
            .filter((s) => !isUnstaffedGap({ ...s, is_virtual: false }))
            .map((s) => s.date.toISOString())
    );

    const outcome: Omit<BulkAssignOutcome, 'counts'> = {
        assigned: [],
        skipped_already_staffed: [],
        ignored_due_to_conflict: [],
        failed: [],
    };

    for (const date of normalizedDates) {
        const dateKey = date.toISOString();
        const dateLabel = dateKey.slice(0, 10);

        if (coveredDateKeys.has(dateKey)) {
            outcome.skipped_already_staffed.push(dateLabel);
            continue;
        }

        try {
            await assignWorkersToShift(
                managerId,
                planId,
                date,
                [{ worker: new Types.ObjectId(workerId), role }],
                combineDateWithTimeOfDay(date, startTime),
                combineDateWithTimeOfDay(date, endTime),
                force
            );
            outcome.assigned.push(dateLabel);
        } catch (error) {
            if (error instanceof AppError && error.statusCode === httpStatus.CONFLICT) {
                outcome.ignored_due_to_conflict.push({ date: dateLabel, reason: error.message });
            } else if (error instanceof AppError) {
                outcome.failed.push({ date: dateLabel, message: error.message });
            } else {
                // One bad date (e.g. a DB hiccup) shouldn't fail the whole batch.
                errorLogger.error(
                    `bulkAssignWorkerToShifts: unexpected error assigning ${planId}/${dateLabel}`,
                    error
                );
                outcome.failed.push({
                    date: dateLabel,
                    message: 'Unexpected error while assigning this date — please retry.',
                });
            }
        }
    }

    return {
        ...outcome,
        counts: {
            assigned: outcome.assigned.length,
            skipped_already_staffed: outcome.skipped_already_staffed.length,
            ignored_due_to_conflict: outcome.ignored_due_to_conflict.length,
            failed: outcome.failed.length,
        },
    };
};
