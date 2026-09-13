import { Types } from 'mongoose';
import {
    computeMaxEstimatedDuration,
    loadTaskPatterns,
} from '../cleaning_plan/cleaning_plan.availability.services';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import {
    ConflictReason,
    IWorkerConflict,
} from '../cleaning_plan/cleaning_plan.interface';
import { anyPatternOccursOnDate, timeWindowsOverlap } from '../cleaning_plan/availability.util';
import { Shift } from './shift.model';

/**
 * Single-date conflict check — lighter than the plan-level one, since the
 * recurrence question is already resolved (a Shift is one concrete day).
 * Checks two sources, since either could hold the worker's other bookings
 * for this date:
 *  1. Other already-materialized Shifts for this worker on this date — the
 *     authoritative record when one exists, since it reflects any per-day
 *     override rather than the plan's default assignment.
 *  2. Other active CleaningPlans the worker is assigned to that occur on this
 *     date but have NOT yet been materialized into a Shift for it — excluded
 *     once materialized to avoid double-counting/using a stale default.
 */
export const findWorkerConflictOnDate = async (
    workerId: Types.ObjectId | string,
    date: Date,
    dateTime: Date,
    durationMinutes: number,
    exclude: {
        shiftId?: Types.ObjectId | string;
        planId?: Types.ObjectId | string;
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

    const materializedPlanIds = new Set(
        otherShifts.map((s) => s.cleaning_plan.toString())
    );
    if (exclude.planId) materializedPlanIds.add(exclude.planId.toString());

    const otherPlans = await CleaningPlan.find({
        _id: { $nin: Array.from(materializedPlanIds) },
        'assigned_workers.worker': workerId,
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('rooms date_time end_date')
        .lean();

    for (const plan of otherPlans) {
        const patterns = await loadTaskPatterns(
            plan.rooms ?? [],
            plan.date_time,
            plan.end_date ?? null
        );
        if (!anyPatternOccursOnDate(patterns, date)) continue;

        const duration = await computeMaxEstimatedDuration(plan.rooms ?? []);
        if (timeWindowsOverlap(dateTime, durationMinutes, plan.date_time, duration)) {
            const reason: ConflictReason = 'double_booked';
            return { conflicting_plan_id: plan._id, reason };
        }
    }

    return null;
};
