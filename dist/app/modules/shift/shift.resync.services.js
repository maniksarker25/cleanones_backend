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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resyncTodayShiftAdditionalTaskIfDue = exports.resyncTodayShiftLocationIfDue = exports.resyncFutureShiftTasksForRoomsIfDue = exports.cancelUpcomingShiftsAcrossPlans = exports.reconcileFutureShiftsForTaskChange = exports.resyncTodayShiftRoomsIfDue = exports.resyncTodayShiftTasksForRoomsIfDue = void 0;
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const availability_util_1 = require("../cleaning_plan/availability.util");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const location_model_1 = require("../location/location.model");
const room_model_1 = require("../room/room.model");
const task_model_1 = require("../task/task.model");
const shift_model_1 = require("./shift.model");
const shift_snapshot_util_1 = require("./shift.snapshot.util");
const shift_shared_util_1 = require("./shift.shared.util");
/**
 * Resyncs a shift's tasks[] against the plan's current active tasks.
 * Reconciles photo_requirements against the template so uploads already
 * made survive the sync, topping up or trimming the random selection to
 * match required_photo_count.
 */
const computeSyncedShiftTasks = (shift, taskIds) => __awaiter(void 0, void 0, void 0, function* () {
    const allActiveTasks = yield task_model_1.Task.find({
        _id: { $in: taskIds },
        is_active: true,
    })
        .select('room name duration_minutes is_photo_required photo_requirements required_photo_count frequency_type days_of_week days_of_month createdAt')
        .lean();
    // Only tasks actually due today belong here — a room mixes daily/weekly/monthly tasks.
    const activeTasks = allActiveTasks.filter((t) => (0, availability_util_1.occursOnDate)(shift.date, (0, availability_util_1.taskToPattern)(t, t.createdAt, null)));
    // Additional tasks aren't sourced from Task at all — carried forward unchanged.
    const planTaskEntries = shift.tasks.filter((t) => t.source !== 'additional_task');
    const additionalTaskEntries = shift.tasks.filter((t) => t.source === 'additional_task');
    const existingByTaskId = new Map(planTaskEntries.map((t) => [t.task.toString(), t]));
    let changed = activeTasks.length !== planTaskEntries.length;
    const nextTasks = activeTasks.map((t) => {
        var _a, _b, _c, _d;
        const existing = existingByTaskId.get(t._id.toString());
        const pool = (_a = t.photo_requirements) !== null && _a !== void 0 ? _a : [];
        const targetCount = t.is_photo_required
            ? Math.min((_b = t.required_photo_count) !== null && _b !== void 0 ? _b : 0, pool.length)
            : 0;
        let photoRequirements;
        if (!t.is_photo_required) {
            photoRequirements = [];
        }
        else if (!existing || !existing.is_photo_required) {
            // Brand-new task, or a task just switched to photo-required: fresh random pick.
            photoRequirements = (0, shift_snapshot_util_1.pickRandom)(pool, targetCount).map((pr) => {
                var _a, _b;
                return ({
                    title: pr.title,
                    description: (_a = pr.description) !== null && _a !== void 0 ? _a : null,
                    reference_image_url: (_b = pr.reference_image_url) !== null && _b !== void 0 ? _b : null,
                    photo_url: null,
                    is_uploaded: false,
                });
            });
        }
        else {
            const poolByTitle = new Map(pool.map((pr) => [pr.title, pr]));
            // Refresh guidance text from the template; keep this occurrence's own upload state.
            let kept = existing.photo_requirements
                .filter((p) => poolByTitle.has(p.title))
                .map((p) => {
                var _a, _b;
                const current = poolByTitle.get(p.title);
                return Object.assign(Object.assign({}, p), { description: (_a = current.description) !== null && _a !== void 0 ? _a : null, reference_image_url: (_b = current.reference_image_url) !== null && _b !== void 0 ? _b : null });
            });
            if (kept.length > targetCount) {
                const uploaded = kept.filter((p) => p.is_uploaded);
                const notUploaded = kept.filter((p) => !p.is_uploaded);
                kept =
                    uploaded.length >= targetCount
                        ? uploaded.slice(0, targetCount)
                        : [
                            ...uploaded,
                            ...notUploaded.slice(0, targetCount - uploaded.length),
                        ];
            }
            else if (kept.length < targetCount) {
                const keptTitles = new Set(kept.map((p) => p.title));
                const remainingPool = pool.filter((pr) => !keptTitles.has(pr.title));
                const additional = (0, shift_snapshot_util_1.pickRandom)(remainingPool, targetCount - kept.length).map((pr) => {
                    var _a, _b;
                    return ({
                        title: pr.title,
                        description: (_a = pr.description) !== null && _a !== void 0 ? _a : null,
                        reference_image_url: (_b = pr.reference_image_url) !== null && _b !== void 0 ? _b : null,
                        photo_url: null,
                        is_uploaded: false,
                    });
                });
                kept = [...kept, ...additional];
            }
            photoRequirements = kept;
        }
        if (!existing) {
            changed = true;
            return {
                task: t._id,
                room: t.room,
                name: t.name,
                duration_minutes: (_c = t.duration_minutes) !== null && _c !== void 0 ? _c : 0,
                is_photo_required: t.is_photo_required,
                photo_requirements: photoRequirements,
                is_completed: false,
                completed_at: null,
                source: 'plan_task',
            };
        }
        const isCompleted = t.is_photo_required
            ? photoRequirements.every((p) => p.is_uploaded)
            : existing.is_completed;
        const completedAt = isCompleted === existing.is_completed
            ? existing.completed_at
            : isCompleted
                ? new Date()
                : null;
        const updated = {
            task: t._id,
            room: t.room,
            name: t.name,
            duration_minutes: (_d = t.duration_minutes) !== null && _d !== void 0 ? _d : 0,
            is_photo_required: t.is_photo_required,
            photo_requirements: photoRequirements,
            is_completed: isCompleted,
            completed_at: completedAt,
            source: 'plan_task',
        };
        if (existing.name !== updated.name ||
            existing.duration_minutes !== updated.duration_minutes ||
            existing.is_photo_required !== updated.is_photo_required ||
            existing.is_completed !== updated.is_completed ||
            JSON.stringify(existing.photo_requirements) !==
                JSON.stringify(updated.photo_requirements)) {
            changed = true;
        }
        return updated;
    });
    const allTasks = [...nextTasks, ...additionalTaskEntries];
    const durationMinutes = allTasks.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
    return { tasks: allTasks, durationMinutes, changed };
});
/**
 * Syncs today's materialized 'upcoming' shift when a task in its rooms
 * changes — future shifts rebuild live, so only today needs this fixup.
 * Skips in_progress/completed/cancelled shifts.
 */
const resyncTodayShiftTasksForRoomsIfDue = (roomIds) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    const plans = yield cleaning_plan_model_1.CleaningPlan.find({
        rooms: { $in: roomIds },
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('rooms tasks')
        .lean();
    for (const plan of plans) {
        const shift = yield shift_model_1.Shift.findOne({
            cleaning_plan: plan._id,
            date: today,
            status: 'upcoming',
        });
        if (!shift)
            continue;
        const { tasks, durationMinutes, changed } = yield computeSyncedShiftTasks(shift, (_a = plan.tasks) !== null && _a !== void 0 ? _a : []);
        if (!changed)
            continue;
        yield shift_model_1.Shift.updateOne({ _id: shift._id, status: 'upcoming' }, { $set: { tasks, duration_minutes: durationMinutes } });
        yield (0, shift_shared_util_1.maybeAutoCompleteShift)(shift._id);
    }
});
exports.resyncTodayShiftTasksForRoomsIfDue = resyncTodayShiftTasksForRoomsIfDue;
/**
 * Same fixup as resyncTodayShiftTasksForRoomsIfDue, but also handles a
 * brand-new room added to the plan, which that one alone would miss.
 */
const resyncTodayShiftRoomsIfDue = (planId, roomIds, taskIds) => __awaiter(void 0, void 0, void 0, function* () {
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    const shift = yield shift_model_1.Shift.findOne({
        cleaning_plan: planId,
        date: today,
        status: 'upcoming',
    });
    if (!shift)
        return null;
    const rooms = yield room_model_1.Room.find({ _id: { $in: roomIds } })
        .select('name room_type')
        .lean();
    const allRooms = rooms.map((r) => ({
        room: r._id,
        name: r.name,
        room_type: r.room_type,
    }));
    const { tasks, durationMinutes } = yield computeSyncedShiftTasks(shift, taskIds);
    const nextRooms = (0, shift_snapshot_util_1.roomsWithDueTasks)(allRooms, tasks);
    yield shift_model_1.Shift.updateOne({ _id: shift._id, status: 'upcoming' }, { $set: { rooms: nextRooms, tasks, duration_minutes: durationMinutes } });
    yield (0, shift_shared_util_1.maybeAutoCompleteShift)(shift._id);
    return null;
});
exports.resyncTodayShiftRoomsIfDue = resyncTodayShiftRoomsIfDue;
/**
 * A task's schedule edit can make a future shift no longer due, but
 * materialized shifts don't recompute themselves. Unstaffed orphans get
 * deleted; staffed ones need `force` (409 otherwise) and are cancelled,
 * not deleted, with the crew/client notified. Must run before the Task
 * write so a blocked edit leaves nothing mutated.
 */
const reconcileFutureShiftsForTaskChange = (roomIds, changedTaskId, nextPattern, managerId, force) => __awaiter(void 0, void 0, void 0, function* () {
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    const plans = yield cleaning_plan_model_1.CleaningPlan.find({
        rooms: { $in: roomIds },
        tasks: changedTaskId,
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('title client rooms tasks')
        .lean();
    if (!plans.length)
        return;
    const orphansByPlan = new Map();
    for (const plan of plans) {
        const otherTasks = yield task_model_1.Task.find({
            _id: { $in: plan.tasks, $ne: changedTaskId },
            is_active: true,
        })
            .select('frequency_type days_of_week days_of_month createdAt')
            .lean();
        const newPatterns = otherTasks.map((t) => (0, availability_util_1.taskToPattern)(t, t.createdAt, null));
        if (nextPattern) {
            newPatterns.push((0, availability_util_1.taskToPattern)(nextPattern, nextPattern.createdAt, null));
        }
        const futureShifts = yield shift_model_1.Shift.find({
            cleaning_plan: plan._id,
            date: { $gt: today },
            status: 'upcoming',
        });
        const orphaned = futureShifts.filter((s) => !(0, availability_util_1.anyPatternOccursOnDate)(newPatterns, s.date));
        if (orphaned.length) {
            orphansByPlan.set(plan._id.toString(), { plan, shifts: orphaned });
        }
    }
    if (!orphansByPlan.size)
        return;
    const staffedAffected = [];
    for (const { plan, shifts } of orphansByPlan.values()) {
        for (const shift of shifts) {
            if (shift.assigned_workers.length) {
                staffedAffected.push({
                    shift_id: shift._id.toString(),
                    plan_id: plan._id.toString(),
                    plan_title: plan.title,
                    date: shift.date,
                    assigned_worker_ids: shift.assigned_workers.map((aw) => aw.worker.toString()),
                });
            }
        }
    }
    if (staffedAffected.length && !force) {
        throw new appError_1.default(http_status_1.default.CONFLICT, 'This change removes one or more already-staffed future shifts from the schedule. Pass force=true to proceed — those shifts will be cancelled and the assigned crew/client notified.', '', { affected_shifts: staffedAffected });
    }
    for (const { plan, shifts } of orphansByPlan.values()) {
        const unstaffed = shifts.filter((s) => !s.assigned_workers.length);
        const staffed = shifts.filter((s) => s.assigned_workers.length);
        if (unstaffed.length) {
            yield shift_model_1.Shift.deleteMany({ _id: { $in: unstaffed.map((s) => s._id) } });
        }
        for (const shift of staffed) {
            const cancelledWorkerIds = shift.assigned_workers.map((aw) => aw.worker.toString());
            yield shift_model_1.Shift.updateOne({ _id: shift._id, status: 'upcoming' }, { status: 'cancelled', last_updated_by: managerId });
            (0, eventEmitter_1.emitAppEvent)('shift.cancelled', {
                shiftId: shift._id.toString(),
                planId: plan._id.toString(),
                clientId: plan.client.toString(),
                title: plan.title,
                date: shift.date,
                cancelledWorkerIds,
            });
        }
    }
});
exports.reconcileFutureShiftsForTaskChange = reconcileFutureShiftsForTaskChange;
const cancelUpcomingShiftsAcrossPlans = (planIds, managerId, session) => __awaiter(void 0, void 0, void 0, function* () {
    if (!planIds.length)
        return [];
    // Only _id/assigned_workers are read below, so skip the rest of the payload.
    const shifts = yield shift_model_1.Shift.find({
        cleaning_plan: { $in: planIds },
        status: 'upcoming',
    })
        .select('assigned_workers')
        .session(session !== null && session !== void 0 ? session : null)
        .lean();
    if (!shifts.length)
        return [];
    const unstaffed = shifts.filter((s) => !s.assigned_workers.length);
    const staffed = shifts.filter((s) => s.assigned_workers.length);
    if (unstaffed.length) {
        yield shift_model_1.Shift.deleteMany({ _id: { $in: unstaffed.map((s) => s._id) } }, { session });
    }
    if (!staffed.length)
        return [];
    yield shift_model_1.Shift.updateMany({ _id: { $in: staffed.map((s) => s._id) }, status: 'upcoming' }, { status: 'cancelled', last_updated_by: managerId }, { session });
    return [
        ...new Set(staffed.flatMap((s) => s.assigned_workers.map((aw) => aw.worker.toString()))),
    ];
});
exports.cancelUpcomingShiftsAcrossPlans = cancelUpcomingShiftsAcrossPlans;
/**
 * Forward-looking counterpart to resyncTodayShiftTasksForRoomsIfDue, for
 * already-staffed future shifts. Run after reconcileFutureShiftsForTaskChange
 * and after the Task write lands.
 */
const resyncFutureShiftTasksForRoomsIfDue = (roomIds) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    const plans = yield cleaning_plan_model_1.CleaningPlan.find({
        rooms: { $in: roomIds },
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('rooms tasks')
        .lean();
    for (const plan of plans) {
        const shifts = yield shift_model_1.Shift.find({
            cleaning_plan: plan._id,
            date: { $gt: today },
            status: 'upcoming',
        });
        for (const shift of shifts) {
            const { tasks, durationMinutes, changed } = yield computeSyncedShiftTasks(shift, (_b = plan.tasks) !== null && _b !== void 0 ? _b : []);
            if (!changed)
                continue;
            yield shift_model_1.Shift.updateOne({ _id: shift._id, status: 'upcoming' }, { $set: { tasks, duration_minutes: durationMinutes } });
        }
    }
});
exports.resyncFutureShiftTasksForRoomsIfDue = resyncFutureShiftTasksForRoomsIfDue;
/**
 * Re-copies a Location's current name/coordinates into today's materialized
 * shift snapshot — otherwise an address edit wouldn't reach the geofence
 * check until the next midnight cron. Skips shifts already in progress.
 */
const resyncTodayShiftLocationIfDue = (planId) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    const shift = yield shift_model_1.Shift.findOne({
        cleaning_plan: planId,
        date: today,
        status: 'upcoming',
    });
    if (!shift)
        return;
    const plan = yield cleaning_plan_model_1.CleaningPlan.findById(planId).select('location').lean();
    if (!plan)
        return;
    const location = yield location_model_1.Location.findById(plan.location)
        .select('name location')
        .lean();
    if (!location)
        return;
    yield shift_model_1.Shift.updateOne({ _id: shift._id, status: 'upcoming' }, {
        $set: {
            'location.name': location.name,
            'location.coordinates': (_c = location.location) !== null && _c !== void 0 ? _c : null,
        },
    });
});
exports.resyncTodayShiftLocationIfDue = resyncTodayShiftLocationIfDue;
const resyncTodayShiftAdditionalTaskIfDue = (additionalTask) => __awaiter(void 0, void 0, void 0, function* () {
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(additionalTask.date_time);
    const shift = yield shift_model_1.Shift.findOne({
        cleaning_plan: additionalTask.cleaning_plan_id,
        date: day,
        status: 'upcoming',
    });
    if (!shift)
        return null;
    const alreadyIncluded = shift.tasks.some((t) => t.source === 'additional_task' &&
        t.task.toString() === additionalTask._id.toString());
    if (alreadyIncluded)
        return null;
    const shiftTask = (0, shift_snapshot_util_1.toShiftTaskFromAdditionalTask)(additionalTask);
    yield shift_model_1.Shift.updateOne({ _id: shift._id, status: 'upcoming' }, {
        $push: { tasks: shiftTask },
        $inc: { duration_minutes: shiftTask.duration_minutes },
    });
    yield (0, shift_shared_util_1.maybeAutoCompleteShift)(shift._id);
    return null;
});
exports.resyncTodayShiftAdditionalTaskIfDue = resyncTodayShiftAdditionalTaskIfDue;
