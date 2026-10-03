import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import { normalizeToUTCDateOnly } from '../cleaning_plan/availability.util';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
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

// end_time is required now, but shifts from before the field existed have none — fall back to date_time + duration.
export const resolveShiftEndTime = (shift: {
    date_time: Date;
    end_time?: Date | null;
    duration_minutes: number;
}): Date => shift.end_time ?? new Date(shift.date_time.getTime() + shift.duration_minutes * 60_000);

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
