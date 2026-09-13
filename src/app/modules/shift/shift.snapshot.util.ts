import { Types } from 'mongoose';
import { RecurrencePattern, taskToPattern } from '../cleaning_plan/availability.util';
import { IAssignedWorker } from '../cleaning_plan/cleaning_plan.interface';
import { Location } from '../location/location.model';
import { Room } from '../room/room.model';
import { Task } from '../task/task.model';
import { Worker } from '../worker/worker.model';
import {
    IShiftAssignedWorker,
    IShiftLocation,
    IShiftRoom,
    IShiftTask,
} from './shift.interface';

interface PlanLike {
    location: Types.ObjectId | string;
    rooms: (Types.ObjectId | string)[];
    assigned_workers: IAssignedWorker[];
    date_time: Date;
    end_date?: Date | null;
}

export interface ShiftSnapshot {
    location: IShiftLocation;
    rooms: IShiftRoom[];
    tasks: IShiftTask[];
    assignedWorkers: IShiftAssignedWorker[];
    durationMinutes: number;
    patterns: RecurrencePattern[];
}

const isTaskAutoCompleted = (
    isPhotoRequired: boolean,
    photoRequirements: { is_uploaded: boolean }[]
): boolean =>
    !isPhotoRequired || photoRequirements.every((p) => p.is_uploaded);

/**
 * Builds everything a Shift needs from a plan's CURRENT state in one pass —
 * a single fetch each for Rooms, active Tasks, and Workers, reused for the
 * rooms/tasks/assigned_workers snapshots, the total duration, AND the
 * recurrence patterns (which occurrence-checking needs) — rather than the
 * duration and patterns being computed via separate redundant queries.
 *
 * This is the ONLY place that shapes a Shift's content, called by every read
 * (virtual preview) and write (materialization) path, so all of them stay
 * identical by construction.
 */
export const buildShiftSnapshot = async (plan: PlanLike): Promise<ShiftSnapshot> => {
    const [location, rooms, tasks, workers] = await Promise.all([
        Location.findById(plan.location).select('name location').lean(),
        Room.find({ _id: { $in: plan.rooms } })
            .select('name room_type')
            .lean(),
        Task.find({ room: { $in: plan.rooms }, is_active: true })
            .select(
                'room name frequency_type days_of_week days_of_month duration_minutes is_photo_required photo_requirements'
            )
            .lean(),
        Worker.find({ _id: { $in: plan.assigned_workers.map((aw) => aw.worker) } })
            .select('name')
            .lean(),
    ]);
    if (!location) {
        throw new Error(`Location ${plan.location} not found while building shift snapshot`);
    }

    const locationSnapshot: IShiftLocation = {
        location: new Types.ObjectId(location._id),
        name: location.name,
        coordinates: location.location ?? null,
    };

    const roomSnapshots: IShiftRoom[] = rooms.map((r) => ({
        room: r._id,
        name: r.name,
        room_type: r.room_type,
    }));

    const taskSnapshots: IShiftTask[] = tasks.map((t) => {
        const photoRequirements = (t.photo_requirements ?? []).map((pr) => ({
            title: pr.title,
            photo_url: null,
            is_uploaded: false,
        }));
        return {
            task: t._id,
            room: t.room,
            name: t.name,
            duration_minutes: t.duration_minutes ?? 0,
            is_photo_required: t.is_photo_required,
            photo_requirements: photoRequirements,
            is_completed: isTaskAutoCompleted(t.is_photo_required, photoRequirements),
            completed_at: null,
            status: 'UPCOMING' as const,
        };
    });

    const workerNameById = new Map(workers.map((w) => [w._id.toString(), w.name]));
    const assignedWorkers: IShiftAssignedWorker[] = plan.assigned_workers.map(
        (aw) => ({
            worker: aw.worker,
            name: workerNameById.get(aw.worker.toString()) ?? '',
            role: aw.role,
            assigned_with_conflict: aw.assigned_with_conflict ?? false,
        })
    );

    const durationMinutes = tasks.reduce(
        (sum, t) => sum + (t.duration_minutes || 0),
        0
    );

    const patterns = tasks.map((t) =>
        taskToPattern(t, plan.date_time, plan.end_date ?? null)
    );

    return {
        location: locationSnapshot,
        rooms: roomSnapshots,
        tasks: taskSnapshots,
        assignedWorkers,
        durationMinutes,
        patterns,
    };
};

/** Recomputes is_completed/completed_at for one task entry from its current photo state. */
export const recomputeTaskCompletion = (task: IShiftTask): IShiftTask => {
    const completed = isTaskAutoCompleted(
        task.is_photo_required,
        task.photo_requirements
    );
    if (completed === task.is_completed) return task;
    return {
        ...task,
        is_completed: completed,
        completed_at: completed ? new Date() : null,
    };
};
