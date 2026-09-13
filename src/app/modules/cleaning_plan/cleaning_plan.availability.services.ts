import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { Task } from '../task/task.model';
import { Worker } from '../worker/worker.model';
import {
    activeWorkerFilter,
    assertWorkersEligible,
    filterEligibleWorkers,
} from '../worker/worker.eligibility.util';
import {
    RecurrencePattern,
    patternsShareADate,
    taskToPattern,
    timeWindowsOverlap,
} from './availability.util';
import { ConflictReason, IWorkerConflict } from './cleaning_plan.interface';
import { CleaningPlan } from './cleaning_plan.model';

/**
 * Server-computed conservative upper bound: sum of duration_minutes across
 * every active task under the given rooms. Deliberately worst-case (assumes
 * every task could land on the same day) rather than a per-date-accurate
 * figure — see design note: safe by construction for conflict-checking,
 * since if the worst case doesn't overlap, the real case never will either.
 */
export const computeMaxEstimatedDuration = async (
    roomIds: (Types.ObjectId | string)[]
): Promise<number> => {
    if (!roomIds.length) return 0;
    const tasks = await Task.find({
        room: { $in: roomIds },
        is_active: true,
    })
        .select('duration_minutes')
        .lean();
    return tasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
};

interface PlanScheduleContext {
    planId: Types.ObjectId | string;
    dateTime: Date;
    endDate: Date | null;
    roomIds: (Types.ObjectId | string)[];
}

export const loadTaskPatterns = async (
    roomIds: (Types.ObjectId | string)[],
    anchorDate: Date,
    endDate: Date | null
): Promise<RecurrencePattern[]> => {
    if (!roomIds.length) return [];
    const tasks = await Task.find({
        room: { $in: roomIds },
        is_active: true,
    })
        .select('frequency_type days_of_week days_of_month duration_minutes')
        .lean();
    return tasks.map((t) => taskToPattern(t, anchorDate, endDate));
};

/**
 * Whether the candidate plan schedule conflicts, for the given worker, with
 * any other active plan that worker is already assigned to (excluding the
 * plan being created/edited itself).
 */
export const findWorkerConflict = async (
    workerId: Types.ObjectId | string,
    candidate: PlanScheduleContext,
    candidatePatterns: RecurrencePattern[],
    candidateDuration: number
): Promise<IWorkerConflict | null> => {
    if (!candidatePatterns.length) return null;

    const otherPlans = await CleaningPlan.find({
        _id: { $ne: candidate.planId },
        'assigned_workers.worker': workerId,
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('rooms date_time end_date')
        .lean();

    for (const other of otherPlans) {
        const otherPatterns = await loadTaskPatterns(
            other.rooms ?? [],
            other.date_time,
            other.end_date ?? null
        );
        if (!otherPatterns.length) continue;

        const otherDuration = await computeMaxEstimatedDuration(
            other.rooms ?? []
        );
        if (
            !timeWindowsOverlap(
                candidate.dateTime,
                candidateDuration,
                other.date_time,
                otherDuration
            )
        ) {
            continue;
        }

        const datesCollide = candidatePatterns.some((cp) =>
            otherPatterns.some((op) => patternsShareADate(cp, op))
        );
        if (datesCollide) {
            const reason: ConflictReason = 'double_booked';
            return { conflicting_plan_id: other._id, reason };
        }
    }
    return null;
};

const buildCandidateContext = async (plan: {
    _id: Types.ObjectId | string;
    date_time: Date;
    end_date?: Date | null;
    rooms: (Types.ObjectId | string)[];
}) => {
    const context: PlanScheduleContext = {
        planId: plan._id,
        dateTime: plan.date_time,
        endDate: plan.end_date ?? null,
        roomIds: plan.rooms ?? [],
    };
    const patterns = await loadTaskPatterns(
        context.roomIds,
        context.dateTime,
        context.endDate
    );
    const duration = await computeMaxEstimatedDuration(context.roomIds);
    return { context, patterns, duration };
};

export interface EligibleWorkerResult {
    worker: Record<string, unknown>;
    is_conflict: boolean;
    conflict_reason: ConflictReason | null;
    conflicting_plan_id: Types.ObjectId | null;
}

export const listEligibleWorkersForPlan = async (
    planId: string
): Promise<EligibleWorkerResult[]> => {
    const plan = await CleaningPlan.findById(planId).lean();
    if (!plan) throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');

    const { context, patterns, duration } = await buildCandidateContext(plan);

    const allWorkers = await Worker.find(activeWorkerFilter).lean();
    const eligibleWorkers = await filterEligibleWorkers(allWorkers);

    const results: EligibleWorkerResult[] = [];
    for (const worker of eligibleWorkers) {
        const conflict = await findWorkerConflict(
            worker._id,
            context,
            patterns,
            duration
        );
        results.push({
            worker,
            is_conflict: !!conflict,
            conflict_reason: conflict?.reason ?? null,
            conflicting_plan_id: conflict?.conflicting_plan_id ?? null,
        });
    }
    return results;
};

export const assertWorkersAssignable = async (
    plan: {
        _id: Types.ObjectId | string;
        date_time: Date;
        end_date?: Date | null;
        rooms: (Types.ObjectId | string)[];
    },
    workerIds: (Types.ObjectId | string)[],
    force: boolean
): Promise<Map<string, IWorkerConflict>> => {
    // Hard-block ineligible (deleted/blocked/inactive) workers regardless of `force` —
    // that's a data-integrity issue, not a schedulable judgment call.
    await assertWorkersEligible(workerIds);

    const { context, patterns, duration } = await buildCandidateContext(plan);

    const conflicts = new Map<string, IWorkerConflict>();
    for (const workerId of workerIds) {
        const conflict = await findWorkerConflict(
            workerId,
            context,
            patterns,
            duration
        );
        if (conflict) conflicts.set(workerId.toString(), conflict);
    }

    if (conflicts.size && !force) {
        throw new AppError(
            httpStatus.CONFLICT,
            'One or more workers have a scheduling conflict. Pass force=true to assign anyway.',
            '',
            {
                conflicts: Array.from(conflicts.entries()).map(
                    ([workerId, c]) => ({
                        worker: workerId,
                        reason: c.reason,
                        conflicting_plan_id: c.conflicting_plan_id,
                    })
                ),
            }
        );
    }

    return conflicts;
};
