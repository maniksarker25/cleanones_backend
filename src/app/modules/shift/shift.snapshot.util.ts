import { Types } from 'mongoose';
import { AdditionalTask } from '../additional_task/additional_task.model';
import {
    normalizeToUTCDateOnly,
    RecurrencePattern,
    taskToPattern,
} from '../cleaning_plan/availability.util';
import { Location } from '../location/location.model';
import { Room } from '../room/room.model';
import { Task } from '../task/task.model';
import {
    IShiftAssignedWorker,
    IShiftLocation,
    IShiftRoom,
    IShiftTask,
} from './shift.interface';

interface PlanLike {
    location: Types.ObjectId | string;
    rooms: (Types.ObjectId | string)[];
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

/** Fisher-Yates pick of `n` random, distinct items from `pool` (n is clamped to pool.length). */
export const pickRandom = <T>(pool: T[], n: number): T[] => {
    const count = Math.max(0, Math.min(n, pool.length));
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
};

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
    const [location, rooms, tasks] = await Promise.all([
        Location.findById(plan.location).select('name location').lean(),
        Room.find({ _id: { $in: plan.rooms } })
            .select('name room_type')
            .lean(),
        Task.find({ room: { $in: plan.rooms }, is_active: true })
            .select(
                'room name frequency_type days_of_week days_of_month duration_minutes is_photo_required photo_requirements required_photo_count createdAt'
            )
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
        // Randomly require `required_photo_count` titles out of the full
        // photo_requirements pool for this occurrence.
        const selected = t.is_photo_required
            ? pickRandom(t.photo_requirements ?? [], t.required_photo_count ?? 0)
            : [];
        const photoRequirements = selected.map((pr) => ({
            title: pr.title,
            description: pr.description ?? null,
            reference_image_url: pr.reference_image_url ?? null,
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
            // Never auto-completed on creation, even for tasks with no photo
            // requirement — those are completed by the worker explicitly
            // hitting the mark-complete endpoint (see markShiftTaskComplete).
            is_completed: false,
            completed_at: null,
            source: 'plan_task' as const,
        };
    });

    // A CleaningPlan carries no crew of its own — a freshly-built snapshot
    // always starts unstaffed. Workers are staffed directly onto the Shift
    // afterward, at the manager's own staffing action (assignWorkersToShift).
    const assignedWorkers: IShiftAssignedWorker[] = [];

    const durationMinutes = tasks.reduce(
        (sum, t) => sum + (t.duration_minutes || 0),
        0
    );

    // Anchored per-task on its own createdAt (not a plan-level date) — a task
    // added to an existing plan is never "due" before it existed. No end
    // bound: a task recurs indefinitely until deactivated.
    const patterns = tasks.map((t) => taskToPattern(t, t.createdAt, null));

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

export interface AdditionalTaskShiftEntries {
    tasks: IShiftTask[];
    durationMinutes: number;
}

export const toShiftTaskFromAdditionalTask = (additionalTask: {
    _id: Types.ObjectId;
    name: string;
    duration_minutes: number;
    is_photo_required: boolean;
    photo_requirements: {
        title: string;
        description?: string | null;
        reference_image_url?: string | null;
    }[];
}): IShiftTask => ({
    task: additionalTask._id,
    // Not scoped to any one room — see IShiftTask.room.
    room: null,
    name: additionalTask.name,
    duration_minutes: additionalTask.duration_minutes ?? 0,
    is_photo_required: additionalTask.is_photo_required,
    // Unlike plan tasks (pickRandom over a pool), an AdditionalTask's
    // photo_requirements are already the exact fixed set the client
    // configured — every one of them is required, copied as-is.
    photo_requirements: (additionalTask.photo_requirements ?? []).map((pr) => ({
        title: pr.title,
        description: pr.description ?? null,
        reference_image_url: pr.reference_image_url ?? null,
        photo_url: null,
        is_uploaded: false,
    })),
    is_completed: false,
    completed_at: null,
    source: 'additional_task',
});

/**
 * Approved AdditionalTasks for `planId` whose own date_time falls on `day`
 * (a UTC calendar date), shaped as IShiftTask entries ready to fold into a
 * materializing (or previewed) shift's tasks[]. Used by getOrCreateShift,
 * buildVirtualShift, and the today-shift resync path in shift.services.ts.
 */
export const buildAdditionalTaskEntriesForDay = async (
    planId: Types.ObjectId | string,
    day: Date
): Promise<AdditionalTaskShiftEntries> => {
    const dayEnd = new Date(day);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const additionalTasks = await AdditionalTask.find({
        cleaning_plan_id: planId,
        status: 'Approved',
        date_time: { $gte: day, $lt: dayEnd },
    }).lean();

    const tasks = additionalTasks.map(toShiftTaskFromAdditionalTask);
    const durationMinutes = tasks.reduce(
        (sum, t) => sum + (t.duration_minutes || 0),
        0
    );
    return { tasks, durationMinutes };
};

/**
 * Same as buildAdditionalTaskEntriesForDay, but for every day in
 * [fromDay, toDay] in a single query — grouped by day (UTC-midnight ISO
 * string key) — for listShiftsInRange's virtual-preview loop, which would
 * otherwise need one query per previewed day.
 */
export const buildAdditionalTaskEntriesByDay = async (
    planId: Types.ObjectId | string,
    fromDay: Date,
    toDay: Date
): Promise<Map<string, AdditionalTaskShiftEntries>> => {
    const rangeEnd = new Date(toDay);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

    const additionalTasks = await AdditionalTask.find({
        cleaning_plan_id: planId,
        status: 'Approved',
        date_time: { $gte: fromDay, $lt: rangeEnd },
    }).lean();

    const byDay = new Map<string, AdditionalTaskShiftEntries>();
    for (const additionalTask of additionalTasks) {
        const dayKey = normalizeToUTCDateOnly(additionalTask.date_time).toISOString();
        const entry = byDay.get(dayKey) ?? { tasks: [], durationMinutes: 0 };
        const shiftTask = toShiftTaskFromAdditionalTask(additionalTask);
        entry.tasks.push(shiftTask);
        entry.durationMinutes += shiftTask.duration_minutes;
        byDay.set(dayKey, entry);
    }
    return byDay;
};
