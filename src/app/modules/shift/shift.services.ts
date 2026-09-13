import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import {
    anyPatternOccursOnDate,
    combineDateWithTimeOfDay,
    normalizeToUTCDateOnly,
} from '../cleaning_plan/availability.util';
import {
    computeMaxEstimatedDuration,
    loadTaskPatterns,
} from '../cleaning_plan/cleaning_plan.availability.services';
import { IAssignedWorker } from '../cleaning_plan/cleaning_plan.interface';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { assertWorkersEligible } from '../worker/worker.eligibility.util';
import { findWorkerConflictOnDate } from './shift.availability.services';
import { IShift } from './shift.interface';
import { Shift } from './shift.model';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

const ensurePlanExists = async (planId: string) => {
    const plan = await CleaningPlan.findById(planId);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
    return plan;
};

/**
 * The single write path for materializing a Shift. Called from both the
 * manual worker-reassignment flow and the daily cron job, so exactly one
 * code path ever creates a Shift document — behavior can't drift between them.
 *
 * Idempotent under concurrency via the { cleaning_plan, date } unique index:
 * if two callers race to create the same occurrence, the loser's insert
 * fails with a duplicate-key error, which it recovers from by re-fetching
 * the winner's document instead of erroring out.
 */
export const getOrCreateShift = async (
    planId: string | Types.ObjectId,
    date: Date
): Promise<IShift & { _id: Types.ObjectId }> => {
    const day = normalizeToUTCDateOnly(date);

    const existing = await Shift.findOne({ cleaning_plan: planId, date: day });
    if (existing) return existing;

    const plan = await CleaningPlan.findById(planId);
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
    if (!plan.is_active) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'Cannot create a shift for an inactive cleaning plan'
        );
    }

    const patterns = await loadTaskPatterns(
        plan.rooms ?? [],
        plan.date_time,
        plan.end_date ?? null
    );
    if (!anyPatternOccursOnDate(patterns, day)) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This cleaning plan has no occurrence on the given date'
        );
    }

    const duration = await computeMaxEstimatedDuration(plan.rooms ?? []);

    try {
        return await Shift.create({
            cleaning_plan: plan._id,
            date: day,
            date_time: combineDateWithTimeOfDay(day, plan.date_time),
            rooms: plan.rooms,
            duration_minutes: duration,
            assigned_workers: plan.assigned_workers,
            is_worker_overridden: false,
            status: 'upcoming',
        });
    } catch (error) {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            (error as { code: number }).code === MONGO_DUPLICATE_KEY_ERROR
        ) {
            // Lost the race to a concurrent creator (another request or the
            // cron job) — their document is authoritative, use it.
            const winner = await Shift.findOne({
                cleaning_plan: planId,
                date: day,
            });
            if (winner) return winner;
        }
        throw error;
    }
};

/**
 * Read-only preview for a single date: returns the materialized Shift if one
 * exists, otherwise builds an equivalent, unsaved shape from the plan's
 * current live state (`is_virtual: true`) — no DB write happens here.
 */
export const getShiftForDate = async (planId: string, date: Date) => {
    const day = normalizeToUTCDateOnly(date);
    const existing = await Shift.findOne({
        cleaning_plan: planId,
        date: day,
    }).lean();
    if (existing) return { ...existing, is_virtual: false };

    const plan = await ensurePlanExists(planId);
    const patterns = await loadTaskPatterns(
        plan.rooms ?? [],
        plan.date_time,
        plan.end_date ?? null
    );
    if (!anyPatternOccursOnDate(patterns, day)) return null;

    const duration = await computeMaxEstimatedDuration(plan.rooms ?? []);
    return {
        cleaning_plan: plan._id,
        date: day,
        date_time: combineDateWithTimeOfDay(day, plan.date_time),
        rooms: plan.rooms,
        duration_minutes: duration,
        assigned_workers: plan.assigned_workers,
        is_worker_overridden: false,
        status: 'upcoming' as const,
        is_virtual: true,
    };
};

/**
 * Lists every occurrence of the plan between [from, to], each either the
 * materialized Shift or a virtual preview — dates the plan doesn't occur on
 * are omitted entirely rather than returned as empty placeholders.
 */
export const listShiftsInRange = async (
    planId: string,
    from: Date,
    to: Date
) => {
    const plan = await ensurePlanExists(planId);
    const fromDay = normalizeToUTCDateOnly(from);
    const toDay = normalizeToUTCDateOnly(to);
    if (toDay < fromDay) {
        throw new AppError(httpStatus.BAD_REQUEST, '`to` must not be before `from`');
    }

    const patterns = await loadTaskPatterns(
        plan.rooms ?? [],
        plan.date_time,
        plan.end_date ?? null
    );

    const existingShifts = await Shift.find({
        cleaning_plan: planId,
        date: { $gte: fromDay, $lte: toDay },
    }).lean();
    const existingByDate = new Map(
        existingShifts.map((s) => [s.date.toISOString(), s])
    );

    const duration = await computeMaxEstimatedDuration(plan.rooms ?? []);
    const results: Array<Record<string, unknown>> = [];

    for (
        let cursor = new Date(fromDay);
        cursor <= toDay;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
        const day = new Date(cursor);
        const existing = existingByDate.get(day.toISOString());
        if (existing) {
            results.push({ ...existing, is_virtual: false });
            continue;
        }
        if (!anyPatternOccursOnDate(patterns, day)) continue;
        results.push({
            cleaning_plan: plan._id,
            date: day,
            date_time: combineDateWithTimeOfDay(day, plan.date_time),
            rooms: plan.rooms,
            duration_minutes: duration,
            assigned_workers: plan.assigned_workers,
            is_worker_overridden: false,
            status: 'upcoming',
            is_virtual: true,
        });
    }
    return results;
};

/**
 * Reassigns workers for one specific occurrence only, materializing the
 * shift first if it doesn't exist yet. Mirrors the plan-level assignment
 * rules: ineligible workers are always rejected; scheduling conflicts are
 * rejected unless `force`, in which case the conflicted entries are flagged
 * for audit purposes.
 */
export const assignWorkersToShift = async (
    managerId: string,
    planId: string,
    date: Date,
    assignedWorkers: IAssignedWorker[],
    force: boolean
) => {
    const shift = await getOrCreateShift(planId, date);

    await assertWorkersEligible(assignedWorkers.map((aw) => aw.worker));

    const conflictEntries = new Map<
        string,
        { conflicting_plan_id: Types.ObjectId; reason: string }
    >();
    for (const aw of assignedWorkers) {
        const conflict = await findWorkerConflictOnDate(
            aw.worker,
            shift.date,
            shift.date_time,
            shift.duration_minutes,
            { shiftId: shift._id, planId: shift.cleaning_plan }
        );
        if (conflict) conflictEntries.set(aw.worker.toString(), conflict);
    }

    if (conflictEntries.size && !force) {
        throw new AppError(
            httpStatus.CONFLICT,
            'One or more workers have a scheduling conflict. Pass force=true to assign anyway.',
            '',
            {
                conflicts: Array.from(conflictEntries.entries()).map(
                    ([workerId, c]) => ({
                        worker: workerId,
                        reason: c.reason,
                        conflicting_plan_id: c.conflicting_plan_id,
                    })
                ),
            }
        );
    }

    const result = await Shift.findByIdAndUpdate(
        shift._id,
        {
            assigned_workers: assignedWorkers.map((aw) => ({
                ...aw,
                assigned_with_conflict: conflictEntries.has(
                    aw.worker.toString()
                ),
            })),
            is_worker_overridden: true,
            last_updated_by: managerId,
        },
        { new: true, runValidators: true }
    );
    return result;
};

export const updateShiftStatus = async (
    managerId: string,
    planId: string,
    date: Date,
    status: IShift['status']
) => {
    const shift = await getOrCreateShift(planId, date);
    const result = await Shift.findByIdAndUpdate(
        shift._id,
        { status, last_updated_by: managerId },
        { new: true, runValidators: true }
    );
    return result;
};

const shiftServices = {
    getOrCreateShift,
    getShiftForDate,
    listShiftsInRange,
    assignWorkersToShift,
    updateShiftStatus,
};

export default shiftServices;
