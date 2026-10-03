"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPhotoReviewListFromDB = exports.setPhotoVerdict = exports.checkOutFromShift = exports.checkInToShift = exports.markShiftTaskComplete = exports.uploadShiftTaskPhoto = exports.updateShiftStatus = exports.listEligibleWorkersForShift = exports.assignWorkersToShift = exports.getManagerPlanRosterFromDB = exports.getPlanGroupedRosterFromDB = exports.getShiftRosterFromDB = exports.getRosterDateRange = exports.getWorkerAttendanceSummaryFromDB = exports.getWorkersAttendanceListFromDB = exports.getWorkersAttendanceSummaryFromDB = exports.getWorkerPerformanceFromDB = exports.getSingleLiveShiftFromDB = exports.getTodayLiveShiftsFromDB = exports.getManagerReportFromDB = exports.REPORT_PERIODS = exports.getTodayLiveShiftMetaFromDB = exports.getNextShiftForWorker = exports.getWorkerTodayMetaFromDB = exports.getActiveShiftForWorker = exports.getClientLiveShiftsFromDB = exports.listWorkerShiftsForDate = exports.bulkAssignWorkerToShifts = exports.previewBulkAssignForWorker = exports.MAX_BULK_ASSIGN_RANGE_DAYS = exports.listShiftsInRange = exports.getShiftForDate = exports.resyncTodayShiftAdditionalTaskIfDue = exports.resyncTodayShiftLocationIfDue = exports.resyncFutureShiftTasksForRoomsIfDue = exports.cancelUpcomingShiftsAcrossPlans = exports.reconcileFutureShiftsForTaskChange = exports.resyncTodayShiftRoomsIfDue = exports.resyncTodayShiftTasksForRoomsIfDue = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importStar(require("mongoose"));
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const logger_1 = require("../../shared/logger");
const availability_util_1 = require("../cleaning_plan/availability.util");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const client_model_1 = require("../client/client.model");
const location_model_1 = require("../location/location.model");
const room_model_1 = require("../room/room.model");
const task_model_1 = require("../task/task.model");
const worker_eligibility_util_1 = require("../worker/worker.eligibility.util");
const worker_model_1 = require("../worker/worker.model");
const issue_report_model_1 = require("../issue_report/issue_report.model");
const chat_services_1 = __importDefault(require("../chat/chat.services"));
const geo_util_1 = require("./geo.util");
const shift_availability_services_1 = require("./shift.availability.services");
const photo_ai_config_1 = require("../photo_ai/photo_ai.config");
const photo_ai_service_1 = require("../photo_ai/photo_ai.service");
const shift_model_1 = require("./shift.model");
const shift_snapshot_util_1 = require("./shift.snapshot.util");
const MONGO_DUPLICATE_KEY_ERROR = 11000;
const isDuplicateKeyError = (error) => !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === MONGO_DUPLICATE_KEY_ERROR;
/**
 * `end_time` is a required field going forward (set by the manager at
 * staffing time — see assignWorkersToShift), but Shift documents
 * materialized before it existed on the schema have none stored. Falls back
 * to date_time + duration_minutes for those so every response still carries
 * a real end_time instead of silently omitting the field.
 */
const resolveShiftEndTime = (shift) => { var _a; return (_a = shift.end_time) !== null && _a !== void 0 ? _a : new Date(shift.date_time.getTime() + shift.duration_minutes * 60000); };
// .lean() — every caller only reads plan fields (location, rooms, is_active,
// _id) to build a snapshot or check state; none of them save this doc back.
const ensureActivePlan = (planId) => __awaiter(void 0, void 0, void 0, function* () {
    const plan = yield cleaning_plan_model_1.CleaningPlan.findById(planId).lean();
    if (!plan)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Cleaning plan not found');
    return plan;
});
/**
 * Loads an already-staffed Shift or throws 404. A Shift only ever exists
 * once a manager has staffed it (see assignWorkersToShift) — there is no
 * more auto-materialization from a plan default, since a CleaningPlan
 * carries no schedule/crew of its own to materialize from.
 */
const getShiftOrThrow = (planId, date) => __awaiter(void 0, void 0, void 0, function* () {
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const shift = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day });
    if (!shift) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'No shift has been scheduled for this date yet');
    }
    return shift;
});
/**
 * Recomputes a shift's `tasks[]` from the plan's current active, selected
 * `taskIds` — additions, removals, AND edits (name/duration_minutes/
 * is_photo_required/photo_requirements) to a task that still exists.
 * Shared by both resync entry points below (one triggered by a Task edit,
 * the other by a plan's room-list edit), so the merge rules can't drift
 * between them.
 *
 * For a task that still exists, `photo_requirements` (the randomly-selected
 * subset actually attached to this shift) is reconciled against the
 * template's current pool/`required_photo_count` rather than blindly
 * re-copied: a previously-selected title still present in the pool keeps its
 * `photo_url`/`is_uploaded` (edits never erase upload progress); if the
 * selected count now falls short of `required_photo_count` (pool grew, count
 * increased, or a selected title was removed from the pool), more titles are
 * randomly drawn from the remaining pool to top back up to the target count;
 * if the selected count now exceeds the target (count decreased), the excess
 * is trimmed, preferring to drop not-yet-uploaded titles first. `is_completed`
 * is then recomputed the normal way for a photo-required task (true once
 * every selected requirement is uploaded); for a no-photo task it's left
 * exactly as-is, since that one is only ever changed by the worker's explicit
 * mark-complete action, never by a plan edit.
 */
const computeSyncedShiftTasks = (shift, taskIds) => __awaiter(void 0, void 0, void 0, function* () {
    const allActiveTasks = yield task_model_1.Task.find({
        _id: { $in: taskIds },
        is_active: true,
    })
        .select('room name duration_minutes is_photo_required photo_requirements required_photo_count frequency_type days_of_week days_of_month createdAt')
        .lean();
    // Same per-task recurrence check as tasksOccurringOnDate: a room mixes
    // daily/weekly/monthly tasks, so only the ones actually due on this
    // shift's own date belong in its tasks[] — not every active task in the room.
    const activeTasks = allActiveTasks.filter((t) => (0, availability_util_1.occursOnDate)(shift.date, (0, availability_util_1.taskToPattern)(t, t.createdAt, null)));
    // Additional tasks folded into this shift (see buildAdditionalTaskEntriesForDay)
    // aren't sourced from the Task collection at all, so this room/task sync
    // must never touch them — they're carried forward unchanged below.
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
            // Refreshes description/reference_image_url from the current
            // template on every sync (pure guidance, not upload state) while
            // preserving this occurrence's own photo_url/is_uploaded.
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
 * If today's shift for a plan touching these rooms is already materialized
 * AND still 'upcoming', syncs its `tasks[]` to match the rooms' current
 * active Tasks. Called after a Task is created, updated, or (soft-)deleted,
 * so any edit on a room is reflected in today's shift the same way it
 * already is for future/virtual occurrences (those are built live from the
 * plan's current state every time, so they need no fixup at all).
 *
 * Deliberately skipped for 'in_progress'/'completed'/'cancelled' shifts —
 * work already underway or finished must never be retroactively altered by
 * a plan/task edit made afterward.
 */
const resyncTodayShiftTasksForRoomsIfDue = (roomIds) => __awaiter(void 0, void 0, void 0, function* () {
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
        const { tasks, durationMinutes, changed } = yield computeSyncedShiftTasks(shift, plan.tasks);
        if (!changed)
            continue;
        yield shift_model_1.Shift.updateOne({ _id: shift._id, status: 'upcoming' }, { $set: { tasks, duration_minutes: durationMinutes } });
        yield maybeAutoCompleteShift(shift._id);
    }
});
exports.resyncTodayShiftTasksForRoomsIfDue = resyncTodayShiftTasksForRoomsIfDue;
/**
 * If today's shift for this plan is already materialized AND still
 * 'upcoming', syncs its `rooms[]` AND `tasks[]` to match the plan's current
 * room list. Covers the gap resyncTodayShiftTasksForRoomsIfDue can't: that
 * one only fires for a room already in the plan's rooms array, so assigning
 * a brand-new room (with its own tasks) onto the plan via a plan update
 * never touched an already-materialized today's shift — it would keep
 * showing whatever rooms/tasks existed at materialization time until the
 * next midnight cron. Called from cleaning_plan.services.ts whenever a
 * plan's `rooms` and/or `tasks` array changes.
 *
 * Deliberately skipped for 'in_progress'/'completed'/'cancelled' shifts,
 * same reasoning as resyncTodayShiftTasksForRoomsIfDue.
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
    yield maybeAutoCompleteShift(shift._id);
    return null;
});
exports.resyncTodayShiftRoomsIfDue = resyncTodayShiftRoomsIfDue;
/**
 * A Task's frequency_type/days_of_week/days_of_month edit (or its deletion/
 * deactivation) changes which future dates the plan is actually "due" on
 * (see occursOnDate) — but any already-materialized 'upcoming' Shift dated
 * after today was snapshotted at staffing time and does NOT recompute
 * itself. Left alone, it would keep showing on the roster (with its crew)
 * even after the date it's on no longer matches the new pattern.
 *
 * Reconciles that gap for every plan that actually has `changedTaskId`
 * selected (not merely every plan touching the task's room — a plan that
 * never selected this task is unaffected by its change), comparing each of
 * their future 'upcoming' Shifts against the plan's pattern AS IT WILL BE
 * after this edit (every other active task's real pattern, plus
 * `nextPattern` for the task being changed):
 *  - still due → left alone (see resyncFutureShiftTasksForRoomsIfDue for
 *    keeping its tasks[] content in sync).
 *  - no longer due, nobody staffed → deleted outright; nobody is affected.
 *  - no longer due, staffed → a worker was told to show up and the client
 *    may already know, so it's never silently discarded. Blocked behind
 *    `force` (409, same convention as assignWorkersToShift's conflict
 *    gate) until the caller confirms, then CANCELLED (not deleted, so the
 *    record survives as history) with the crew and client notified.
 *
 * Must be called BEFORE the Task write itself (from task.services.ts), so a
 * blocked change (409, no `force`) leaves nothing mutated at all — Shifts
 * included.
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
    // Only _id/assigned_workers are ever read below — .lean() skips Mongoose
    // hydration and .select() skips pulling each shift's full tasks/rooms
    // payload over the wire just to inspect its crew.
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
 * Keeps every already-materialized future ('upcoming', dated after today)
 * Shift's tasks[]/duration_minutes in sync with the rooms' current active
 * Tasks — the forward-looking counterpart to
 * resyncTodayShiftTasksForRoomsIfDue, covering shifts a manager staffed
 * ahead of time. Call AFTER reconcileFutureShiftsForTaskChange (so orphaned
 * shifts are already gone/cancelled and don't get needlessly resynced here)
 * and after the Task write itself has landed (so this reads the new task
 * state, not the pre-edit one).
 */
const resyncFutureShiftTasksForRoomsIfDue = (roomIds) => __awaiter(void 0, void 0, void 0, function* () {
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
            const { tasks, durationMinutes, changed } = yield computeSyncedShiftTasks(shift, plan.tasks);
            if (!changed)
                continue;
            yield shift_model_1.Shift.updateOne({ _id: shift._id, status: 'upcoming' }, { $set: { tasks, duration_minutes: durationMinutes } });
        }
    }
});
exports.resyncFutureShiftTasksForRoomsIfDue = resyncFutureShiftTasksForRoomsIfDue;
/**
 * If today's shift for this plan is already materialized AND still
 * 'upcoming', re-copies the plan's current Location (name + coordinates)
 * into the shift's frozen `location` snapshot. Without this, a manager
 * editing a Location's address/GPS point from the dashboard would leave
 * today's already-materialized shift silently pointing at stale
 * coordinates — including the ones the 50m check-in geofence validates
 * against (see assertWithinGeofence) — until the next midnight cron
 * re-materializes it fresh. Called from location.services.ts whenever a
 * Location's coordinates or name change.
 *
 * Deliberately skipped for 'in_progress'/'completed'/'cancelled' shifts,
 * same reasoning as the other resync entry points: a worker already
 * checked in against the old point must not have the ground shift under
 * their feet mid-shift.
 */
const resyncTodayShiftLocationIfDue = (planId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
            'location.coordinates': (_a = location.location) !== null && _a !== void 0 ? _a : null,
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
    yield maybeAutoCompleteShift(shift._id);
    return null;
});
exports.resyncTodayShiftAdditionalTaskIfDue = resyncTodayShiftAdditionalTaskIfDue;
const getShiftForDate = (planId, date, requestingWorkerId) => __awaiter(void 0, void 0, void 0, function* () {
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const existing = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day }).lean();
    let result;
    if (existing) {
        result = Object.assign(Object.assign({}, existing), { end_time: resolveShiftEndTime(existing), is_virtual: false });
    }
    else {
        const plan = yield ensureActivePlan(planId);
        const snapshot = yield (0, shift_snapshot_util_1.buildShiftSnapshot)(plan);
        const dueTasks = (0, shift_snapshot_util_1.tasksOccurringOnDate)(snapshot, day);
        result = dueTasks.length
            ? {
                cleaning_plan: plan._id,
                date: day,
                location: snapshot.location,
                rooms: (0, shift_snapshot_util_1.roomsWithDueTasks)(snapshot.rooms, dueTasks),
                tasks: dueTasks,
                duration_minutes: dueTasks.reduce((sum, t) => sum + t.duration_minutes, 0),
                assigned_workers: [],
                status: 'unstaffed',
                is_virtual: true,
            }
            : null;
    }
    if (result &&
        requestingWorkerId &&
        !result.assigned_workers.some((aw) => aw.worker.toString() === requestingWorkerId)) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'You are not assigned to this shift');
    }
    return result;
});
exports.getShiftForDate = getShiftForDate;
/**
 * Lists every occurrence of the plan between [from, to]: the materialized
 * (staffed) Shift where one exists, otherwise an unstaffed placeholder for
 * any date the plan's current tasks are actually due on. Dates the plan
 * doesn't occur on at all are omitted entirely.
 */
const listShiftsInRange = (planId, from, to) => __awaiter(void 0, void 0, void 0, function* () {
    const plan = yield ensureActivePlan(planId);
    const fromDay = (0, availability_util_1.normalizeToUTCDateOnly)(from);
    const toDay = (0, availability_util_1.normalizeToUTCDateOnly)(to);
    if (toDay < fromDay) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, '`to` must not be before `from`');
    }
    const snapshot = yield (0, shift_snapshot_util_1.buildShiftSnapshot)(plan);
    const existingShifts = yield shift_model_1.Shift.find({
        cleaning_plan: planId,
        date: { $gte: fromDay, $lte: toDay },
    }).lean();
    const existingByDate = new Map(existingShifts.map((s) => [s.date.toISOString(), s]));
    const results = [];
    for (let cursor = new Date(fromDay); cursor <= toDay; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const day = new Date(cursor);
        const existing = existingByDate.get(day.toISOString());
        if (existing) {
            results.push(Object.assign(Object.assign({}, existing), { end_time: resolveShiftEndTime(existing), is_virtual: false }));
            continue;
        }
        const dueTasks = (0, shift_snapshot_util_1.tasksOccurringOnDate)(snapshot, day);
        if (!dueTasks.length)
            continue;
        results.push({
            cleaning_plan: plan._id,
            date: day,
            location: snapshot.location,
            rooms: (0, shift_snapshot_util_1.roomsWithDueTasks)(snapshot.rooms, dueTasks),
            tasks: dueTasks,
            duration_minutes: dueTasks.reduce((sum, t) => sum + t.duration_minutes, 0),
            assigned_workers: [],
            status: 'unstaffed',
            is_virtual: true,
        });
    }
    return results;
});
exports.listShiftsInRange = listShiftsInRange;
/** Hard ceiling on how far ahead a bulk-assign preview/confirm can span, so
 * neither the preview's day-by-day walk nor the confirm loop's per-date
 * writes can be driven by an unbounded request. The client's own examples
 * (next week/next month) never approach it. */
exports.MAX_BULK_ASSIGN_RANGE_DAYS = 60;
/** A due date nobody is actively covering: never staffed (virtual), staffed
 * but cancelled (see reconcileFutureShiftsForTaskChange), or — defensively —
 * a real shift with an empty crew. Shared by the preview and confirm sides
 * of bulk-assign so "still needs a worker" means the same thing in both. */
const isUnstaffedGap = (entry) => entry.is_virtual || entry.status === 'cancelled' || entry.assigned_workers.length === 0;
/**
 * Read-only preview for the bulk roster-assignment flow: of every date in
 * [from, to] this plan is actually due on, splits the still-unstaffed ones
 * into what this worker's own declared working_days does/doesn't cover, so
 * the manager can review before anything is written (see
 * bulkAssignWorkerToShifts for the write side, which takes exactly the
 * dates the manager confirms from here).
 */
const previewBulkAssignForWorker = (planId, workerId, from, to) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const fromDay = (0, availability_util_1.normalizeToUTCDateOnly)(from);
    const toDay = (0, availability_util_1.normalizeToUTCDateOnly)(to);
    if (toDay < fromDay) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, '`to` must not be before `from`');
    }
    const rangeDays = Math.round((toDay.getTime() - fromDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (rangeDays > exports.MAX_BULK_ASSIGN_RANGE_DAYS) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Range too large — please select ${exports.MAX_BULK_ASSIGN_RANGE_DAYS} days or fewer`);
    }
    if (!mongoose_1.default.isValidObjectId(workerId)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid worker ID');
    }
    // Throws with a precise reason (not found/deleted/blocked) before we
    // bother walking the plan's occurrences at all.
    yield (0, worker_eligibility_util_1.assertWorkersEligible)([workerId]);
    const worker = yield worker_model_1.Worker.findById(workerId).select('name working_days').lean();
    if (!worker) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker not found');
    }
    const workingDays = new Set((_b = worker.working_days) !== null && _b !== void 0 ? _b : []);
    const shiftEntries = (yield (0, exports.listShiftsInRange)(planId, fromDay, toDay));
    const matching_dates = [];
    const other_gap_dates = [];
    let already_covered_count = 0;
    for (const entry of shiftEntries) {
        if (!isUnstaffedGap(entry)) {
            already_covered_count += 1;
            continue;
        }
        const weekday = FULL_WEEKDAY_NAMES[entry.date.getUTCDay()];
        const bucket = workingDays.has(weekday) ? matching_dates : other_gap_dates;
        bucket.push({ date: entry.date, weekday });
    }
    return {
        worker_id: workerId,
        worker_name: worker.name,
        range: { from: fromDay, to: toDay },
        matching_dates,
        other_gap_dates,
        already_covered_count,
    };
});
exports.previewBulkAssignForWorker = previewBulkAssignForWorker;
/**
 * Write side of bulk-assign: stages the same worker onto every date in
 * `dates` that's still an unstaffed gap (never touches one that already has
 * an active crew, so it's safe to re-run with a different worker to cover
 * whatever's left). Prefetches existing Shifts for the whole batch in one
 * query rather than one lookup per date, then delegates the actual staffing
 * of each remaining date to assignWorkersToShift unchanged — so eligibility
 * checks and the shift.worker_assigned notification/chat-group sync all
 * behave exactly as they do for a single manual assignment.
 *
 * Best-effort per date, not all-or-nothing. In particular, a scheduling
 * conflict (this worker double-booked elsewhere that day) is NOT a blocking
 * error here the way it is for a single manual assign — for a bulk action
 * the useful default is "staff whoever's actually free, quietly skip the
 * rest": with `force` left false/omitted, a conflicted date is simply
 * skipped and reported in `ignored_due_to_conflict`, no follow-up call
 * required. Passing `force: true` flips that for the whole batch — every
 * conflicted date gets assigned anyway (flagged `assigned_with_conflict` on
 * the shift, same as the single-date flow) instead of being skipped.
 */
const bulkAssignWorkerToShifts = (managerId, planId, workerId, role, dates, startTime, endTime, force) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(endTime > startTime)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'end_time must be after start_time');
    }
    if (dates.length > exports.MAX_BULK_ASSIGN_RANGE_DAYS) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Too many dates — please select ${exports.MAX_BULK_ASSIGN_RANGE_DAYS} or fewer`);
    }
    if (!mongoose_1.default.isValidObjectId(workerId)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid worker ID');
    }
    const normalizedDates = dates.map((d) => (0, availability_util_1.normalizeToUTCDateOnly)(d));
    const existingShifts = yield shift_model_1.Shift.find({
        cleaning_plan: planId,
        date: { $in: normalizedDates },
    })
        .select('date status assigned_workers')
        .lean();
    const coveredDateKeys = new Set(existingShifts.filter((s) => !isUnstaffedGap(Object.assign(Object.assign({}, s), { is_virtual: false }))).map((s) => s.date.toISOString()));
    const outcome = {
        assigned: [],
        skipped_already_staffed: [],
        ignored_due_to_conflict: [],
        failed: [],
    };
    for (const date of normalizedDates) {
        const dateKey = date.toISOString();
        const dateLabel = dateKey.slice(0, 10);
        if (coveredDateKeys.has(dateKey)) {
            outcome.skipped_already_staffed.push(dateLabel);
            continue;
        }
        try {
            yield (0, exports.assignWorkersToShift)(managerId, planId, date, [{ worker: new mongoose_1.Types.ObjectId(workerId), role }], (0, availability_util_1.combineDateWithTimeOfDay)(date, startTime), (0, availability_util_1.combineDateWithTimeOfDay)(date, endTime), force);
            outcome.assigned.push(dateLabel);
        }
        catch (error) {
            if (error instanceof appError_1.default && error.statusCode === http_status_1.default.CONFLICT) {
                outcome.ignored_due_to_conflict.push({ date: dateLabel, reason: error.message });
            }
            else if (error instanceof appError_1.default) {
                outcome.failed.push({ date: dateLabel, message: error.message });
            }
            else {
                // An unexpected (non-AppError) failure for THIS date — e.g. a
                // transient DB hiccup — must never take down the rest of an
                // otherwise-successful batch. Logged for diagnosis; the
                // caller just sees this one date as failed and can retry it
                // (retrying is always safe — this loop never double-assigns
                // an already-covered date).
                logger_1.errorLogger.error(`bulkAssignWorkerToShifts: unexpected error assigning ${planId}/${dateLabel}`, error);
                outcome.failed.push({
                    date: dateLabel,
                    message: 'Unexpected error while assigning this date — please retry.',
                });
            }
        }
    }
    return Object.assign(Object.assign({}, outcome), { counts: {
            assigned: outcome.assigned.length,
            skipped_already_staffed: outcome.skipped_already_staffed.length,
            ignored_due_to_conflict: outcome.ignored_due_to_conflict.length,
            failed: outcome.failed.length,
        } });
});
exports.bulkAssignWorkerToShifts = bulkAssignWorkerToShifts;
/**
 * A worker only ever appears on a real, staffed Shift (see
 * assignWorkersToShift) — there is no plan-level default roster to preview,
 * so this is a plain query, not a merge with a virtual projection.
 *
 * Excludes cancelled shifts — a shift a manager (or a task recurrence
 * change, see reconcileFutureShiftsForTaskChange) cancelled is no longer
 * something the worker needs to show up for, so it shouldn't appear on
 * their "my shifts" list at all. Feeds both GET /shift/my-shifts and
 * getWorkerTodayMetaFromDB, so this also keeps today's pending/completed
 * counts from ever counting a cancelled shift.
 */
const listWorkerShiftsForDate = (workerId, date) => __awaiter(void 0, void 0, void 0, function* () {
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const shifts = yield shift_model_1.Shift.find({
        date: day,
        'assigned_workers.worker': workerId,
        status: { $ne: 'cancelled' },
    })
        .sort({ date_time: 1 })
        .lean();
    return shifts.map((shift) => (Object.assign(Object.assign({}, shift), { end_time: resolveShiftEndTime(shift), is_virtual: false })));
});
exports.listWorkerShiftsForDate = listWorkerShiftsForDate;
/**
 * Per-room progress = completed tasks in that room / total tasks in that
 * room. Overall shift progress = average of the rooms' progress (not a raw
 * task count across the whole shift), so one large room doesn't drown out a
 * small one. completed_room counts rooms at 100% — useful for an "X/Y rooms"
 * style summary. Keeps `tasks` in the result; callers that don't want the
 * full per-task detail (e.g. the client live-status list) strip it themselves.
 */
const attachProgress = (shift) => {
    const rooms = shift.rooms.map((room) => {
        const roomTasks = shift.tasks.filter((t) => t.room && t.room.toString() === room.room.toString());
        const completedTask = roomTasks.filter((t) => t.is_completed).length;
        const totalTask = roomTasks.length;
        return Object.assign(Object.assign({}, room), { total_task: totalTask, completed_task: completedTask, progress_percent: totalTask
                ? Math.round((completedTask / totalTask) * 100)
                : 0 });
    });
    const overallProgressPercent = rooms.length
        ? Math.round(rooms.reduce((sum, r) => sum + r.progress_percent, 0) / rooms.length)
        : 0;
    return Object.assign(Object.assign({}, shift), { end_time: resolveShiftEndTime(shift), rooms, total_room: shift.rooms.length, completed_room: rooms.filter((r) => r.progress_percent === 100).length, total_task: shift.tasks.length, overall_progress_percent: overallProgressPercent });
};
/**
 * Client-facing "what's happening right now": every in_progress shift across
 * all of this client's active cleaning plans, each with room-level and
 * overall completion progress computed live (never cached/stored). Full
 * per-task detail is intentionally omitted — this is a summary view.
 */
const getClientLiveShiftsFromDB = (clientId) => __awaiter(void 0, void 0, void 0, function* () {
    const planIds = yield cleaning_plan_model_1.CleaningPlan.find({
        client: clientId,
        is_active: true,
    }).distinct('_id');
    const shifts = yield shift_model_1.Shift.find({
        cleaning_plan: { $in: planIds },
        status: 'in_progress',
    }).lean();
    return shifts.map((shift) => {
        const _a = attachProgress(shift), { tasks } = _a, withoutTasks = __rest(_a, ["tasks"]);
        return withoutTasks;
    });
});
exports.getClientLiveShiftsFromDB = getClientLiveShiftsFromDB;
const getActiveShiftForWorker = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    const shift = yield shift_model_1.Shift.findOne({
        status: 'in_progress',
        assigned_workers: {
            $elemMatch: {
                worker: workerId,
                check_in_at: { $ne: null },
                check_out_at: null,
            },
        },
    }).lean();
    if (!shift)
        return {};
    const _d = attachProgress(shift), { tasks, rooms, assigned_workers } = _d, rest = __rest(_d, ["tasks", "rooms", "assigned_workers"]);
    const own = assigned_workers.find((aw) => aw.worker.toString() === workerId);
    return Object.assign(Object.assign({}, rest), { check_in_at: (_c = own === null || own === void 0 ? void 0 : own.check_in_at) !== null && _c !== void 0 ? _c : null });
});
exports.getActiveShiftForWorker = getActiveShiftForWorker;
const getWorkerTodayMetaFromDB = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const shifts = yield (0, exports.listWorkerShiftsForDate)(workerId, new Date());
    const total = shifts.length;
    const completed = shifts.filter((s) => s.status === 'completed').length;
    return {
        total_shift: total,
        completed,
        pending: total - completed,
    };
});
exports.getWorkerTodayMetaFromDB = getWorkerTodayMetaFromDB;
const getNextShiftForWorker = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const materialized = yield shift_model_1.Shift.findOne({
        'assigned_workers.worker': workerId,
        status: 'upcoming',
        date_time: { $gt: now },
    })
        .sort({ date_time: 1 })
        .lean();
    if (!materialized)
        return {};
    const { tasks, rooms, assigned_workers } = materialized, rest = __rest(materialized, ["tasks", "rooms", "assigned_workers"]);
    return Object.assign(Object.assign({}, rest), { end_time: resolveShiftEndTime(materialized), is_virtual: false });
});
exports.getNextShiftForWorker = getNextShiftForWorker;
/**
 * System-wide "today's shifts at a glance" for the manager dashboard — every
 * manager sees the same numbers, not scoped to who's calling. Only counts
 * already-materialized Shift documents for today — the nightly cron (plus
 * this system's same-day auto-materialization on plan create/update/assign)
 * means today's occurrences are expected to already exist by the time
 * anyone looks at this. Purely shift data — no issue-report count here (see
 * /issue-report for that).
 *
 * today_total_shift excludes cancelled shifts, same as
 * getTodayLiveShiftsFromDB (the list this meta summarizes) — so it always
 * equals today_total_completed_shift + today_total_in_progress_shift +
 * today_total_pending_shift. today_total_pending_shift maps to status
 * 'upcoming' (not yet checked into).
 *
 * total_absent counts DISTINCT workers (not shift-assignment rows) whose
 * shift's scheduled date_time has already passed but who still haven't
 * checked in at all (check_in_at is null), excluding cancelled shifts — no
 * grace period beyond the exact scheduled start time. total_late counts
 * DISTINCT workers who DID check in today, but after their shift's
 * date_time — same definition as getWorkersAttendanceSummaryFromDB's
 * late_check_ins, scoped to today. A worker who never checked in counts
 * toward total_absent but never total_late — the two are mutually exclusive.
 * absent_workers/late_workers carry the same two distinct-worker sets the
 * two counts are derived from — {worker_id, name} pairs, so a caller
 * doesn't have to re-derive "who" from "how many" via a second request.
 * `name` is read straight off the shift's own assigned_workers snapshot
 * (set at staffing time, see assignWorkersToShift) rather than a fresh
 * Worker lookup — one less query, and consistent with what the roster
 * already displays for that shift.
 */
const getTodayLiveShiftMetaFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    const now = new Date();
    const allShifts = yield shift_model_1.Shift.find({ date: today })
        .select('status date_time assigned_workers')
        .lean();
    const shifts = allShifts.filter((s) => s.status !== 'cancelled');
    const absentWorkers = new Map();
    const lateWorkers = new Map();
    shifts.forEach((shift) => {
        shift.assigned_workers.forEach((aw) => {
            const workerId = aw.worker.toString();
            if (!aw.check_in_at) {
                if (shift.date_time <= now)
                    absentWorkers.set(workerId, aw.name);
            }
            else if (aw.check_in_at > shift.date_time) {
                lateWorkers.set(workerId, aw.name);
            }
        });
    });
    const toWorkerRows = (workers) => Array.from(workers, ([worker_id, name]) => ({ worker_id, name }));
    return {
        today_total_shift: shifts.length,
        today_total_completed_shift: shifts.filter((s) => s.status === 'completed').length,
        today_total_in_progress_shift: shifts.filter((s) => s.status === 'in_progress').length,
        today_total_pending_shift: shifts.filter((s) => s.status === 'upcoming').length,
        total_absent: absentWorkers.size,
        total_late: lateWorkers.size,
        absent_workers: toWorkerRows(absentWorkers),
        late_workers: toWorkerRows(lateWorkers),
    };
});
exports.getTodayLiveShiftMetaFromDB = getTodayLiveShiftMetaFromDB;
// ─── Manager report (week/month/quarter/year) ───────────────────────────────
exports.REPORT_PERIODS = ['week', 'month', 'quarter', 'year'];
/**
 * "This week/month/quarter/year" as an inclusive [from, to] range of
 * UTC-normalized calendar days — same UTC-day convention the rest of the
 * shift system uses (see normalizeToUTCDateOnly), so a shift's `date` field
 * compares directly against these without extra conversion. Week starts
 * Monday (ISO week), matching the Mon..Sun labels on the dashboard.
 */
const getReportDateRange = (period, now) => {
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(now);
    if (period === 'week') {
        const dayOfWeek = today.getUTCDay(); // 0=Sun..6=Sat
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const from = new Date(today);
        from.setUTCDate(from.getUTCDate() + diffToMonday);
        const to = new Date(from);
        to.setUTCDate(to.getUTCDate() + 6);
        return { from, to };
    }
    if (period === 'month') {
        const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
        const to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
        return { from, to };
    }
    if (period === 'quarter') {
        const quarterStartMonth = Math.floor(today.getUTCMonth() / 3) * 3;
        const from = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth, 1));
        const to = new Date(Date.UTC(today.getUTCFullYear(), quarterStartMonth + 3, 0));
        return { from, to };
    }
    // year
    const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    const to = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
    return { from, to };
};
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_LABELS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
/**
 * Bucket granularity per period — deliberately gets finer as the range gets
 * shorter and coarser as it gets longer, so every period renders a readable
 * number of bars: week -> 1 bar/day (7 total), month -> 1 bar/day (28-31),
 * quarter -> 1 bar/week (~13), year -> 1 bar/month (12).
 */
const buildShiftTrendBuckets = (period, from, to, shiftDates) => {
    if (period === 'week') {
        return WEEKDAY_LABELS.map((label, index) => {
            const date = new Date(from);
            date.setUTCDate(date.getUTCDate() + index);
            const count = shiftDates.filter((d) => d.getTime() === date.getTime()).length;
            return { label, date: date.toISOString().slice(0, 10), total_shift: count };
        });
    }
    if (period === 'month') {
        const daysInMonth = to.getUTCDate();
        return Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), i + 1));
            const count = shiftDates.filter((d) => d.getTime() === date.getTime()).length;
            return { label: String(i + 1), date: date.toISOString().slice(0, 10), total_shift: count };
        });
    }
    if (period === 'quarter') {
        const buckets = [];
        let cursor = new Date(from);
        let weekIndex = 1;
        while (cursor <= to) {
            const bucketEnd = new Date(cursor);
            bucketEnd.setUTCDate(bucketEnd.getUTCDate() + 6);
            const cappedEnd = bucketEnd > to ? to : bucketEnd;
            const count = shiftDates.filter((d) => d >= cursor && d <= cappedEnd).length;
            buckets.push({
                label: `Week ${weekIndex}`,
                date: cursor.toISOString().slice(0, 10),
                total_shift: count,
            });
            cursor = new Date(cappedEnd);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
            weekIndex += 1;
        }
        return buckets;
    }
    // year
    return MONTH_LABELS.map((label, monthIndex) => {
        const count = shiftDates.filter((d) => d.getUTCFullYear() === from.getUTCFullYear() && d.getUTCMonth() === monthIndex).length;
        return { label, total_shift: count };
    });
};
/**
 * Manager dashboard report: total shifts + total issue reports for the
 * selected period, a shift-count trend chart bucketed per
 * buildShiftTrendBuckets, and an issue-report status breakdown (PENDING /
 * IN_PROGRESS / RESOLVED) — all scoped to the same [from, to] range, unlike
 * getTodayLiveShiftMetaFromDB's total_absent/total_late, which are
 * point-in-time, not period-scoped.
 */
const getManagerReportFromDB = (period) => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const { from, to } = getReportDateRange(period, now);
    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const [shifts, issueReports] = yield Promise.all([
        shift_model_1.Shift.find({ date: { $gte: from, $lt: toExclusive } })
            .select('date')
            .lean(),
        issue_report_model_1.IssueReport.find({ createdAt: { $gte: from, $lt: toExclusive } })
            .select('status')
            .lean(),
    ]);
    const shiftDates = shifts.map((s) => s.date);
    const issueReportStatus = {
        PENDING: issueReports.filter((r) => r.status === 'PENDING').length,
        IN_PROGRESS: issueReports.filter((r) => r.status === 'IN_PROGRESS').length,
        RESOLVED: issueReports.filter((r) => r.status === 'RESOLVED').length,
    };
    return {
        period,
        range: {
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
        },
        summary: {
            total_shift: shifts.length,
            total_issue_report: issueReports.length,
        },
        shift_trends: buildShiftTrendBuckets(period, from, to, shiftDates),
        issue_report_status: issueReportStatus,
    };
});
exports.getManagerReportFromDB = getManagerReportFromDB;
const MAX_PAGE_SIZE = 100;
const parseObjectIdQueryParam = (value, fieldName) => {
    if (value === undefined || value === null || value === '')
        return undefined;
    if (typeof value !== 'string' || !mongoose_1.default.isValidObjectId(value)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid ${fieldName}`);
    }
    return new mongoose_1.Types.ObjectId(value);
};
/**
 * Batch-resolves { cleaning_plan: {_id, title}, client: {_id, name} } for a
 * set of shifts in at most two queries total (not one per shift), keyed by
 * shift cleaning_plan id. Short-circuits on an empty input to avoid two
 * pointless round trips on an empty page/result.
 */
const attachPlanAndClient = (shifts) => __awaiter(void 0, void 0, void 0, function* () {
    if (!shifts.length)
        return [];
    const planIds = [...new Set(shifts.map((s) => s.cleaning_plan.toString()))];
    const plans = yield cleaning_plan_model_1.CleaningPlan.find({ _id: { $in: planIds } })
        .select('title client')
        .lean();
    const clientIds = [...new Set(plans.map((p) => p.client.toString()))];
    const clients = clientIds.length
        ? yield client_model_1.Client.find({ _id: { $in: clientIds } })
            .select('name')
            .lean()
        : [];
    const clientById = new Map(clients.map((c) => [c._id.toString(), c]));
    const planById = new Map(plans.map((p) => {
        var _a;
        return [
            p._id.toString(),
            {
                _id: p._id,
                title: p.title,
                client: (_a = clientById.get(p.client.toString())) !== null && _a !== void 0 ? _a : null,
            },
        ];
    }));
    return shifts.map((shift) => {
        const plan = planById.get(shift.cleaning_plan.toString());
        const { cleaning_plan } = shift, rest = __rest(shift, ["cleaning_plan"]);
        return Object.assign(Object.assign({}, rest), { cleaning_plan: plan
                ? { _id: plan._id, title: plan.title }
                : { _id: cleaning_plan, title: null }, client: (plan === null || plan === void 0 ? void 0 : plan.client)
                ? { _id: plan.client._id, name: plan.client.name }
                : null });
    });
});
// Allowlisted so a caller can't force a sort on an arbitrary/unindexed path
// (e.g. a large nested array field) and degrade this into a full in-memory
// sort under load.
const TODAY_LIVE_SHIFTS_SORTABLE_FIELDS = new Set([
    'date_time',
    'status',
    'createdAt',
    'updatedAt',
]);
// Cancelled shifts are never surfaced by getTodayLiveShiftsFromDB — 'today's
// live shifts' means what's actually happening/scheduled today, not what got
// called off. 'cancelled' is intentionally excluded so a ?status=cancelled
// query is rejected the same way any other invalid value would be, rather
// than silently overriding the base filter below.
const SHIFT_STATUSES = new Set([
    'upcoming',
    'in_progress',
    'completed',
]);
/**
 * Manager-facing list of today's shifts, system-wide (not scoped to the
 * calling manager, same as today-live-shift-meta), filterable by location
 * and client. A lean list view: room-level detail lives on the
 * single-live-shift endpoint instead — this only carries the summary totals.
 */
const getTodayLiveShiftsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    const sort = query.sort;
    const sortOrder = (sort === null || sort === void 0 ? void 0 : sort.startsWith('-')) ? -1 : 1;
    const sortField = sort ? sort.replace(/^-/, '') : 'date_time';
    if (!TODAY_LIVE_SHIFTS_SORTABLE_FIELDS.has(sortField)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid sort field. Allowed: ${[...TODAY_LIVE_SHIFTS_SORTABLE_FIELDS].join(', ')}`);
    }
    const match = { date: today, status: { $ne: 'cancelled' } };
    const locationId = parseObjectIdQueryParam(query.location, 'location');
    if (locationId) {
        match['location.location'] = locationId;
    }
    const clientId = parseObjectIdQueryParam(query.client, 'client');
    if (clientId) {
        const planIds = yield cleaning_plan_model_1.CleaningPlan.find({ client: clientId }).distinct('_id');
        // An empty $in never matches — correctly yields zero results instead
        // of accidentally falling through to "no client filter at all".
        match.cleaning_plan = { $in: planIds };
    }
    if (query.status !== undefined && query.status !== '') {
        if (!SHIFT_STATUSES.has(query.status)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid status. Allowed: ${[...SHIFT_STATUSES].join(', ')}`);
        }
        match.status = query.status;
    }
    const [shifts, total] = yield Promise.all([
        shift_model_1.Shift.find(match)
            // _id as a tiebreaker guarantees deterministic ordering across
            // pages even when many shifts share the same sortField value —
            // without it, concurrent writes can shift rows between pages or
            // repeat/skip a row under pagination.
            .sort({ [sortField]: sortOrder, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        shift_model_1.Shift.countDocuments(match),
    ]);
    const withProgress = shifts.map((shift) => {
        const _a = attachProgress(shift), { tasks, rooms, assigned_workers } = _a, rest = __rest(_a, ["tasks", "rooms", "assigned_workers"]);
        return rest;
    });
    const result = yield attachPlanAndClient(withProgress);
    return {
        meta: {
            page,
            limit,
            total,
            totalPage: Math.ceil(total / limit),
        },
        result,
    };
});
exports.getTodayLiveShiftsFromDB = getTodayLiveShiftsFromDB;
/**
 * One shift's full detail: tasks[], rooms[] (with per-room progress),
 * assigned_workers[], plus cleaning_plan/client context — the counterpart to
 * getTodayLiveShiftsFromDB's lean list view. Not date/today-restricted; any
 * materialized shift can be fetched by its own _id.
 */
const getSingleLiveShiftFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.isValidObjectId(id)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid shift ID');
    }
    const shift = yield shift_model_1.Shift.findById(id).lean();
    if (!shift) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Shift not found');
    }
    const [result] = yield attachPlanAndClient([attachProgress(shift)]);
    return result;
});
exports.getSingleLiveShiftFromDB = getSingleLiveShiftFromDB;
/**
 * Manager-facing worker performance for one calendar month (UTC), combining
 * already-materialized Shift documents (the only source of truth for
 * completed/in_progress/late/absent/worked-hours — those require real
 * check-in/check-out data) with not-yet-materialized future occurrences of
 * the worker's currently active plans (so total_shift/total_upcoming for a
 * mostly-future month aren't artificially low just because the cron hasn't
 * caught up to those days yet).
 *
 * Definitions:
 * - late: this worker's own check_in_at is after the shift's scheduled date_time (no grace period).
 * - absent: the shift's calendar date is in the past, status isn't 'cancelled',
 *   and this worker never checked in. Only ever true for materialized shifts —
 *   if a plan's occurrence was never materialized at all (e.g. the cron
 *   didn't run that day), there is no record to judge absence from.
 * - total_work: sum of (check_out_at - check_in_at) across this worker's
 *   completed check-ins this month, in hours, rounded to 2 decimals.
 */
const getWorkerPerformanceFromDB = (workerId, month, year) => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const targetYear = year !== null && year !== void 0 ? year : now.getUTCFullYear();
    const targetMonth = month !== null && month !== void 0 ? month : now.getUTCMonth() + 1; // 1-12
    if (targetMonth < 1 || targetMonth > 12) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'month must be between 1 and 12');
    }
    const monthStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const monthEnd = new Date(Date.UTC(targetYear, targetMonth, 0)); // last day of the month
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(now);
    // A worker only ever appears on a real, staffed Shift — there is no
    // plan-level default roster to project unstaffed future occurrences
    // from, so this month's total is exactly its materialized shifts.
    const materialized = yield shift_model_1.Shift.find({
        'assigned_workers.worker': workerId,
        date: { $gte: monthStart, $lte: monthEnd },
    }).lean();
    let completed = 0;
    let inProgress = 0;
    let upcomingMaterialized = 0;
    let late = 0;
    let absent = 0;
    let workedMs = 0;
    for (const shift of materialized) {
        if (shift.status === 'completed')
            completed += 1;
        if (shift.status === 'in_progress')
            inProgress += 1;
        if (shift.status === 'upcoming')
            upcomingMaterialized += 1;
        const entry = shift.assigned_workers.find((aw) => aw.worker.toString() === workerId);
        if (!entry)
            continue;
        if (entry.check_in_at && entry.check_in_at > shift.date_time) {
            late += 1;
        }
        if (shift.date < today && shift.status !== 'cancelled' && !entry.check_in_at) {
            absent += 1;
        }
        if (entry.check_in_at && entry.check_out_at) {
            workedMs += entry.check_out_at.getTime() - entry.check_in_at.getTime();
        }
    }
    const photo_quality = summarisePhotoQuality(materialized);
    return {
        month: targetMonth,
        year: targetYear,
        total_shift_on_this_month: materialized.length,
        total_completed_on_this_month: completed,
        total_in_progress: inProgress,
        total_upcoming_on_this_month: upcomingMaterialized,
        total_late_on_this_month: late,
        total_absent_on_this_month: absent,
        total_work_on_this_month: roundToTwoDecimals(workedMs / 3600000),
        photo_quality,
    };
});
exports.getWorkerPerformanceFromDB = getWorkerPerformanceFromDB;
/**
 * Photo quality for one worker's shifts.
 *
 * Counts a manager's verdict where there is one and the automatic decision
 * otherwise, but reports them separately as well: a high approval rate made
 * entirely of machine decisions means something different from one a person
 * signed off.
 */
const summarisePhotoQuality = (shifts) => {
    var _a, _b, _c;
    let total = 0;
    let approved = 0;
    let rejected = 0;
    let reviewedByManager = 0;
    let retakes = 0;
    let forcedAccepts = 0;
    for (const shift of shifts) {
        for (const task of (_a = shift.tasks) !== null && _a !== void 0 ? _a : []) {
            for (const requirement of (_b = task.photo_requirements) !== null && _b !== void 0 ? _b : []) {
                if (!requirement.is_uploaded)
                    continue;
                total += 1;
                if (requirement.attempt_count && requirement.attempt_count > 1) {
                    retakes += requirement.attempt_count - 1;
                }
                if (requirement.forced_accept)
                    forcedAccepts += 1;
                const verdict = (_c = requirement.manager_verdict) !== null && _c !== void 0 ? _c : requirement.auto_decision;
                if (requirement.manager_verdict)
                    reviewedByManager += 1;
                if (verdict === 'approved')
                    approved += 1;
                if (verdict === 'rejected')
                    rejected += 1;
            }
        }
    }
    const decided = approved + rejected;
    return {
        total_photos: total,
        approved,
        rejected,
        approval_rate: decided ? roundToTwoDecimals((approved / decided) * 100) : null,
        reviewed_by_manager: reviewedByManager,
        retakes,
        forced_accepts: forcedAccepts,
    };
};
/** [start, end) UTC bounds for the requested period, anchored on `now`. Weekly runs Monday-Sunday. */
const getAttendanceSummaryPeriodRange = (period, now) => {
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(now);
    if (period === 'today') {
        const end = new Date(today);
        end.setUTCDate(end.getUTCDate() + 1);
        return { start: today, end };
    }
    if (period === 'weekly') {
        const dayIndex = today.getUTCDay(); // 0 = Sun .. 6 = Sat
        const diffToMonday = dayIndex === 0 ? 6 : dayIndex - 1;
        const start = new Date(today);
        start.setUTCDate(start.getUTCDate() - diffToMonday);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 7);
        return { start, end };
    }
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
    return { start, end };
};
/**
 * Manager-facing attendance summary metadata aggregated across ALL workers
 * for `period` ('today' | 'weekly' | 'monthly').
 *
 * Definitions (each assigned-worker entry across every shift in the period
 * counts separately — a shift with 3 assigned workers contributes up to 3
 * check-ins):
 * - completed_shifts: shifts with status 'completed' whose date falls in the period.
 * - total_hours: sum of (check_out_at - check_in_at) across every worker's
 *   completed check-ins in the period, in hours, rounded to 2 decimals.
 * - punctuality_percentage: of all worker check-ins that happened during the
 *   period, the share that were on-time (check_in_at <= shift's scheduled
 *   date_time, no grace period — same rule as getWorkerPerformanceFromDB's
 *   `late`). 0 when there were no check-ins in the period.
 */
const getWorkersAttendanceSummaryFromDB = (period) => __awaiter(void 0, void 0, void 0, function* () {
    const now = new Date();
    const { start, end } = getAttendanceSummaryPeriodRange(period, now);
    const shifts = yield shift_model_1.Shift.find({
        date: { $gte: start, $lt: end },
    }).lean();
    let completedShifts = 0;
    let workedMs = 0;
    let checkedInCount = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    for (const shift of shifts) {
        if (shift.status === 'completed')
            completedShifts += 1;
        for (const entry of shift.assigned_workers) {
            if (entry.check_in_at && entry.check_out_at) {
                workedMs += entry.check_out_at.getTime() - entry.check_in_at.getTime();
            }
            if (entry.check_in_at) {
                checkedInCount += 1;
                if (entry.check_in_at > shift.date_time) {
                    lateCount += 1;
                }
                else {
                    onTimeCount += 1;
                }
            }
        }
    }
    const punctualityPercentage = checkedInCount > 0
        ? roundToTwoDecimals((onTimeCount / checkedInCount) * 100)
        : 0;
    return {
        period,
        start_date: start,
        end_date: end,
        total_hours: roundToTwoDecimals(workedMs / 3600000),
        completed_shifts: completedShifts,
        punctuality_percentage: punctualityPercentage,
        on_time_check_ins: onTimeCount,
        late_check_ins: lateCount,
    };
});
exports.getWorkersAttendanceSummaryFromDB = getWorkersAttendanceSummaryFromDB;
/**
 * Manager-facing per-worker attendance rows for `period`, optionally
 * filtered by worker name (`searchTerm`) and/or `workerType`. One row per
 * active worker matching the filters, even those with zero shifts in the
 * period (hours_worked/total_shifts/late_days all 0).
 *
 * - total_shifts: count of shifts this worker was assigned to in the period.
 * - hours_worked: sum of (check_out_at - check_in_at) across this worker's
 *   completed check-ins in the period, in hours, rounded to 2 decimals.
 * - late_days: count of this worker's check-ins after the shift's scheduled
 *   date_time (no grace period — same rule used across this module).
 */
const getWorkersAttendanceListFromDB = (period, searchTerm, workerType) => __awaiter(void 0, void 0, void 0, function* () {
    var _e;
    const now = new Date();
    const { start, end } = getAttendanceSummaryPeriodRange(period, now);
    const workerFilter = { isDeleted: { $ne: true } };
    if (workerType)
        workerFilter.worker_type = workerType;
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        workerFilter.name = { $regex: escaped, $options: 'i' };
    }
    const workers = yield worker_model_1.Worker.find(workerFilter)
        .select('name worker_type')
        .lean();
    if (!workers.length)
        return [];
    const workerIds = new Set(workers.map((w) => w._id.toString()));
    const shifts = yield shift_model_1.Shift.find({
        date: { $gte: start, $lt: end },
        'assigned_workers.worker': { $in: workers.map((w) => w._id) },
    }).lean();
    const statsByWorker = new Map();
    for (const shift of shifts) {
        for (const entry of shift.assigned_workers) {
            const workerId = entry.worker.toString();
            if (!workerIds.has(workerId))
                continue;
            const stats = (_e = statsByWorker.get(workerId)) !== null && _e !== void 0 ? _e : {
                hoursWorkedMs: 0,
                totalShifts: 0,
                lateDays: 0,
            };
            stats.totalShifts += 1;
            if (entry.check_in_at && entry.check_out_at) {
                stats.hoursWorkedMs +=
                    entry.check_out_at.getTime() - entry.check_in_at.getTime();
            }
            if (entry.check_in_at && entry.check_in_at > shift.date_time) {
                stats.lateDays += 1;
            }
            statsByWorker.set(workerId, stats);
        }
    }
    return workers.map((worker) => {
        var _a, _b, _c;
        const stats = statsByWorker.get(worker._id.toString());
        return {
            worker_id: worker._id,
            name: worker.name,
            worker_type: worker.worker_type,
            hours_worked: roundToTwoDecimals(((_a = stats === null || stats === void 0 ? void 0 : stats.hoursWorkedMs) !== null && _a !== void 0 ? _a : 0) / 3600000),
            total_shifts: (_b = stats === null || stats === void 0 ? void 0 : stats.totalShifts) !== null && _b !== void 0 ? _b : 0,
            late_days: (_c = stats === null || stats === void 0 ? void 0 : stats.lateDays) !== null && _c !== void 0 ? _c : 0,
        };
    });
});
exports.getWorkersAttendanceListFromDB = getWorkersAttendanceListFromDB;
/**
 * Single-worker attendance summary for `period` ('today' | 'weekly' | 'monthly'),
 * powering the worker profile's Attendance tab.
 *
 * Same definitions as getWorkersAttendanceSummaryFromDB, scoped to this
 * worker's own assigned-worker entry on each shift in the period:
 * - completed_shifts: this worker's shifts with status 'completed' in the period.
 * - total_hours: sum of (check_out_at - check_in_at) across this worker's
 *   completed check-ins in the period, in hours, rounded to 2 decimals.
 * - punctuality_percentage: of this worker's check-ins in the period, the
 *   share that were on-time (check_in_at <= shift's scheduled date_time, no
 *   grace period). 0 when there were no check-ins in the period.
 */
const getWorkerAttendanceSummaryFromDB = (workerId, period) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.default.isObjectIdOrHexString(workerId)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid worker ID');
    }
    const worker = yield worker_model_1.Worker.findOne({
        _id: workerId,
        isDeleted: { $ne: true },
    }).select('_id').lean();
    if (!worker)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker not found');
    const now = new Date();
    const { start, end } = getAttendanceSummaryPeriodRange(period, now);
    const shifts = yield shift_model_1.Shift.find({
        date: { $gte: start, $lt: end },
        'assigned_workers.worker': workerId,
    })
        .select('date_time status assigned_workers.worker assigned_workers.check_in_at assigned_workers.check_out_at')
        .lean();
    let completedShifts = 0;
    let workedMs = 0;
    let onTimeCount = 0;
    let lateCount = 0;
    for (const shift of shifts) {
        const entry = shift.assigned_workers.find((aw) => aw.worker.toString() === workerId);
        if (!entry)
            continue;
        if (shift.status === 'completed')
            completedShifts += 1;
        if (entry.check_in_at && entry.check_out_at) {
            workedMs += entry.check_out_at.getTime() - entry.check_in_at.getTime();
        }
        if (entry.check_in_at) {
            if (entry.check_in_at > shift.date_time) {
                lateCount += 1;
            }
            else {
                onTimeCount += 1;
            }
        }
    }
    const checkedInCount = onTimeCount + lateCount;
    const punctualityPercentage = checkedInCount > 0
        ? roundToTwoDecimals((onTimeCount / checkedInCount) * 100)
        : 0;
    return {
        period,
        start_date: start,
        end_date: end,
        total_hours: roundToTwoDecimals(workedMs / 3600000),
        completed_shifts: completedShifts,
        punctuality_percentage: punctualityPercentage,
        total_check_ins: checkedInCount,
        on_time_check_ins: onTimeCount,
        late_check_ins: lateCount,
    };
});
exports.getWorkerAttendanceSummaryFromDB = getWorkerAttendanceSummaryFromDB;
/** [start, end) UTC bounds for the roster view. Week runs Sunday-Saturday (matches the roster UI). */
const getRosterDateRange = (view, date, year, month) => {
    if (view === 'month') {
        const now = new Date();
        const targetYear = year !== null && year !== void 0 ? year : now.getUTCFullYear();
        const targetMonth = month !== null && month !== void 0 ? month : now.getUTCMonth() + 1;
        if (targetMonth < 1 || targetMonth > 12) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'month must be between 1 and 12');
        }
        return {
            start: new Date(Date.UTC(targetYear, targetMonth - 1, 1)),
            end: new Date(Date.UTC(targetYear, targetMonth, 1)),
        };
    }
    let anchor;
    if (date) {
        anchor = (0, availability_util_1.normalizeToUTCDateOnly)(new Date(date));
        if (Number.isNaN(anchor.getTime())) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid date: ${date}`);
        }
    }
    else {
        anchor = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    }
    if (view === 'day') {
        const end = new Date(anchor);
        end.setUTCDate(end.getUTCDate() + 1);
        return { start: anchor, end };
    }
    // week: Sunday-Saturday containing `anchor`
    const start = new Date(anchor);
    start.setUTCDate(start.getUTCDate() - anchor.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    return { start, end };
};
exports.getRosterDateRange = getRosterDateRange;
/**
 * Manager-facing shift roster for the "Shift Roster" page: for `view`
 * ('day' | 'week' | 'month'), one PAGE of active workers (optionally
 * filtered by name/type, same filters as getWorkersAttendanceListFromDB)
 * with their STAFFED shifts for each date in the range. A worker only ever
 * appears on a real, staffed Shift (see assignWorkersToShift) — there is no
 * plan-level default roster to merge in, so every entry here is real.
 *
 * client/location narrow this to workers who have at least one shift for
 * that client/location in the range — AND their calendar cells only show
 * shifts matching the filter too, not their unrelated shifts elsewhere (same
 * "filtered means filtered end to end" behavior as getManagerPlanRosterFromDB).
 *
 * Pagination happens FIRST, on the Worker query itself (via a single
 * `$facet` aggregation that returns the page and the total count in one
 * round trip) — the materialized-Shift query is then scoped to only this
 * page's workers, not the whole roster. When client/location is supplied, an
 * extra up-front query resolves the matching worker ids so the Worker
 * `$facet` can be scoped to them too (empty $in yields zero results, never
 * "filter ignored" — same convention as getTodayLiveShiftsFromDB's client filter).
 */
const getShiftRosterFromDB = (params) => __awaiter(void 0, void 0, void 0, function* () {
    var _f, _g, _h, _j, _k, _l, _m, _o;
    const { view, date, year, month, searchTerm, workerType, client, location } = params;
    const { start, end } = (0, exports.getRosterDateRange)(view, date, year, month);
    const page = Math.max(1, Math.trunc((_f = params.page) !== null && _f !== void 0 ? _f : 1) || 1);
    const limit = Math.min(100, Math.max(1, Math.trunc((_g = params.limit) !== null && _g !== void 0 ? _g : 20) || 20));
    const shiftFilter = {
        date: { $gte: start, $lt: end },
        status: { $ne: 'cancelled' },
    };
    if (location !== undefined) {
        if (!mongoose_1.default.isValidObjectId(location)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid location ID');
        }
        shiftFilter['location.location'] = new mongoose_1.Types.ObjectId(location);
    }
    if (client !== undefined) {
        if (!mongoose_1.default.isValidObjectId(client)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid client ID');
        }
        const planIds = yield cleaning_plan_model_1.CleaningPlan.find({ client }).distinct('_id');
        // An empty $in never matches — correctly yields zero results instead
        // of accidentally falling through to "no client filter at all".
        shiftFilter.cleaning_plan = { $in: planIds };
    }
    const filteringByClientOrLocation = location !== undefined || client !== undefined;
    const workerFilter = { isDeleted: { $ne: true } };
    if (workerType)
        workerFilter.worker_type = workerType;
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        workerFilter.name = { $regex: escaped, $options: 'i' };
    }
    if (filteringByClientOrLocation) {
        const matchingWorkerIds = yield shift_model_1.Shift.find(shiftFilter).distinct('assigned_workers.worker');
        workerFilter._id = { $in: matchingWorkerIds };
    }
    // Single round trip for both the page and the total count, so pagination
    // metadata never costs a second query.
    const [facet] = yield worker_model_1.Worker.aggregate([
        { $match: workerFilter },
        { $sort: { name: 1, _id: 1 } },
        {
            $facet: {
                data: [
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    { $project: { name: 1, worker_type: 1 } },
                ],
                totalCount: [{ $count: 'total' }],
            },
        },
    ]);
    const workers = (_h = facet === null || facet === void 0 ? void 0 : facet.data) !== null && _h !== void 0 ? _h : [];
    const totalWorkers = (_l = (_k = (_j = facet === null || facet === void 0 ? void 0 : facet.totalCount) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.total) !== null && _l !== void 0 ? _l : 0;
    const totalPage = totalWorkers ? Math.ceil(totalWorkers / limit) : 0;
    const dateKeys = [];
    for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        dateKeys.push(new Date(cursor).toISOString().slice(0, 10));
    }
    if (!workers.length) {
        return {
            view,
            start_date: start,
            end_date: end,
            meta: { page, limit, total: totalWorkers, totalPage, total_shifts: 0 },
            workers: [],
        };
    }
    const workerIds = workers.map((w) => w._id);
    const workerIdSet = new Set(workerIds.map((id) => id.toString()));
    const materializedShifts = yield shift_model_1.Shift.find(Object.assign(Object.assign({}, shiftFilter), { 'assigned_workers.worker': { $in: workerIds } })).lean();
    // workerId -> dateKey -> entries
    const shiftsByWorkerDate = new Map();
    const addEntry = (workerId, dateKey, entry) => {
        let byDate = shiftsByWorkerDate.get(workerId);
        if (!byDate) {
            byDate = new Map();
            shiftsByWorkerDate.set(workerId, byDate);
        }
        const list = byDate.get(dateKey);
        if (list)
            list.push(entry);
        else
            byDate.set(dateKey, [entry]);
    };
    let totalShifts = 0;
    for (const shift of materializedShifts) {
        const matchingWorkerIds = shift.assigned_workers
            .map((aw) => aw.worker.toString())
            .filter((id) => workerIdSet.has(id));
        if (!matchingWorkerIds.length)
            continue;
        const dateKey = shift.date.toISOString().slice(0, 10);
        const entry = {
            shift_id: shift._id.toString(),
            is_virtual: false,
            plan_id: shift.cleaning_plan.toString(),
            location_name: (_o = (_m = shift.location) === null || _m === void 0 ? void 0 : _m.name) !== null && _o !== void 0 ? _o : '',
            start_time: shift.date_time,
            duration_minutes: shift.duration_minutes,
            end_time: resolveShiftEndTime(shift),
            status: shift.status,
        };
        totalShifts += 1;
        for (const workerId of matchingWorkerIds) {
            addEntry(workerId, dateKey, entry);
        }
    }
    const workerRows = workers.map((worker) => {
        var _a;
        const workerId = worker._id.toString();
        const byDate = shiftsByWorkerDate.get(workerId);
        const shiftsByDate = {};
        let totalShiftsForWorker = 0;
        let totalMinutesForWorker = 0;
        for (const dateKey of dateKeys) {
            const entries = (_a = byDate === null || byDate === void 0 ? void 0 : byDate.get(dateKey)) !== null && _a !== void 0 ? _a : [];
            shiftsByDate[dateKey] = entries;
            totalShiftsForWorker += entries.length;
            totalMinutesForWorker += entries.reduce((sum, e) => sum + e.duration_minutes, 0);
        }
        return {
            worker_id: worker._id,
            name: worker.name,
            worker_type: worker.worker_type,
            total_shifts_in_range: totalShiftsForWorker,
            total_hours_in_range: roundToTwoDecimals(totalMinutesForWorker / 60),
            shifts_by_date: shiftsByDate,
        };
    });
    return {
        view,
        start_date: start,
        end_date: end,
        meta: {
            page,
            limit,
            total: totalWorkers,
            totalPage,
            total_shifts: totalShifts,
        },
        workers: workerRows,
    };
});
exports.getShiftRosterFromDB = getShiftRosterFromDB;
/**
 * Core of the "roster grouped by cleaning plan" view, shared by the
 * client-facing GET /client/roster (scoped to that client's own plans) and
 * the manager-facing GET /shift/plan-roster (scoped by whatever `planFilter`
 * the caller passes — e.g. every active plan, or narrowed by client/location).
 * For each matching plan (paginated), every due date in the selected day/
 * week/month window: the real, staffed Shift where one exists, otherwise an
 * unstaffed placeholder (is_virtual: true, status 'unstaffed', no start_time/
 * end_time/assigned_workers) for a date the plan's current tasks are due on
 * but nobody has scheduled yet.
 */
const getPlanGroupedRosterFromDB = (planFilter, params) => __awaiter(void 0, void 0, void 0, function* () {
    var _p, _q;
    const { view, date, year, month } = params;
    const { start, end } = (0, exports.getRosterDateRange)(view, date, year, month);
    const page = Math.max(1, Math.trunc((_p = params.page) !== null && _p !== void 0 ? _p : 1) || 1);
    const limit = Math.min(50, Math.max(1, Math.trunc((_q = params.limit) !== null && _q !== void 0 ? _q : 10) || 10));
    const [totalPlans, plans] = yield Promise.all([
        cleaning_plan_model_1.CleaningPlan.countDocuments(planFilter),
        cleaning_plan_model_1.CleaningPlan.find(planFilter)
            .select('title location rooms tasks createdAt')
            .sort({ title: 1, _id: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
    ]);
    const totalPage = totalPlans ? Math.ceil(totalPlans / limit) : 0;
    if (!plans.length) {
        return {
            view,
            start_date: start,
            end_date: end,
            meta: { page, limit, total: totalPlans, totalPage, total_shifts: 0 },
            cleaning_plans: [],
        };
    }
    const planIds = plans.map((p) => p._id);
    const allTaskIds = [
        ...new Set(plans.flatMap((p) => { var _a; return ((_a = p.tasks) !== null && _a !== void 0 ? _a : []).map((t) => t.toString()); })),
    ];
    const allLocationIds = [...new Set(plans.map((p) => p.location.toString()))];
    const [tasks, locations, materializedShifts] = yield Promise.all([
        task_model_1.Task.find({ _id: { $in: allTaskIds }, is_active: true })
            .select('room frequency_type days_of_week days_of_month duration_minutes createdAt')
            .lean(),
        location_model_1.Location.find({ _id: { $in: allLocationIds } }).select('name').lean(),
        shift_model_1.Shift.find({
            cleaning_plan: { $in: planIds },
            date: { $gte: start, $lt: end },
        }).lean(),
    ]);
    const tasksById = new Map(tasks.map((t) => [t._id.toString(), t]));
    const locationNameById = new Map(locations.map((l) => [l._id.toString(), l.name]));
    const materializedByPlanDate = new Map(materializedShifts.map((s) => [`${s.cleaning_plan.toString()}|${s.date.toISOString()}`, s]));
    let totalShifts = 0;
    const cleaning_plans = plans.map((plan) => {
        var _a, _b;
        const planIdStr = plan._id.toString();
        const planTasks = ((_a = plan.tasks) !== null && _a !== void 0 ? _a : [])
            .map((id) => tasksById.get(id.toString()))
            .filter((t) => !!t);
        // Anchored on whichever is later, the task's or the plan's own
        // createdAt — see shift.snapshot.util.ts's buildShiftSnapshot.
        const patterns = planTasks.map((t) => (0, availability_util_1.taskToPattern)(t, (0, availability_util_1.laterOf)(t.createdAt, plan.createdAt), null));
        const locationName = (_b = locationNameById.get(plan.location.toString())) !== null && _b !== void 0 ? _b : '';
        const shifts = [];
        let totalMinutes = 0;
        for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
            const day = new Date(cursor);
            const dateKey = day.toISOString().slice(0, 10);
            const materialized = materializedByPlanDate.get(`${planIdStr}|${day.toISOString()}`);
            if (materialized) {
                const planTasksInShift = (materialized.tasks || []).filter((t) => t.source === 'plan_task' && t.room);
                const roomIds = (materialized.rooms || []).map((r) => r.room.toString());
                let completedRooms = 0;
                for (const roomId of roomIds) {
                    const tasksInRoom = planTasksInShift.filter((t) => { var _a; return ((_a = t.room) === null || _a === void 0 ? void 0 : _a.toString()) === roomId; });
                    if (tasksInRoom.length > 0 && tasksInRoom.every((t) => t.is_completed)) {
                        completedRooms += 1;
                    }
                }
                const totalTasksInShift = (materialized.tasks || []).length;
                const completedTasksInShift = (materialized.tasks || []).filter((t) => t.is_completed).length;
                shifts.push({
                    date: dateKey,
                    shift_id: materialized._id.toString(),
                    is_virtual: false,
                    status: materialized.status,
                    start_time: materialized.date_time,
                    end_time: resolveShiftEndTime(materialized),
                    duration_minutes: materialized.duration_minutes,
                    rooms: { total: roomIds.length, completed: completedRooms },
                    tasks: { total: totalTasksInShift, completed: completedTasksInShift },
                    assigned_workers: (materialized.assigned_workers || []).map((w) => {
                        var _a;
                        return ({
                            worker_id: ((_a = w.worker) === null || _a === void 0 ? void 0 : _a.toString()) || '',
                            name: w.name,
                            role: w.role,
                        });
                    }),
                });
                totalMinutes += materialized.duration_minutes;
                totalShifts += 1;
                continue;
            }
            if (!planTasks.length)
                continue;
            // Each task's own frequency/anchor is checked individually — a
            // room mixes daily/weekly/monthly tasks that don't all recur on
            // the same days, so planTasks.length is never the right count
            // for this specific date (see tasksOccurringOnDate).
            const dueTasksForDay = planTasks.filter((_, i) => (0, availability_util_1.occursOnDate)(day, patterns[i]));
            if (!dueTasksForDay.length)
                continue;
            const dueRoomIds = new Set(dueTasksForDay.map((t) => t.room.toString()));
            // Due, but not yet staffed (see assignWorkersToShift) — no time
            // or crew to show until a manager schedules it.
            const virtualDurationMinutes = dueTasksForDay.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
            shifts.push({
                date: dateKey,
                shift_id: null,
                is_virtual: true,
                status: 'unstaffed',
                start_time: null,
                end_time: null,
                duration_minutes: virtualDurationMinutes,
                rooms: { total: dueRoomIds.size, completed: 0 },
                tasks: { total: dueTasksForDay.length, completed: 0 },
                assigned_workers: [],
            });
            totalMinutes += virtualDurationMinutes;
            totalShifts += 1;
        }
        // A gap the manager still needs to staff: never staffed (virtual),
        // cancelled (e.g. by reconcileFutureShiftsForTaskChange), or somehow
        // real but crew-less. Surfaced so the roster list view can flag a
        // plan without the caller having to inspect every shift itself —
        // see bulkAssignWorkerToShifts for the same gap definition.
        const unassignedShiftCount = shifts.filter((s) => s.is_virtual || s.status === 'cancelled' || s.assigned_workers.length === 0).length;
        return {
            plan_id: planIdStr,
            plan_title: plan.title,
            location_name: locationName,
            total_shifts_in_range: shifts.length,
            unassigned_shift_count: unassignedShiftCount,
            total_hours_in_range: roundToTwoDecimals(totalMinutes / 60),
            shifts,
        };
    });
    return {
        view,
        start_date: start,
        end_date: end,
        meta: { page, limit, total: totalPlans, totalPage, total_shifts: totalShifts },
        cleaning_plans,
    };
});
exports.getPlanGroupedRosterFromDB = getPlanGroupedRosterFromDB;
/**
 * Manager-facing plan-grouped roster: every active cleaning plan in the
 * system (not scoped to one client), optionally narrowed to one client,
 * one location, or a plan-title search — the system-wide counterpart to
 * GET /client/roster. Same day/week/month semantics and response shape.
 */
const getManagerPlanRosterFromDB = (params) => __awaiter(void 0, void 0, void 0, function* () {
    const { client, location, searchTerm } = params, rosterParams = __rest(params, ["client", "location", "searchTerm"]);
    const planFilter = { is_active: true };
    if (client !== undefined) {
        if (!mongoose_1.default.isValidObjectId(client)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid client ID');
        }
        planFilter.client = new mongoose_1.Types.ObjectId(client);
    }
    if (location !== undefined) {
        if (!mongoose_1.default.isValidObjectId(location)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid location ID');
        }
        planFilter.location = new mongoose_1.Types.ObjectId(location);
    }
    if (searchTerm) {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        planFilter.title = { $regex: escaped, $options: 'i' };
    }
    return (0, exports.getPlanGroupedRosterFromDB)(planFilter, rosterParams);
});
exports.getManagerPlanRosterFromDB = getManagerPlanRosterFromDB;
/**
 * Loads the existing Shift for (planId, date), or builds and creates a fresh
 * one (rooms/tasks/location snapshotted from the plan's current state, plus
 * any already-approved AdditionalTasks for that day) if this is the first
 * time this due date is being staffed. Throws if the plan's current tasks
 * don't actually occur on this date. Idempotent under concurrency via the
 * { cleaning_plan, date } unique index: if two managers race to staff the
 * same date, the loser recovers by re-fetching the winner's document.
 */
const getOrCreateBareShift = (planId, date) => __awaiter(void 0, void 0, void 0, function* () {
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const existing = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day });
    if (existing)
        return existing;
    const plan = yield ensureActivePlan(planId);
    if (!plan.is_active) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot schedule a shift for an inactive cleaning plan');
    }
    const snapshot = yield (0, shift_snapshot_util_1.buildShiftSnapshot)(plan);
    const dueTasks = (0, shift_snapshot_util_1.tasksOccurringOnDate)(snapshot, day);
    if (!dueTasks.length) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This cleaning plan has no occurrence on the given date');
    }
    const additional = yield (0, shift_snapshot_util_1.buildAdditionalTaskEntriesForDay)(plan._id, day);
    const dueTasksDurationMinutes = dueTasks.reduce((sum, t) => sum + t.duration_minutes, 0);
    try {
        return yield shift_model_1.Shift.create({
            cleaning_plan: plan._id,
            date: day,
            // Placeholder until the caller (assignWorkersToShift) sets the
            // manager-chosen schedule right below — never left this way.
            date_time: day,
            end_time: day,
            location: snapshot.location,
            rooms: (0, shift_snapshot_util_1.roomsWithDueTasks)(snapshot.rooms, dueTasks),
            tasks: [...dueTasks, ...additional.tasks],
            duration_minutes: dueTasksDurationMinutes + additional.durationMinutes,
            assigned_workers: [],
            status: 'upcoming',
        });
    }
    catch (error) {
        if (isDuplicateKeyError(error)) {
            // Lost the race to a concurrent creator — their document is
            // authoritative, use it.
            const winner = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day });
            if (winner)
                return winner;
        }
        throw error;
    }
});
/**
 * The single staffing action: schedules who works a due date and when, and
 * is also how a manager swaps the crew after the shift has started (a
 * no-show replaced, or a worker pulled mid-shift because they fell ill).
 *
 * The first call for a given (planId, date) creates that day's Shift (rooms/
 * tasks snapshotted from the plan's current state). Every call after that
 * is a MERGE against the existing crew, never a blind overwrite: a worker
 * who is already on the list keeps their check_in_at/check_out_at/
 * coordinates exactly as they were (only their role can change) — losing
 * that data would corrupt their attendance record and silently break their
 * pay. A worker dropped from the list is simply removed, check-in state and
 * all; a worker not yet on the list is added as a fresh, not-checked-in
 * entry. Scheduling conflicts are only re-checked for newly added workers —
 * someone already on the shift already passed that check once and re-
 * running it would just risk spuriously flagging someone currently at work.
 *
 * The requested start/end time is only applied while the shift hasn't
 * started yet (status 'upcoming'). Once it's 'in_progress'/'completed',
 * the schedule is left alone — changing it after the fact would retroactively
 * move the duration that already-checked-in workers' pay is based on.
 *
 * Ineligible workers are always rejected; a newly added worker already
 * double-booked on another staffed shift that day is rejected unless
 * `force`, in which case the conflicting entry is flagged
 * (assigned_with_conflict) rather than silently allowed.
 */
const assignWorkersToShift = (managerId, planId, date, assignedWorkers, startTime, endTime, force) => __awaiter(void 0, void 0, void 0, function* () {
    var _r;
    if (!(endTime > startTime)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'end_time must be after start_time');
    }
    const shift = yield getOrCreateBareShift(planId, date);
    const shiftHasStarted = shift.status === 'in_progress' || shift.status === 'completed';
    const existingByWorkerId = new Map(shift.assigned_workers.map((aw) => [aw.worker.toString(), aw]));
    // Only workers genuinely new to this shift need (re-)validating — an
    // existing entry already passed eligibility/conflict checks when first
    // assigned, and the shift's own schedule can't have moved under them
    // once it's started (see shiftHasStarted above).
    const newlyAddedWorkers = assignedWorkers.filter((aw) => !existingByWorkerId.has(aw.worker.toString()));
    if (newlyAddedWorkers.length) {
        yield (0, worker_eligibility_util_1.assertWorkersEligible)(newlyAddedWorkers.map((aw) => aw.worker));
    }
    // Conflict-check against the shift's REAL committed window once it has
    // started — the caller's start/end params are ignored for scheduling
    // in that case (see shiftHasStarted above), so checking against them
    // here would validate a window this shift will never actually have.
    const effectiveStartTime = shiftHasStarted ? shift.date_time : startTime;
    const effectiveEndTime = shiftHasStarted ? shift.end_time : endTime;
    const effectiveDurationMinutes = Math.round((effectiveEndTime.getTime() - effectiveStartTime.getTime()) / 60000);
    const conflictEntries = new Map();
    for (const aw of newlyAddedWorkers) {
        const conflict = yield (0, shift_availability_services_1.findWorkerConflictOnDate)(aw.worker, shift.date, effectiveStartTime, effectiveDurationMinutes, { shiftId: shift._id });
        if (conflict)
            conflictEntries.set(aw.worker.toString(), conflict);
    }
    if (conflictEntries.size && !force) {
        throw new appError_1.default(http_status_1.default.CONFLICT, 'One or more workers have a scheduling conflict. Pass force=true to assign anyway.', '', {
            conflicts: Array.from(conflictEntries.entries()).map(([workerId, c]) => ({
                worker: workerId,
                reason: c.reason,
                conflicting_plan_id: c.conflicting_plan_id,
            })),
        });
    }
    // The client only sends { worker, role } — resolve the display-name
    // snapshot server-side rather than trusting a client-supplied name.
    // Only needed for genuinely new entries; existing ones keep their
    // already-snapshotted name.
    const workerDocs = newlyAddedWorkers.length
        ? yield worker_model_1.Worker.find({
            _id: { $in: newlyAddedWorkers.map((aw) => aw.worker) },
        })
            .select('name')
            .lean()
        : [];
    const nameById = new Map(workerDocs.map((w) => [w._id.toString(), w.name]));
    const previousWorkerIds = [...existingByWorkerId.keys()];
    const nextAssignedWorkers = assignedWorkers.map((aw) => {
        var _a, _b, _c, _d, _e;
        const workerIdStr = aw.worker.toString();
        const existing = existingByWorkerId.get(workerIdStr);
        if (existing) {
            // Carry the existing entry forward untouched — attendance state
            // is never rewritten by a roster edit. Only the role is
            // editable here.
            return {
                worker: existing.worker,
                name: existing.name,
                role: aw.role,
                assigned_with_conflict: existing.assigned_with_conflict,
                check_in_at: (_a = existing.check_in_at) !== null && _a !== void 0 ? _a : null,
                check_in_coordinates: (_b = existing.check_in_coordinates) !== null && _b !== void 0 ? _b : null,
                check_out_at: (_c = existing.check_out_at) !== null && _c !== void 0 ? _c : null,
                check_out_coordinates: (_d = existing.check_out_coordinates) !== null && _d !== void 0 ? _d : null,
            };
        }
        return {
            worker: aw.worker,
            name: (_e = nameById.get(workerIdStr)) !== null && _e !== void 0 ? _e : '',
            role: aw.role,
            assigned_with_conflict: conflictEntries.has(workerIdStr),
            check_in_at: null,
            check_in_coordinates: null,
            check_out_at: null,
            check_out_coordinates: null,
        };
    });
    const result = yield shift_model_1.Shift.findByIdAndUpdate(shift._id, Object.assign(Object.assign({ assigned_workers: nextAssignedWorkers, last_updated_by: managerId }, (!shiftHasStarted && { date_time: startTime, end_time: endTime })), (shift.status === 'cancelled' && { status: 'upcoming' })), { new: true, runValidators: true });
    if (!result)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Shift not found');
    const newWorkerIds = result.assigned_workers.map((aw) => aw.worker.toString());
    const addedWorkerIds = newWorkerIds.filter((id) => !previousWorkerIds.includes(id));
    const removedWorkerIds = previousWorkerIds.filter((id) => !newWorkerIds.includes(id));
    const plan = yield cleaning_plan_model_1.CleaningPlan.findById(planId).select('title').lean();
    const planTitle = (_r = plan === null || plan === void 0 ? void 0 : plan.title) !== null && _r !== void 0 ? _r : '';
    if (addedWorkerIds.length) {
        (0, eventEmitter_1.emitAppEvent)('shift.worker_assigned', {
            shiftId: result._id.toString(),
            planId,
            title: planTitle,
            addedWorkerIds,
            start_date: result.date_time,
        });
    }
    if (removedWorkerIds.length) {
        (0, eventEmitter_1.emitAppEvent)('shift.worker_removed', {
            shiftId: result._id.toString(),
            planId,
            title: planTitle,
            removedWorkerIds,
        });
    }
    // Chat group membership for the plan accumulates every worker ever
    // staffed onto any of its shifts — never auto-removed, since a crew
    // rotating day to day shouldn't lose access to prior context. A manager
    // can still remove someone from the group chat manually.
    if (addedWorkerIds.length) {
        const currentGroupWorkerIds = yield chat_services_1.default.getChatGroupWorkerIds(planId);
        const unionWorkerIds = [
            ...new Set([...currentGroupWorkerIds, ...addedWorkerIds]),
        ];
        yield chat_services_1.default.syncChatGroupWorkers(planId, unionWorkerIds);
    }
    return result;
});
exports.assignWorkersToShift = assignWorkersToShift;
const FULL_WEEKDAY_NAMES = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
];
/**
 * Worker picker for staffing one due date: every active, eligible worker
 * (deleted/blocked/inactive accounts are omitted entirely, not flagged),
 * each annotated with whether they're generally available that weekday
 * (is_available, from their own working_days) and whether staffing them for
 * this exact start/end window would double-book them against another
 * already-staffed shift (is_conflict, reusing the same check
 * assignWorkersToShift itself runs). Purely a preview — nothing is written,
 * and neither flag blocks anything here; assignWorkersToShift is still what
 * actually enforces the conflict gate (unless force=true).
 */
const listEligibleWorkersForShift = (planId, date, startTime, endTime) => __awaiter(void 0, void 0, void 0, function* () {
    var _s, _t, _u;
    if (!(endTime > startTime)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'end_time must be after start_time');
    }
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const plan = yield ensureActivePlan(planId);
    const snapshot = yield (0, shift_snapshot_util_1.buildShiftSnapshot)(plan);
    if (!(0, availability_util_1.anyPatternOccursOnDate)(snapshot.patterns, day)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This cleaning plan has no occurrence on the given date');
    }
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    const weekdayName = FULL_WEEKDAY_NAMES[day.getUTCDay()];
    // Excludes today's own shift (if it already exists) from the conflict
    // search — reassigning a currently-assigned worker to the same shift
    // must never read back as a conflict against themselves.
    const existingShift = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day })
        .select('_id')
        .lean();
    const allWorkers = yield worker_model_1.Worker.find(worker_eligibility_util_1.activeWorkerFilter).lean();
    const eligibleWorkers = yield (0, worker_eligibility_util_1.filterEligibleWorkers)(allWorkers);
    const results = [];
    for (const worker of eligibleWorkers) {
        const workingDays = (_s = worker.working_days) !== null && _s !== void 0 ? _s : [];
        const isAvailable = workingDays.includes(weekdayName);
        const conflict = yield (0, shift_availability_services_1.findWorkerConflictOnDate)(worker._id, day, startTime, durationMinutes, { shiftId: existingShift === null || existingShift === void 0 ? void 0 : existingShift._id });
        results.push({
            worker,
            is_available: isAvailable,
            is_conflict: !!conflict,
            conflict_reason: (_t = conflict === null || conflict === void 0 ? void 0 : conflict.reason) !== null && _t !== void 0 ? _t : null,
            conflicting_plan_id: (_u = conflict === null || conflict === void 0 ? void 0 : conflict.conflicting_plan_id) !== null && _u !== void 0 ? _u : null,
        });
    }
    return results;
});
exports.listEligibleWorkersForShift = listEligibleWorkersForShift;
const updateShiftStatus = (managerId, planId, date, status) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield getShiftOrThrow(planId, date);
    const result = yield shift_model_1.Shift.findByIdAndUpdate(shift._id, { status, last_updated_by: managerId }, { new: true, runValidators: true });
    return result;
});
exports.updateShiftStatus = updateShiftStatus;
/**
 * Perceptual hashes of photos already accepted for this room, used to spot a
 * worker resubmitting an earlier photo. Scoped to the room and limited to the
 * last 60 days so the comparison stays cheap.
 */
/**
 * Hashes to compare a new photo against, split by how strict the comparison
 * should be.
 *
 * A room cleaned to the same standard photographs almost identically every
 * day, so a near-match across days is the expected result, not evidence of
 * anything. Measured distances: an identical file scores 0, the same room
 * under different lighting scores 2, and a slightly moved camera scores 20+.
 * Only an exact match across days means a file was reused, whereas within one
 * shift a near-match means the same photo was submitted for two requirements.
 */
const collectRoomPhotoHashes = (roomId, shiftId) => __awaiter(void 0, void 0, void 0, function* () {
    var _v, _w, _x, _y, _z;
    const sameShift = [];
    const otherShifts = [];
    const current = yield shift_model_1.Shift.findById(shiftId)
        .select('tasks.photo_requirements.phash')
        .lean();
    for (const task of (_v = current === null || current === void 0 ? void 0 : current.tasks) !== null && _v !== void 0 ? _v : []) {
        for (const requirement of (_w = task.photo_requirements) !== null && _w !== void 0 ? _w : []) {
            if (requirement.phash)
                sameShift.push(requirement.phash);
        }
    }
    if (!roomId)
        return { sameShift, otherShifts };
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 60);
    const shifts = yield shift_model_1.Shift.find({
        _id: { $ne: shiftId },
        date: { $gte: since },
        'tasks.room': roomId,
    })
        .select('tasks.room tasks.photo_requirements.phash')
        .lean();
    for (const shift of shifts) {
        for (const task of (_x = shift.tasks) !== null && _x !== void 0 ? _x : []) {
            if (((_y = task.room) === null || _y === void 0 ? void 0 : _y.toString()) !== roomId.toString())
                continue;
            for (const requirement of (_z = task.photo_requirements) !== null && _z !== void 0 ? _z : []) {
                if (requirement.phash)
                    otherShifts.push(requirement.phash);
            }
        }
    }
    return { sameShift, otherShifts };
});
/**
 * Writes an evaluation result onto one photo requirement. Runs after the
 * response has been sent, so a failure here is logged and dropped rather than
 * surfaced — the task is already complete either way.
 */
const saveAiFields = (shiftId, taskId, title, result) => __awaiter(void 0, void 0, void 0, function* () {
    const fields = photo_ai_service_1.PhotoAiService.aiResultToFields(result);
    const update = {};
    for (const [key, value] of Object.entries(fields)) {
        update[`tasks.$[t].photo_requirements.$[p].${key}`] = value;
    }
    yield shift_model_1.Shift.updateOne({ _id: shiftId }, { $set: update }, {
        arrayFilters: [
            { 't.task': new mongoose_1.Types.ObjectId(taskId) },
            { 'p.title': title },
        ],
    });
});
/**
 * Records a worker's photo submission for one task instance within one
 * shift, materializing the shift first if needed. `is_completed` on that
 * task entry is recomputed automatically from its photo requirements — for
 * a photo-required task there is no manual complete/approve step (see
 * docs/SHIFT_MANAGEMENT_DESIGN.md). Tasks with no photo requirement are
 * NOT completed by this function — see markShiftTaskComplete.
 */
const uploadShiftTaskPhoto = (workerId, planId, date, taskId, title, photoUrl) => __awaiter(void 0, void 0, void 0, function* () {
    var _0, _1, _2, _3;
    const shift = yield getShiftOrThrow(planId, date);
    const isAssigned = shift.assigned_workers.some((aw) => aw.worker.toString() === workerId);
    if (!isAssigned) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'You are not assigned to this shift');
    }
    const taskIndex = shift.tasks.findIndex((t) => t.task.toString() === taskId);
    if (taskIndex === -1) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Task not found on this shift');
    }
    const requirementExists = shift.tasks[taskIndex].photo_requirements.some((p) => p.title === title);
    if (!requirementExists) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Unknown photo requirement "${title}" for this task`);
    }
    const requirement = shift.tasks[taskIndex].photo_requirements.find((p) => p.title === title);
    const attempts = ((_0 = requirement === null || requirement === void 0 ? void 0 : requirement.attempt_count) !== null && _0 !== void 0 ? _0 : 0) + 1;
    // Photos already accepted for this room, so a resubmitted one is caught.
    const reuseCandidates = yield collectRoomPhotoHashes(shift.tasks[taskIndex].room, shift._id);
    const gate = yield photo_ai_service_1.PhotoAiService.checkPhotoByUrl(photoUrl, reuseCandidates);
    // After max_attempts the photo is taken anyway and flagged, so a worker is
    // never stranded on site. The rejected attempts stay on the record.
    const forced = gate.status === 'rejected' &&
        attempts >= photo_ai_config_1.photoAiConfig.gate.max_attempts;
    if (gate.status === 'rejected' && !forced) {
        yield shift_model_1.Shift.updateOne({ _id: shift._id }, {
            $set: {
                'tasks.$[t].photo_requirements.$[p].attempt_count': attempts,
                'tasks.$[t].photo_requirements.$[p].gate_status': 'rejected',
                'tasks.$[t].photo_requirements.$[p].gate_reason': gate.reason,
                'tasks.$[t].photo_requirements.$[p].gate_metrics': gate.metrics,
            },
        }, {
            arrayFilters: [
                { 't.task': new mongoose_1.Types.ObjectId(taskId) },
                { 'p.title': title },
            ],
        });
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, (_1 = gate.reason) !== null && _1 !== void 0 ? _1 : 'Photo could not be accepted. Please retake.');
    }
    // Atomic, targeted write for the actual photo field — safe under
    // concurrent uploads to different requirements/tasks on the same shift.
    yield shift_model_1.Shift.updateOne({ _id: shift._id }, {
        $set: {
            'tasks.$[t].photo_requirements.$[p].photo_url': photoUrl,
            'tasks.$[t].photo_requirements.$[p].is_uploaded': true,
            'tasks.$[t].photo_requirements.$[p].attempt_count': attempts,
            'tasks.$[t].photo_requirements.$[p].forced_accept': forced,
            'tasks.$[t].photo_requirements.$[p].gate_status': gate.status,
            'tasks.$[t].photo_requirements.$[p].gate_reason': (_2 = gate.reason) !== null && _2 !== void 0 ? _2 : null,
            'tasks.$[t].photo_requirements.$[p].gate_metrics': gate.metrics,
            'tasks.$[t].photo_requirements.$[p].phash': gate.phash,
            'tasks.$[t].photo_requirements.$[p].ai_status': 'pending',
        },
    }, {
        arrayFilters: [
            { 't.task': new mongoose_1.Types.ObjectId(taskId) },
            { 'p.title': title },
        ],
    });
    // is_completed depends on the FULL set of that task's requirements, so
    // it's recomputed from a fresh read rather than assumed from this write.
    const refreshed = yield shift_model_1.Shift.findById(shift._id);
    if (!refreshed)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Shift not found');
    const refreshedIndex = refreshed.tasks.findIndex((t) => t.task.toString() === taskId);
    const updatedTask = (0, shift_snapshot_util_1.recomputeTaskCompletion)(refreshed.tasks[refreshedIndex]);
    if (updatedTask.is_completed !== refreshed.tasks[refreshedIndex].is_completed) {
        yield shift_model_1.Shift.updateOne({ _id: shift._id, 'tasks.task': taskId }, {
            $set: {
                'tasks.$.is_completed': updatedTask.is_completed,
                'tasks.$.completed_at': updatedTask.completed_at,
            },
        });
    }
    yield maybeAutoCompleteShift(shift._id);
    // Not awaited. The task is already complete and the response is on its way;
    // this only adds flags for the manager's review queue.
    const roomId = (_3 = shift.tasks[taskIndex].room) === null || _3 === void 0 ? void 0 : _3.toString();
    const room = shift.rooms.find((r) => r.room.toString() === roomId);
    void photo_ai_service_1.PhotoAiService.evaluatePhoto({
        photo_url: photoUrl,
        requirement: {
            title,
            description: requirement === null || requirement === void 0 ? void 0 : requirement.description,
            reference_image_url: requirement === null || requirement === void 0 ? void 0 : requirement.reference_image_url,
        },
        context: {
            room_name: room === null || room === void 0 ? void 0 : room.name,
            room_type: room === null || room === void 0 ? void 0 : room.room_type,
            task_name: shift.tasks[taskIndex].name,
        },
    })
        .then((result) => saveAiFields(shift._id, taskId, title, result))
        .catch(() => undefined);
    return shift_model_1.Shift.findById(shift._id);
});
exports.uploadShiftTaskPhoto = uploadShiftTaskPhoto;
const markShiftTaskComplete = (workerId, planId, date, taskId) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield getShiftOrThrow(planId, date);
    const isAssigned = shift.assigned_workers.some((aw) => aw.worker.toString() === workerId);
    if (!isAssigned) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'You are not assigned to this shift');
    }
    const task = shift.tasks.find((t) => t.task.toString() === taskId);
    if (!task) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Task not found on this shift');
    }
    if (task.is_photo_required) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This task requires photo(s) — upload the required photo(s) to complete it');
    }
    if (task.is_completed) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Task is already completed');
    }
    yield shift_model_1.Shift.updateOne({ _id: shift._id, 'tasks.task': taskId }, {
        $set: {
            'tasks.$.is_completed': true,
            'tasks.$.completed_at': new Date(),
        },
    });
    yield maybeAutoCompleteShift(shift._id);
    return shift_model_1.Shift.findById(shift._id);
});
exports.markShiftTaskComplete = markShiftTaskComplete;
/**
 * If every task on the shift is now is_completed, auto-advances the shift's
 * own status to 'completed' — atomically, and only from
 * 'upcoming'/'in_progress' (never re-triggers, and never revives a cancelled
 * shift). A shift with no tasks at all never auto-completes this way, since
 * there's nothing to judge completion by.
 */
const maybeAutoCompleteShift = (shiftId) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield shift_model_1.Shift.findById(shiftId)
        .select('tasks status cleaning_plan')
        .lean();
    if (!shift || !shift.tasks.length)
        return;
    const allTasksCompleted = shift.tasks.every((t) => t.is_completed);
    if (!allTasksCompleted)
        return;
    const updateResult = yield shift_model_1.Shift.updateOne({ _id: shiftId, status: { $in: ['upcoming', 'in_progress'] } }, { $set: { status: 'completed' } });
    // Only the caller that actually flips the status fires the event — a
    // shift already 'completed' (e.g. this ran again after another task
    // update) must not re-notify everyone.
    if (updateResult.modifiedCount > 0) {
        const plan = yield cleaning_plan_model_1.CleaningPlan.findById(shift.cleaning_plan)
            .select('client')
            .lean();
        if (plan) {
            (0, eventEmitter_1.emitAppEvent)('shift.completed', {
                shiftId: shiftId.toString(),
                planId: shift.cleaning_plan.toString(),
                clientId: plan.client.toString(),
            });
        }
    }
});
const GEOFENCE_RADIUS_METERS = 50;
/**
 * Shared lookup + eligibility check for check-in/check-out. A worker is only
 * ever assigned once a manager has staffed that date's shift (see
 * assignWorkersToShift), so the shift is guaranteed to already exist by the
 * time a genuinely-assigned worker calls this — a plain lookup, not an
 * auto-materializing one.
 */
const findAssignedShiftOrThrow = (workerId, planId, date) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield getShiftOrThrow(planId, date);
    const workerIndex = shift.assigned_workers.findIndex((aw) => aw.worker.toString() === workerId);
    if (workerIndex === -1) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'You are not assigned to this shift');
    }
    return { shift, workerIndex };
});
/**
 * Validates the worker's submitted GPS position against the shift's frozen
 * location snapshot. No time-window restriction — valid any time on the
 * shift's date, only distance is enforced. A location with no configured
 * coordinates always fails closed (geofencing can't be skipped silently).
 */
const assertWithinGeofence = (shift, coordinates) => {
    if (!shift.location.coordinates) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This location has no GPS coordinates configured; check-in cannot be validated');
    }
    const distance = (0, geo_util_1.haversineDistanceMeters)(coordinates, shift.location.coordinates.coordinates);
    if (distance > GEOFENCE_RADIUS_METERS) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `You must be within ${GEOFENCE_RADIUS_METERS}m of the location to check in (currently ${Math.round(distance)}m away)`);
    }
};
const checkInToShift = (workerId, planId, date, coordinates) => __awaiter(void 0, void 0, void 0, function* () {
    const { shift, workerIndex } = yield findAssignedShiftOrThrow(workerId, planId, date);
    assertWithinGeofence(shift, coordinates);
    if (shift.assigned_workers[workerIndex].check_in_at) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Already checked in for this shift');
    }
    // $elemMatch ties both conditions to the SAME array entry (a plain
    // dot-path pair on an array can match across different elements) and
    // makes the "not already checked in" check part of the atomic write
    // itself — not just the read above — so two concurrent check-ins from
    // the same worker can never both succeed.
    const checkedInAt = new Date();
    const result = yield shift_model_1.Shift.findOneAndUpdate({
        _id: shift._id,
        assigned_workers: { $elemMatch: { worker: workerId, check_in_at: null } },
    }, {
        $set: {
            'assigned_workers.$.check_in_at': checkedInAt,
            'assigned_workers.$.check_in_coordinates': coordinates,
        },
    }, { new: true });
    if (!result) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Already checked in for this shift');
    }
    (0, eventEmitter_1.emitAppEvent)('shift.checked_in', {
        shiftId: shift._id.toString(),
        planId,
        workerId,
        at: checkedInAt,
    });
    // The first check-in on the shift moves it out of "upcoming". Gated on
    // the shift's CURRENT status (not just "any check-in happened") so a
    // later worker checking in doesn't reopen an already completed/cancelled
    // shift, and gated atomically (status: 'upcoming' in the filter) so two
    // workers' first check-ins racing each other can't double-transition it.
    if (result.status === 'upcoming') {
        const updated = yield shift_model_1.Shift.findOneAndUpdate({ _id: shift._id, status: 'upcoming' }, { $set: { status: 'in_progress' } }, { new: true });
        if (updated)
            return updated;
    }
    return result;
});
exports.checkInToShift = checkInToShift;
const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;
/**
 * A worker leaving the shift. Anyone but the last one out can check out any
 * time once they've checked in — tasks don't have to be finished, since a
 * worker may have completed their own part, or been swapped out, while
 * others are still working. Only the LAST worker still on-site is gated on
 * the shift actually being done (every task's required photos uploaded —
 * see maybeAutoCompleteShift): the whole crew can't be marked "left" while
 * work remains unfinished and unattended.
 *
 * Pay is NOT credited per individual checkout. It's settled once, for
 * everyone, the moment the last person checks out — at that point the
 * final crew size is known, so shift.duration_minutes is split evenly
 * across every worker who actually checked in (a worker never removed from
 * the roster but who never showed up doesn't dilute anyone's share; a
 * worker removed from the roster via assignWorkersToShift after checking in
 * forfeits their share by design — see assignWorkersToShift). Settling
 * earlier, per checkout, was the old model, but it can't survive a crew
 * whose size changes mid-shift: whoever checked out first would lock in a
 * share based on a headcount that later turned out to be wrong.
 */
const checkOutFromShift = (workerId, planId, date, coordinates) => __awaiter(void 0, void 0, void 0, function* () {
    const { shift, workerIndex } = yield findAssignedShiftOrThrow(workerId, planId, date);
    assertWithinGeofence(shift, coordinates);
    const checkInAt = shift.assigned_workers[workerIndex].check_in_at;
    if (!checkInAt) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'You have not checked in for this shift yet');
    }
    if (shift.assigned_workers[workerIndex].check_out_at) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Already checked out for this shift');
    }
    const otherWorkersStillOnSite = shift.assigned_workers.filter((aw, idx) => idx !== workerIndex && aw.check_in_at && !aw.check_out_at);
    const isLastWorkerOut = otherWorkersStillOnSite.length === 0;
    if (isLastWorkerOut && shift.status !== 'completed') {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'All tasks must be completed before the last worker can check out');
    }
    const checkOutAt = new Date();
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const result = yield shift_model_1.Shift.findOneAndUpdate({
            _id: shift._id,
            assigned_workers: {
                $elemMatch: {
                    worker: workerId,
                    check_in_at: { $ne: null },
                    check_out_at: null,
                },
            },
        }, {
            $set: {
                'assigned_workers.$.check_out_at': checkOutAt,
                'assigned_workers.$.check_out_coordinates': coordinates,
            },
        }, { new: true, session });
        if (!result) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Already checked out for this shift');
        }
        // Workers who never checked in (never showed, and were never
        // removed from the roster) don't count toward the crew size and
        // don't block settlement — only people who actually worked do.
        const workersWhoWorked = result.assigned_workers.filter((aw) => aw.check_in_at);
        const everyoneSettled = workersWhoWorked.every((aw) => aw.check_out_at);
        if (everyoneSettled && workersWhoWorked.length) {
            const shareHours = result.duration_minutes / workersWhoWorked.length / 60;
            const workerIds = workersWhoWorked.map((aw) => aw.worker);
            const workerDocs = yield worker_model_1.Worker.find({ _id: { $in: workerIds } })
                .select('hourly_rate')
                .session(session);
            const rateById = new Map(workerDocs.map((w) => [w._id.toString(), w.hourly_rate]));
            const bulkOps = workersWhoWorked.flatMap((aw) => {
                const workerIdStr = aw.worker.toString();
                const hourlyRate = rateById.get(workerIdStr);
                if (hourlyRate === undefined) {
                    // Worker record vanished between check-in and
                    // settlement (deleted mid-shift) — skip paying a
                    // nonexistent account rather than fail the whole
                    // crew's settlement over it.
                    logger_1.errorLogger.warn(`checkOutFromShift: worker ${workerIdStr} missing at settlement for shift ${result._id.toString()}, skipped`);
                    return [];
                }
                const earnedAmount = roundToTwoDecimals(shareHours * hourlyRate);
                return [
                    {
                        updateOne: {
                            filter: { _id: aw.worker },
                            update: {
                                $inc: {
                                    total_earning: earnedAmount,
                                    pending_amount: earnedAmount,
                                },
                            },
                        },
                    },
                ];
            });
            if (bulkOps.length) {
                yield worker_model_1.Worker.bulkWrite(bulkOps, { session });
            }
        }
        yield session.commitTransaction();
        session.endSession();
        (0, eventEmitter_1.emitAppEvent)('shift.checked_out', {
            shiftId: shift._id.toString(),
            planId,
            workerId,
            at: checkOutAt,
        });
        return result;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
exports.checkOutFromShift = checkOutFromShift;
/**
 * Records a manager's decision on one uploaded photo.
 *
 * Deliberately does NOT reopen the task or change is_completed: the work is
 * already finished and the worker has left. The verdict is a quality record,
 * used for reporting and to decide what to bill, and it is what the AI's
 * thresholds are tuned against.
 */
/**
 * Makes an approved photo the reference for that requirement from now on.
 *
 * Showing the model a real approved photo is stronger than any written
 * description, and it is the only way a directional requirement like "left
 * photo" becomes checkable at all. Each client's own standard builds up this
 * way without anyone configuring it.
 *
 * Writes to the source Task so it carries into future shifts. The current
 * shift is left alone: its snapshot should stay as it was on the day.
 */
const promoteApprovedPhotoToReference = (taskId, title, photoUrl) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield task_model_1.Task.updateOne({ _id: new mongoose_1.Types.ObjectId(taskId) }, { $set: { 'photo_requirements.$[p].reference_image_url': photoUrl } }, { arrayFilters: [{ 'p.title': title }] });
    }
    catch (_4) {
        // A verdict must still be recorded if this fails.
    }
});
const setPhotoVerdict = (managerId, planId, date, taskId, title, verdict, note) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield getShiftOrThrow(planId, date);
    const task = shift.tasks.find((t) => t.task.toString() === taskId);
    if (!task) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Task not found on this shift');
    }
    const requirement = task.photo_requirements.find((p) => p.title === title);
    if (!requirement) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Unknown photo requirement "${title}" for this task`);
    }
    if (!requirement.is_uploaded) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'No photo has been uploaded for this requirement yet');
    }
    yield shift_model_1.Shift.updateOne({ _id: shift._id }, {
        $set: {
            'tasks.$[t].photo_requirements.$[p].manager_verdict': verdict,
            'tasks.$[t].photo_requirements.$[p].manager_verdict_by': new mongoose_1.Types.ObjectId(managerId),
            'tasks.$[t].photo_requirements.$[p].manager_verdict_at': new Date(),
            'tasks.$[t].photo_requirements.$[p].manager_note': note !== null && note !== void 0 ? note : null,
            // A decided photo leaves the queue, so it must not also be
            // picked up later by the auto-accept sweep.
            'tasks.$[t].photo_requirements.$[p].auto_accepted': false,
        },
    }, {
        arrayFilters: [
            { 't.task': new mongoose_1.Types.ObjectId(taskId) },
            { 'p.title': title },
        ],
    });
    if (verdict === 'approved' && requirement.photo_url) {
        yield promoteApprovedPhotoToReference(taskId, title, requirement.photo_url);
    }
    return shift_model_1.Shift.findById(shift._id);
});
exports.setPhotoVerdict = setPhotoVerdict;
/**
 * Queue position for one photo. The order is deliberate: a worker who could
 * not produce a usable photo after three tries, or a photo of the wrong place,
 * is more likely to be a real problem than a borderline score.
 */
const photoReviewPriority = (photo) => {
    if (photo.manager_verdict)
        return 90;
    if (photo.auto_decided)
        return 85;
    // A clean verdict settles it, however many attempts it took to get a
    // usable photo. Retries usually mean poor light or a shaky hand, not poor
    // work, and a manager should not be asked to re-check a photo the model
    // scored highly.
    if (photo.ai_status === 'passed')
        return 80;
    if (photo.forced_accept)
        return 1;
    if (photo.ai_subject_matches === false)
        return 2;
    if (photo.ai_status === 'failed')
        return 3;
    if (photo.ai_status === 'review')
        return 4;
    if (photo.audit_sampled)
        return 5;
    if (photo.ai_status === 'error' || photo.ai_status === 'pending')
        return 6;
    if (!photo.ai_status)
        return 7;
    return 8;
};
/**
 * Whether a photo still wants a human eye.
 *
 * A manager decision settles it, and so does a clean AI verdict — except when
 * the audit sampler pulled it, which is the whole point of that sample.
 */
const photoNeedsReview = (photo) => {
    if (photo.manager_verdict)
        return false;
    if (photo.auto_decided)
        return photo.audit_sampled;
    if (photo.auto_accepted)
        return false;
    if (photo.ai_status === 'passed')
        return photo.audit_sampled;
    return true;
};
/**
 * Manager-facing photo review list: one row per shift task instance that has
 * at least one uploaded photo, across shifts in the given date range
 * (default: the last 30 days through today), optionally narrowed to one
 * cleaning plan or location.
 */
const getPhotoReviewListFromDB = (params) => __awaiter(void 0, void 0, void 0, function* () {
    var _5, _6, _7, _8, _9;
    const to = (_5 = params.to) !== null && _5 !== void 0 ? _5 : new Date();
    const from = (_6 = params.from) !== null && _6 !== void 0 ? _6 : (() => {
        const d = new Date(to);
        d.setUTCDate(d.getUTCDate() - 30);
        return d;
    })();
    const filter = { date: { $gte: from, $lte: to } };
    if (params.planId)
        filter.cleaning_plan = new mongoose_1.Types.ObjectId(params.planId);
    if (params.locationId)
        filter['location.location'] = new mongoose_1.Types.ObjectId(params.locationId);
    const shifts = yield shift_model_1.Shift.find(filter)
        .select('cleaning_plan date location rooms tasks')
        .sort({ date: -1 })
        .lean();
    if (!shifts.length)
        return [];
    const planIds = [...new Set(shifts.map((s) => s.cleaning_plan.toString()))];
    const locationIds = [
        ...new Set(shifts.map((s) => s.location.location.toString())),
    ];
    const [plans, locations] = yield Promise.all([
        cleaning_plan_model_1.CleaningPlan.find({ _id: { $in: planIds } }).select('title').lean(),
        location_model_1.Location.find({ _id: { $in: locationIds } }).select('address').lean(),
    ]);
    const planTitleById = new Map(plans.map((p) => [p._id.toString(), p.title]));
    const addressById = new Map(locations.map((l) => [l._id.toString(), l.address]));
    const rows = [];
    for (const shift of shifts) {
        const roomNameByRoomId = new Map(shift.rooms.map((r) => [r.room.toString(), r.name]));
        const cleaningName = (_7 = planTitleById.get(shift.cleaning_plan.toString())) !== null && _7 !== void 0 ? _7 : '';
        const address = (_8 = addressById.get(shift.location.location.toString())) !== null && _8 !== void 0 ? _8 : null;
        for (const task of shift.tasks) {
            if (!task.is_photo_required)
                continue;
            const uploadedPhotos = task.photo_requirements
                .filter((p) => p.is_uploaded)
                .map((p) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
                return ({
                    title: p.title,
                    photo_url: p.photo_url,
                    description: (_a = p.description) !== null && _a !== void 0 ? _a : null,
                    reference_image_url: (_b = p.reference_image_url) !== null && _b !== void 0 ? _b : null,
                    ai_status: (_c = p.ai_status) !== null && _c !== void 0 ? _c : null,
                    ai_score: (_d = p.ai_score) !== null && _d !== void 0 ? _d : null,
                    ai_confidence: (_e = p.ai_confidence) !== null && _e !== void 0 ? _e : null,
                    ai_reason: (_f = p.ai_reason) !== null && _f !== void 0 ? _f : null,
                    ai_checks: (_g = p.ai_checks) !== null && _g !== void 0 ? _g : [],
                    ai_subject_matches: (_h = p.ai_subject_matches) !== null && _h !== void 0 ? _h : null,
                    ai_requirement_met: (_j = p.ai_requirement_met) !== null && _j !== void 0 ? _j : null,
                    ai_evaluated_at: (_k = p.ai_evaluated_at) !== null && _k !== void 0 ? _k : null,
                    gate_status: (_l = p.gate_status) !== null && _l !== void 0 ? _l : null,
                    gate_reason: (_m = p.gate_reason) !== null && _m !== void 0 ? _m : null,
                    attempt_count: (_o = p.attempt_count) !== null && _o !== void 0 ? _o : 0,
                    forced_accept: (_p = p.forced_accept) !== null && _p !== void 0 ? _p : false,
                    audit_sampled: (_q = p.audit_sampled) !== null && _q !== void 0 ? _q : false,
                    manager_verdict: (_r = p.manager_verdict) !== null && _r !== void 0 ? _r : null,
                    manager_verdict_at: (_s = p.manager_verdict_at) !== null && _s !== void 0 ? _s : null,
                    manager_note: (_t = p.manager_note) !== null && _t !== void 0 ? _t : null,
                    auto_decided: (_u = p.auto_decided) !== null && _u !== void 0 ? _u : false,
                    auto_decision: (_v = p.auto_decision) !== null && _v !== void 0 ? _v : null,
                    escalated_at: (_w = p.escalated_at) !== null && _w !== void 0 ? _w : null,
                    auto_accepted: (_x = p.auto_accepted) !== null && _x !== void 0 ? _x : false,
                });
            });
            if (!uploadedPhotos.length)
                continue;
            const priority = Math.min(...uploadedPhotos.map((p) => photoReviewPriority(p)));
            const needsReview = uploadedPhotos.some(photoNeedsReview);
            if (params.status === 'pending' && !needsReview)
                continue;
            if (params.status === 'decided' && needsReview)
                continue;
            rows.push({
                shift_id: shift._id.toString(),
                plan_id: shift.cleaning_plan.toString(),
                task_id: task.task.toString(),
                shift_date: shift.date,
                cleaning_name: cleaningName,
                room_name: task.room ? (_9 = roomNameByRoomId.get(task.room.toString())) !== null && _9 !== void 0 ? _9 : '' : '',
                task_name: task.name,
                duration_minutes: task.duration_minutes,
                location_name: shift.location.name,
                address,
                review_priority: priority,
                needs_review: needsReview,
                uploaded_photos: uploadedPhotos,
            });
        }
    }
    // Most urgent first, then newest. A flat list sorted only by date buries
    // the rows that actually need attention.
    rows.sort((a, b) => a.review_priority - b.review_priority ||
        b.shift_date.getTime() - a.shift_date.getTime());
    return rows;
});
exports.getPhotoReviewListFromDB = getPhotoReviewListFromDB;
const shiftServices = {
    listWorkerShiftsForDate: exports.listWorkerShiftsForDate,
    resyncTodayShiftTasksForRoomsIfDue: exports.resyncTodayShiftTasksForRoomsIfDue,
    resyncTodayShiftRoomsIfDue: exports.resyncTodayShiftRoomsIfDue,
    resyncTodayShiftAdditionalTaskIfDue: exports.resyncTodayShiftAdditionalTaskIfDue,
    reconcileFutureShiftsForTaskChange: exports.reconcileFutureShiftsForTaskChange,
    resyncFutureShiftTasksForRoomsIfDue: exports.resyncFutureShiftTasksForRoomsIfDue,
    cancelUpcomingShiftsAcrossPlans: exports.cancelUpcomingShiftsAcrossPlans,
    getShiftForDate: exports.getShiftForDate,
    listShiftsInRange: exports.listShiftsInRange,
    getClientLiveShiftsFromDB: exports.getClientLiveShiftsFromDB,
    getActiveShiftForWorker: exports.getActiveShiftForWorker,
    getWorkerTodayMetaFromDB: exports.getWorkerTodayMetaFromDB,
    getNextShiftForWorker: exports.getNextShiftForWorker,
    getTodayLiveShiftMetaFromDB: exports.getTodayLiveShiftMetaFromDB,
    getManagerReportFromDB: exports.getManagerReportFromDB,
    getTodayLiveShiftsFromDB: exports.getTodayLiveShiftsFromDB,
    getSingleLiveShiftFromDB: exports.getSingleLiveShiftFromDB,
    getWorkerPerformanceFromDB: exports.getWorkerPerformanceFromDB,
    getWorkersAttendanceSummaryFromDB: exports.getWorkersAttendanceSummaryFromDB,
    getWorkersAttendanceListFromDB: exports.getWorkersAttendanceListFromDB,
    getWorkerAttendanceSummaryFromDB: exports.getWorkerAttendanceSummaryFromDB,
    getShiftRosterFromDB: exports.getShiftRosterFromDB,
    getManagerPlanRosterFromDB: exports.getManagerPlanRosterFromDB,
    getPhotoReviewListFromDB: exports.getPhotoReviewListFromDB,
    setPhotoVerdict: exports.setPhotoVerdict,
    assignWorkersToShift: exports.assignWorkersToShift,
    listEligibleWorkersForShift: exports.listEligibleWorkersForShift,
    previewBulkAssignForWorker: exports.previewBulkAssignForWorker,
    bulkAssignWorkerToShifts: exports.bulkAssignWorkerToShifts,
    updateShiftStatus: exports.updateShiftStatus,
    uploadShiftTaskPhoto: exports.uploadShiftTaskPhoto,
    markShiftTaskComplete: exports.markShiftTaskComplete,
    checkInToShift: exports.checkInToShift,
    checkOutFromShift: exports.checkOutFromShift,
};
exports.default = shiftServices;
