"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAdditionalTaskEntriesByDay = exports.buildAdditionalTaskEntriesForDay = exports.toShiftTaskFromAdditionalTask = exports.recomputeTaskCompletion = exports.roomsWithDueTasks = exports.tasksOccurringOnDate = exports.buildShiftSnapshot = exports.pickRandom = void 0;
const mongoose_1 = require("mongoose");
const additional_task_model_1 = require("../additional_task/additional_task.model");
const availability_util_1 = require("../cleaning_plan/availability.util");
const location_model_1 = require("../location/location.model");
const room_model_1 = require("../room/room.model");
const task_model_1 = require("../task/task.model");
const isTaskAutoCompleted = (isPhotoRequired, photoRequirements) => !isPhotoRequired || photoRequirements.every((p) => p.is_uploaded);
/** Fisher-Yates pick of `n` random, distinct items from `pool` (n is clamped to pool.length). */
const pickRandom = (pool, n) => {
    const count = Math.max(0, Math.min(n, pool.length));
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, count);
};
exports.pickRandom = pickRandom;
/**
 * Builds everything a Shift needs from a plan's CURRENT state in one pass —
 * a single fetch each for Rooms, the plan's own selected (active) Tasks, and
 * Workers, reused for the rooms/tasks/assigned_workers snapshots, the total
 * duration, AND the recurrence patterns (which occurrence-checking needs) —
 * rather than the duration and patterns being computed via separate
 * redundant queries. Tasks are scoped to `plan.tasks` (not "every active
 * task under `plan.rooms`"), so two plans can cover the same room with
 * different task subsets without leaking each other's tasks into shifts.
 *
 * This is the ONLY place that shapes a Shift's content, called by every read
 * (virtual preview) and write (materialization) path, so all of them stay
 * identical by construction.
 */
const buildShiftSnapshot = (plan) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const [location, rooms, tasks] = yield Promise.all([
        location_model_1.Location.findById(plan.location).select('name location').lean(),
        room_model_1.Room.find({ _id: { $in: plan.rooms } })
            .select('name room_type')
            .lean(),
        task_model_1.Task.find({ _id: { $in: plan.tasks }, is_active: true })
            .select('room name frequency_type days_of_week days_of_month duration_minutes is_photo_required photo_requirements required_photo_count createdAt')
            .lean(),
    ]);
    if (!location) {
        throw new Error(`Location ${plan.location} not found while building shift snapshot`);
    }
    const locationSnapshot = {
        location: new mongoose_1.Types.ObjectId(location._id),
        name: location.name,
        coordinates: (_a = location.location) !== null && _a !== void 0 ? _a : null,
    };
    const roomSnapshots = rooms.map((r) => ({
        room: r._id,
        name: r.name,
        room_type: r.room_type,
    }));
    const taskSnapshots = tasks.map((t) => {
        var _a, _b, _c;
        // Randomly require `required_photo_count` titles out of the full
        // photo_requirements pool for this occurrence.
        const selected = t.is_photo_required
            ? (0, exports.pickRandom)((_a = t.photo_requirements) !== null && _a !== void 0 ? _a : [], (_b = t.required_photo_count) !== null && _b !== void 0 ? _b : 0)
            : [];
        const photoRequirements = selected.map((pr) => {
            var _a, _b;
            return ({
                title: pr.title,
                description: (_a = pr.description) !== null && _a !== void 0 ? _a : null,
                reference_image_url: (_b = pr.reference_image_url) !== null && _b !== void 0 ? _b : null,
                photo_url: null,
                is_uploaded: false,
            });
        });
        return {
            task: t._id,
            room: t.room,
            name: t.name,
            duration_minutes: (_c = t.duration_minutes) !== null && _c !== void 0 ? _c : 0,
            is_photo_required: t.is_photo_required,
            photo_requirements: photoRequirements,
            // Never auto-completed on creation, even for tasks with no photo
            // requirement — those are completed by the worker explicitly
            // hitting the mark-complete endpoint (see markShiftTaskComplete).
            is_completed: false,
            completed_at: null,
            source: 'plan_task',
        };
    });
    // A CleaningPlan carries no crew of its own — a freshly-built snapshot
    // always starts unstaffed. Workers are staffed directly onto the Shift
    // afterward, at the manager's own staffing action (assignWorkersToShift).
    const assignedWorkers = [];
    const durationMinutes = tasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
    // Anchored on whichever is later: the task's own createdAt, or the
    // plan's — a task is never "due" for this plan before it existed itself,
    // NOR before the plan itself existed (a task can predate the plan when
    // its room is reused from/added to an existing plan later). No end
    // bound: a task recurs indefinitely until deactivated.
    const patterns = tasks.map((t) => (0, availability_util_1.taskToPattern)(t, (0, availability_util_1.laterOf)(t.createdAt, plan.createdAt), null));
    return {
        location: locationSnapshot,
        rooms: roomSnapshots,
        tasks: taskSnapshots,
        assignedWorkers,
        durationMinutes,
        patterns,
    };
});
exports.buildShiftSnapshot = buildShiftSnapshot;
/**
 * The subset of a snapshot's tasks actually due on `day` — each task's own
 * frequency/anchor (snapshot.patterns, built parallel to snapshot.tasks by
 * buildShiftSnapshot) is checked individually, since a plan mixes daily,
 * weekly and monthly tasks that don't all recur on the same days.
 */
const tasksOccurringOnDate = (snapshot, day) => snapshot.tasks.filter((_, i) => (0, availability_util_1.occursOnDate)(day, snapshot.patterns[i]));
exports.tasksOccurringOnDate = tasksOccurringOnDate;
/**
 * The subset of a snapshot's rooms that have at least one task among
 * `dueTasks` (the result of tasksOccurringOnDate) — a room with nothing due
 * on this date shouldn't be listed on the shift either.
 */
const roomsWithDueTasks = (rooms, dueTasks) => {
    const roomIds = new Set(dueTasks.map((t) => { var _a; return (_a = t.room) === null || _a === void 0 ? void 0 : _a.toString(); }).filter((id) => !!id));
    return rooms.filter((r) => roomIds.has(r.room.toString()));
};
exports.roomsWithDueTasks = roomsWithDueTasks;
/** Recomputes is_completed/completed_at for one task entry from its current photo state. */
const recomputeTaskCompletion = (task) => {
    const completed = isTaskAutoCompleted(task.is_photo_required, task.photo_requirements);
    if (completed === task.is_completed)
        return task;
    return Object.assign(Object.assign({}, task), { is_completed: completed, completed_at: completed ? new Date() : null });
};
exports.recomputeTaskCompletion = recomputeTaskCompletion;
const toShiftTaskFromAdditionalTask = (additionalTask) => {
    var _a, _b;
    return ({
        task: additionalTask._id,
        // Not scoped to any one room — see IShiftTask.room.
        room: null,
        name: additionalTask.name,
        duration_minutes: (_a = additionalTask.duration_minutes) !== null && _a !== void 0 ? _a : 0,
        is_photo_required: additionalTask.is_photo_required,
        // Unlike plan tasks (pickRandom over a pool), an AdditionalTask's
        // photo_requirements are already the exact fixed set the client
        // configured — every one of them is required, copied as-is.
        photo_requirements: ((_b = additionalTask.photo_requirements) !== null && _b !== void 0 ? _b : []).map((pr) => {
            var _a, _b;
            return ({
                title: pr.title,
                description: (_a = pr.description) !== null && _a !== void 0 ? _a : null,
                reference_image_url: (_b = pr.reference_image_url) !== null && _b !== void 0 ? _b : null,
                photo_url: null,
                is_uploaded: false,
            });
        }),
        is_completed: false,
        completed_at: null,
        source: 'additional_task',
    });
};
exports.toShiftTaskFromAdditionalTask = toShiftTaskFromAdditionalTask;
/**
 * Approved AdditionalTasks for `planId` whose own date_time falls on `day`
 * (a UTC calendar date), shaped as IShiftTask entries ready to fold into a
 * materializing (or previewed) shift's tasks[]. Used by getOrCreateShift,
 * buildVirtualShift, and the today-shift resync path in shift.services.ts.
 */
const buildAdditionalTaskEntriesForDay = (planId, day) => __awaiter(void 0, void 0, void 0, function* () {
    const dayEnd = new Date(day);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const additionalTasks = yield additional_task_model_1.AdditionalTask.find({
        cleaning_plan_id: planId,
        status: 'Approved',
        date_time: { $gte: day, $lt: dayEnd },
    }).lean();
    const tasks = additionalTasks.map(exports.toShiftTaskFromAdditionalTask);
    const durationMinutes = tasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
    return { tasks, durationMinutes };
});
exports.buildAdditionalTaskEntriesForDay = buildAdditionalTaskEntriesForDay;
/**
 * Same as buildAdditionalTaskEntriesForDay, but for every day in
 * [fromDay, toDay] in a single query — grouped by day (UTC-midnight ISO
 * string key) — for listShiftsInRange's virtual-preview loop, which would
 * otherwise need one query per previewed day.
 */
const buildAdditionalTaskEntriesByDay = (planId, fromDay, toDay) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const rangeEnd = new Date(toDay);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
    const additionalTasks = yield additional_task_model_1.AdditionalTask.find({
        cleaning_plan_id: planId,
        status: 'Approved',
        date_time: { $gte: fromDay, $lt: rangeEnd },
    }).lean();
    const byDay = new Map();
    for (const additionalTask of additionalTasks) {
        const dayKey = (0, availability_util_1.normalizeToUTCDateOnly)(additionalTask.date_time).toISOString();
        const entry = (_b = byDay.get(dayKey)) !== null && _b !== void 0 ? _b : { tasks: [], durationMinutes: 0 };
        const shiftTask = (0, exports.toShiftTaskFromAdditionalTask)(additionalTask);
        entry.tasks.push(shiftTask);
        entry.durationMinutes += shiftTask.duration_minutes;
        byDay.set(dayKey, entry);
    }
    return byDay;
});
exports.buildAdditionalTaskEntriesByDay = buildAdditionalTaskEntriesByDay;
