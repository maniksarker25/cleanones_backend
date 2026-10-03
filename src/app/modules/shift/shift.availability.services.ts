import { Types } from 'mongoose';
import { timeWindowsOverlap } from '../cleaning_plan/availability.util';
import { ConflictReason, IWorkerConflict } from './shift.interface';
import { Shift } from './shift.model';

/** Does this worker already have another staffed shift the same date with an overlapping time window? */
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
