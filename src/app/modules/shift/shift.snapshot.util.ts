import { Types } from 'mongoose';
import { AdditionalTask } from '../additional_task/additional_task.model';
import {
    laterOf,
    normalizeToUTCDateOnly,
    occursOnDate,
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
    tasks: (Types.ObjectId | string)[];
    createdAt: Date;
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
 * Builds everything a Shift needs from a plan's current state in one pass —
 * the single source of truth for both preview and materialization paths.
 * Tasks are scoped to plan.tasks, not every task under plan.rooms, so two
 * plans sharing a room never leak each other's tasks.
 */
export const buildShiftSnapshot = async (plan: PlanLike): Promise<ShiftSnapshot> => {
    // Guards a legacy plan document that predates the `tasks` field.
    const taskIds = plan.tasks ?? [];
    const [location, rooms, tasks] = await Promise.all([
        Location.findById(plan.location).select('name location').lean(),
        Room.find({ _id: { $in: plan.rooms } })
            .select('name room_type')
            .lean(),
        Task.find({ _id: { $in: taskIds }, is_active: true })
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
        // Randomly picks required_photo_count titles from the full pool.
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
            // Non-photo tasks are completed explicitly via markShiftTaskComplete, not on creation.
            is_completed: false,
            completed_at: null,
            source: 'plan_task' as const,
        };
    });

    // A plan carries no crew of its own — a fresh snapshot always starts unstaffed.
    const assignedWorkers: IShiftAssignedWorker[] = [];

    const durationMinutes = tasks.reduce(
        (sum, t) => sum + (t.duration_minutes || 0),
        0
    );

    // Anchored on whichever is later — the task's own createdAt or the plan's.
    const patterns = tasks.map((t) =>
        taskToPattern(t, laterOf(t.createdAt, plan.createdAt), null)
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

/** Subset of a snapshot's tasks actually due on `day`, checked per-task since a plan mixes daily/weekly/monthly tasks. */
export const tasksOccurringOnDate = (
    snapshot: Pick<ShiftSnapshot, 'tasks' | 'patterns'>,
    day: Date
): IShiftTask[] =>
    snapshot.tasks.filter((_, i) => occursOnDate(day, snapshot.patterns[i]));

/** Rooms with at least one task among `dueTasks` — a room with nothing due shouldn't be listed either. */
export const roomsWithDueTasks = (
    rooms: IShiftRoom[],
    dueTasks: IShiftTask[]
): IShiftRoom[] => {
    const roomIds = new Set(
        dueTasks.map((t) => t.room?.toString()).filter((id): id is string => !!id)
    );
    return rooms.filter((r) => roomIds.has(r.room.toString()));
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
    duration_minutes?: number | null;
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
    // Already the exact fixed set the client configured — copied as-is, no random pick.
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

/** Approved AdditionalTasks for `planId` on `day`, shaped as IShiftTask entries ready to fold into a shift. */
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

/** Same as buildAdditionalTaskEntriesForDay, but for a whole range in one query, grouped by day. */
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
