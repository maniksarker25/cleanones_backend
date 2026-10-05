import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import { normalizeToUTCDateOnly } from '../cleaning_plan/availability.util';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { Worker } from '../worker/worker.model';
import { IShift } from './shift.interface';
import { Shift } from './shift.model';

export const FULL_WEEKDAY_NAMES = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
];

export const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

export const MS_PER_HOUR = 3_600_000;

/**
 * Credited work time for one worker on one shift, in ms:
 * min(check_out - check_in, scheduled duration / assigned worker count).
 * Missing check-in/out (or an inverted pair) counts as 0. Single source of
 * truth for both pay settlement and the worker work-hours stats.
 */
export const calcWorkedMs = (
    entry: { check_in_at?: Date | null; check_out_at?: Date | null },
    durationMinutes: number,
    assignedWorkerCount: number
) => {
    if (!entry.check_in_at || !entry.check_out_at) return 0;
    const actualMs = entry.check_out_at.getTime() - entry.check_in_at.getTime();
    if (actualMs <= 0) return 0;
    const shareMs = (durationMinutes * 60_000) / Math.max(assignedWorkerCount, 1);
    return Math.min(actualMs, shareMs);
};

// end_time is required now, but shifts from before the field existed have none — fall back to date_time + duration.
export const resolveShiftEndTime = (shift: {
    date_time: Date;
    end_time?: Date | null;
    duration_minutes: number;
}): Date => shift.end_time ?? new Date(shift.date_time.getTime() + shift.duration_minutes * 60_000);

/** Current names for a set of workers, in one query. Missing/deleted workers are simply absent from the map. */
export const getWorkerNameMap = async (
    workerIds: Array<Types.ObjectId | string>
): Promise<Map<string, string>> => {
    const uniqueIds = [...new Set(workerIds.map((id) => id.toString()))];
    if (!uniqueIds.length) return new Map();
    const workers = await Worker.find({ _id: { $in: uniqueIds } })
        .select('name')
        .lean();
    return new Map(workers.map((w) => [w._id.toString(), w.name]));
};

type WithAssignedWorkers = { assigned_workers: Array<{ worker: Types.ObjectId }> };
type WithWorkerNames<T extends WithAssignedWorkers> = Omit<T, 'assigned_workers'> & {
    assigned_workers: Array<T['assigned_workers'][number] & { name: string }>;
};

/**
 * Shifts store only the worker ref — the name lives on Worker so a rename is
 * reflected everywhere. Display paths call this to resolve each crew entry's
 * current name (batched: one Worker query for all the shifts passed in).
 */
export const attachWorkerNames = async <T extends WithAssignedWorkers>(
    shifts: T[]
): Promise<WithWorkerNames<T>[]> => {
    const nameById = await getWorkerNameMap(
        shifts.flatMap((s) => s.assigned_workers.map((aw) => aw.worker))
    );
    return shifts.map((shift) => ({
        ...shift,
        assigned_workers: shift.assigned_workers.map((aw) => ({
            ...aw,
            name: nameById.get(aw.worker.toString()) ?? '',
        })),
    }));
};

// .lean() — every caller only reads plan fields (location, rooms, is_active,
// _id) to build a snapshot or check state; none of them save this doc back.
export const ensureActivePlan = async (planId: string | Types.ObjectId) => {
    const plan = await CleaningPlan.findById(planId).lean();
    if (!plan)
        throw new AppError(httpStatus.NOT_FOUND, 'Cleaning plan not found');
    return plan;
};

// A Shift only exists once a manager has staffed it — nothing auto-materializes it.
export const getShiftOrThrow = async (
    planId: string | Types.ObjectId,
    date: Date
): Promise<IShift & { _id: Types.ObjectId }> => {
    const day = normalizeToUTCDateOnly(date);
    const shift = await Shift.findOne({ cleaning_plan: planId, date: day });
    if (!shift) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            'No shift has been scheduled for this date yet'
        );
    }
    return shift;
};

/** Auto-advances status to 'completed' once every task is done — never re-triggers or revives a cancelled shift. */
export const maybeAutoCompleteShift = async (shiftId: Types.ObjectId) => {
    const shift = await Shift.findById(shiftId)
        .select('tasks status cleaning_plan')
        .lean();
    if (!shift || !shift.tasks.length) return;
    const allTasksCompleted = shift.tasks.every((t) => t.is_completed);
    if (!allTasksCompleted) return;

    const updateResult = await Shift.updateOne(
        { _id: shiftId, status: { $in: ['upcoming', 'in_progress'] } },
        { $set: { status: 'completed' } }
    );

    // Only the call that actually flips the status fires the event.
    if (updateResult.modifiedCount > 0) {
        const plan = await CleaningPlan.findById(shift.cleaning_plan)
            .select('client')
            .lean();
        if (plan) {
            emitAppEvent('shift.completed', {
                shiftId: shiftId.toString(),
                planId: shift.cleaning_plan.toString(),
                clientId: plan.client.toString(),
            });
        }
    }
};
