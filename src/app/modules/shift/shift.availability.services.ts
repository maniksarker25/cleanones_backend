import { Types } from 'mongoose';
import { timeWindowsOverlap } from '../cleaning_plan/availability.util';
import { ConflictReason, IWorkerConflict } from './shift.interface';
import { Shift } from './shift.model';

/**
 * Single-date conflict check for staffing one shift occurrence: does this
 * worker already have another staffed (materialized) shift on the same date
 * whose time window overlaps? A CleaningPlan carries no schedule of its own
 * (see cleaning_plan.interface.ts), so nothing has a time to conflict with
 * until it's actually staffed — only real Shift documents are ever checked.
 */
export const findWorkerConflictOnDate = async (
    workerId: Types.ObjectId | string,
    date: Date,
    dateTime: Date,
    durationMinutes: number,
    exclude: {
        shiftId?: Types.ObjectId | string;
    }
): Promise<IWorkerConflict | null> => {
    const otherShifts = await Shift.find({
        date,
        'assigned_workers.worker': workerId,
        status: { $ne: 'cancelled' },
        ...(exclude.shiftId && { _id: { $ne: exclude.shiftId } }),
    })
        .select('date_time duration_minutes cleaning_plan')
        .lean();

    for (const shift of otherShifts) {
        if (
            timeWindowsOverlap(
                dateTime,
                durationMinutes,
                shift.date_time,
                shift.duration_minutes
            )
        ) {
            const reason: ConflictReason = 'double_booked';
            return { conflicting_plan_id: shift.cleaning_plan, reason };
        }
    }

    return null;
};
