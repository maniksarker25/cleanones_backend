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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlanGroupedRosterFromDB = exports.resyncTodayShiftAdditionalTaskIfDue = exports.resyncTodayShiftLocationIfDue = exports.resyncFutureShiftTasksForRoomsIfDue = exports.cancelUpcomingShiftsAcrossPlans = exports.reconcileFutureShiftsForTaskChange = exports.resyncTodayShiftRoomsIfDue = exports.resyncTodayShiftTasksForRoomsIfDue = exports.checkOutFromShift = exports.closeOutWorkerAndMaybeSettle = exports.checkInToShift = exports.markShiftTaskComplete = exports.uploadShiftTaskPhoto = exports.updateShiftStatus = exports.listEligibleWorkersForShift = exports.assignWorkersToShift = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importStar(require("mongoose"));
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const logger_1 = require("../../shared/logger");
const availability_util_1 = require("../cleaning_plan/availability.util");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const worker_eligibility_util_1 = require("../worker/worker.eligibility.util");
const worker_model_1 = require("../worker/worker.model");
const chat_services_1 = __importDefault(require("../chat/chat.services"));
const geo_util_1 = require("./geo.util");
const shift_availability_services_1 = require("./shift.availability.services");
const photo_ai_config_1 = require("../photo_ai/photo_ai.config");
const photo_ai_service_1 = require("../photo_ai/photo_ai.service");
const shift_model_1 = require("./shift.model");
const shift_snapshot_util_1 = require("./shift.snapshot.util");
const shift_shared_util_1 = require("./shift.shared.util");
const MONGO_DUPLICATE_KEY_ERROR = 11000;
const isDuplicateKeyError = (error) => !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === MONGO_DUPLICATE_KEY_ERROR;
/**
 * Loads the existing Shift for (planId, date), or creates one snapshotted
 * from the plan's current state. Throws if the plan doesn't occur on this
 * date. Race-safe: the loser of a concurrent create just refetches the winner.
 */
const getOrCreateBareShift = (planId, date) => __awaiter(void 0, void 0, void 0, function* () {
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const existing = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day });
    if (existing)
        return existing;
    const plan = yield (0, shift_shared_util_1.ensureActivePlan)(planId);
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
            // Placeholder — assignWorkersToShift sets the real schedule right after.
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
            // Lost the race — use the winner's document.
            const winner = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day });
            if (winner)
                return winner;
        }
        throw error;
    }
});
/**
 * The staffing action: schedules a crew for a due date, and also how a
 * manager swaps the crew mid-shift (no-show replaced, worker pulled sick).
 * Every call after the first MERGES against the existing crew — a worker
 * already on the list keeps their check-in/out state (only role changes);
 * dropping and re-adding never corrupts attendance or pay. Only newly added
 * workers get (re-)validated for eligibility/conflicts. The start/end time
 * only applies while the shift is still 'upcoming' — once it's started, the
 * schedule is locked so pay math can't shift under an already-working crew.
 */
const assignWorkersToShift = (managerId, planId, date, assignedWorkers, startTime, endTime, force) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!(endTime > startTime)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'end_time must be after start_time');
    }
    const shift = yield getOrCreateBareShift(planId, date);
    const shiftHasStarted = shift.status === 'in_progress' || shift.status === 'completed';
    const existingByWorkerId = new Map(shift.assigned_workers.map((aw) => [aw.worker.toString(), aw]));
    // Only genuinely new workers need (re-)validating.
    const newlyAddedWorkers = assignedWorkers.filter((aw) => !existingByWorkerId.has(aw.worker.toString()));
    if (newlyAddedWorkers.length) {
        yield (0, worker_eligibility_util_1.assertWorkersEligible)(newlyAddedWorkers.map((aw) => aw.worker));
    }
    // Once started, conflict-check against the real committed window, not the caller's params.
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
    const previousWorkerIds = [...existingByWorkerId.keys()];
    const nextAssignedWorkers = assignedWorkers.map((aw) => {
        var _a, _b, _c, _d;
        const workerIdStr = aw.worker.toString();
        const existing = existingByWorkerId.get(workerIdStr);
        if (existing) {
            // Attendance state is never rewritten by a roster edit — only role is editable.
            return {
                worker: existing.worker,
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
    const planTitle = (_a = plan === null || plan === void 0 ? void 0 : plan.title) !== null && _a !== void 0 ? _a : '';
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
    // Chat group membership accumulates — never auto-removed when a crew rotates.
    if (addedWorkerIds.length) {
        const currentGroupWorkerIds = yield chat_services_1.default.getChatGroupWorkerIds(planId);
        const unionWorkerIds = [
            ...new Set([...currentGroupWorkerIds, ...addedWorkerIds]),
        ];
        yield chat_services_1.default.syncChatGroupWorkers(planId, unionWorkerIds);
    }
    const [resultWithNames] = yield (0, shift_shared_util_1.attachWorkerNames)([result.toObject()]);
    return resultWithNames;
});
exports.assignWorkersToShift = assignWorkersToShift;
/**
 * Worker picker for staffing one due date: every active, eligible worker,
 * annotated with weekday availability and whether this window would
 * double-book them. Pure preview — nothing written, nothing blocked here.
 */
const listEligibleWorkersForShift = (planId, date, startTime, endTime) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d;
    if (!(endTime > startTime)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'end_time must be after start_time');
    }
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const plan = yield (0, shift_shared_util_1.ensureActivePlan)(planId);
    const snapshot = yield (0, shift_snapshot_util_1.buildShiftSnapshot)(plan);
    if (!(0, availability_util_1.anyPatternOccursOnDate)(snapshot.patterns, day)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This cleaning plan has no occurrence on the given date');
    }
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
    const weekdayName = shift_shared_util_1.FULL_WEEKDAY_NAMES[day.getUTCDay()];
    // Excludes this shift itself — reassigning a worker to it is never a conflict.
    const existingShift = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day })
        .select('_id')
        .lean();
    const allWorkers = yield worker_model_1.Worker.find(worker_eligibility_util_1.activeWorkerFilter).lean();
    const eligibleWorkers = yield (0, worker_eligibility_util_1.filterEligibleWorkers)(allWorkers);
    const results = [];
    for (const worker of eligibleWorkers) {
        const workingDays = (_b = worker.working_days) !== null && _b !== void 0 ? _b : [];
        const isAvailable = workingDays.includes(weekdayName);
        const conflict = yield (0, shift_availability_services_1.findWorkerConflictOnDate)(worker._id, day, startTime, durationMinutes, { shiftId: existingShift === null || existingShift === void 0 ? void 0 : existingShift._id });
        results.push({
            worker,
            is_available: isAvailable,
            is_conflict: !!conflict,
            conflict_reason: (_c = conflict === null || conflict === void 0 ? void 0 : conflict.reason) !== null && _c !== void 0 ? _c : null,
            conflicting_plan_id: (_d = conflict === null || conflict === void 0 ? void 0 : conflict.conflicting_plan_id) !== null && _d !== void 0 ? _d : null,
        });
    }
    return results;
});
exports.listEligibleWorkersForShift = listEligibleWorkersForShift;
const updateShiftStatus = (managerId, planId, date, status) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield (0, shift_shared_util_1.getShiftOrThrow)(planId, date);
    const result = yield shift_model_1.Shift.findByIdAndUpdate(shift._id, { status, last_updated_by: managerId }, { new: true, runValidators: true });
    return result;
});
exports.updateShiftStatus = updateShiftStatus;
/**
 * Perceptual hashes to check a new photo against, split by strictness: only
 * an exact match across days means a reused file (same room photographed
 * daily is naturally near-identical), but within one shift even a near-match
 * means the same photo was submitted for two requirements.
 */
const collectRoomPhotoHashes = (roomId, shiftId) => __awaiter(void 0, void 0, void 0, function* () {
    var _e, _f, _g, _h, _j;
    const sameShift = [];
    const otherShifts = [];
    const current = yield shift_model_1.Shift.findById(shiftId)
        .select('tasks.photo_requirements.phash')
        .lean();
    for (const task of (_e = current === null || current === void 0 ? void 0 : current.tasks) !== null && _e !== void 0 ? _e : []) {
        for (const requirement of (_f = task.photo_requirements) !== null && _f !== void 0 ? _f : []) {
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
        for (const task of (_g = shift.tasks) !== null && _g !== void 0 ? _g : []) {
            if (((_h = task.room) === null || _h === void 0 ? void 0 : _h.toString()) !== roomId.toString())
                continue;
            for (const requirement of (_j = task.photo_requirements) !== null && _j !== void 0 ? _j : []) {
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
 * Records a worker's photo submission for one task. is_completed recomputes
 * automatically from photo requirements — no manual complete step for
 * photo-required tasks. Non-photo tasks use markShiftTaskComplete instead.
 */
const uploadShiftTaskPhoto = (workerId, planId, date, taskId, title, photoUrl) => __awaiter(void 0, void 0, void 0, function* () {
    var _k, _l, _m, _o;
    const shift = yield (0, shift_shared_util_1.getShiftOrThrow)(planId, date);
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
    const attempts = ((_k = requirement === null || requirement === void 0 ? void 0 : requirement.attempt_count) !== null && _k !== void 0 ? _k : 0) + 1;
    // Photos already accepted for this room, so a resubmitted one is caught.
    const reuseCandidates = yield collectRoomPhotoHashes(shift.tasks[taskIndex].room, shift._id);
    const gate = yield photo_ai_service_1.PhotoAiService.checkPhotoByUrl(photoUrl, reuseCandidates);
    // After max_attempts, accept anyway (flagged) so a worker isn't stranded on site.
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
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, (_l = gate.reason) !== null && _l !== void 0 ? _l : 'Photo could not be accepted. Please retake.');
    }
    // Targeted write — safe under concurrent uploads to other requirements on this shift.
    yield shift_model_1.Shift.updateOne({ _id: shift._id }, {
        $set: {
            'tasks.$[t].photo_requirements.$[p].photo_url': photoUrl,
            'tasks.$[t].photo_requirements.$[p].is_uploaded': true,
            'tasks.$[t].photo_requirements.$[p].attempt_count': attempts,
            'tasks.$[t].photo_requirements.$[p].forced_accept': forced,
            'tasks.$[t].photo_requirements.$[p].gate_status': gate.status,
            'tasks.$[t].photo_requirements.$[p].gate_reason': (_m = gate.reason) !== null && _m !== void 0 ? _m : null,
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
    // Recomputed from a fresh read, not assumed from this single write.
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
    yield (0, shift_shared_util_1.maybeAutoCompleteShift)(shift._id);
    // Not awaited — only adds flags for the manager's review queue.
    const roomId = (_o = shift.tasks[taskIndex].room) === null || _o === void 0 ? void 0 : _o.toString();
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
    const shift = yield (0, shift_shared_util_1.getShiftOrThrow)(planId, date);
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
    yield (0, shift_shared_util_1.maybeAutoCompleteShift)(shift._id);
    return shift_model_1.Shift.findById(shift._id);
});
exports.markShiftTaskComplete = markShiftTaskComplete;
const GEOFENCE_RADIUS_METERS = 50;
// Shared lookup + eligibility check for check-in/check-out.
const findAssignedShiftOrThrow = (workerId, planId, date) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield (0, shift_shared_util_1.getShiftOrThrow)(planId, date);
    const workerIndex = shift.assigned_workers.findIndex((aw) => aw.worker.toString() === workerId);
    if (workerIndex === -1) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'You are not assigned to this shift');
    }
    return { shift, workerIndex };
});
// Validates GPS against the shift's location snapshot; fails closed if no coordinates are configured.
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
    // $elemMatch makes "not already checked in" part of the atomic write, not just the read above.
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
    // First check-in moves the shift out of 'upcoming'; the status filter keeps this race-safe and one-way.
    if (result.status === 'upcoming') {
        const updated = yield shift_model_1.Shift.findOneAndUpdate({ _id: shift._id, status: 'upcoming' }, { $set: { status: 'in_progress' } }, { new: true });
        if (updated)
            return updated;
    }
    return result;
});
exports.checkInToShift = checkInToShift;
/**
 * Pays one worker the lesser of their actual clocked time and their fixed share
 * of the shift (scheduled duration / assigned worker count, whoever shows up).
 */
const settlePayForWorker = (shift, entry, session) => __awaiter(void 0, void 0, void 0, function* () {
    const workerDoc = yield worker_model_1.Worker.findById(entry.worker).select('hourly_rate').session(session);
    if (!workerDoc) {
        // Worker record vanished mid-shift — skip paying a nonexistent account.
        logger_1.errorLogger.warn(`settlePayForWorker: worker ${entry.worker.toString()} missing at settlement for shift ${shift._id.toString()}, skipped`);
        return;
    }
    const payHours = (0, shift_shared_util_1.calcWorkedMs)(entry, shift.duration_minutes, shift.assigned_workers.length) / shift_shared_util_1.MS_PER_HOUR;
    const earnedAmount = (0, shift_shared_util_1.roundToTwoDecimals)(payHours * workerDoc.hourly_rate);
    const earnedHours = (0, shift_shared_util_1.roundToTwoDecimals)(payHours);
    if (earnedAmount <= 0)
        return;
    yield worker_model_1.Worker.updateOne({ _id: entry.worker }, {
        $inc: {
            total_earning: earnedAmount,
            pending_amount: earnedAmount,
            // Hours move in lockstep with the money so paid/unpaid hours stay derivable.
            total_working_hours: earnedHours,
            total_unpaid_hours: earnedHours,
        },
    }, { session });
});
/**
 * Marks one worker checked out and pays that worker right away. Shared by
 * checkOutFromShift and the auto-checkout cron — safe either way, since each
 * worker's check_out_at only ever transitions null -> set once, so pay is
 * never applied twice.
 */
const closeOutWorkerAndMaybeSettle = (shiftId, workerId, checkOutAt, coordinates, session) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield shift_model_1.Shift.findOneAndUpdate({
        _id: shiftId,
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
    if (!result)
        return null;
    const entry = result.assigned_workers.find((aw) => aw.worker.toString() === workerId.toString());
    if (entry)
        yield settlePayForWorker(result, entry, session);
    return result;
});
exports.closeOutWorkerAndMaybeSettle = closeOutWorkerAndMaybeSettle;
/**
 * A worker leaving the shift. Anyone but the last one out can leave any
 * time; the last one is gated on every task actually being done, so the
 * crew can't walk off mid-work. Each worker is paid at their own checkout.
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
        const result = yield (0, exports.closeOutWorkerAndMaybeSettle)(shift._id, workerId, checkOutAt, coordinates, session);
        if (!result) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Already checked out for this shift');
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
// ─── Re-exports: other modules import these by name from this file's old location ───
var shift_resync_services_1 = require("./shift.resync.services");
Object.defineProperty(exports, "resyncTodayShiftTasksForRoomsIfDue", { enumerable: true, get: function () { return shift_resync_services_1.resyncTodayShiftTasksForRoomsIfDue; } });
Object.defineProperty(exports, "resyncTodayShiftRoomsIfDue", { enumerable: true, get: function () { return shift_resync_services_1.resyncTodayShiftRoomsIfDue; } });
Object.defineProperty(exports, "reconcileFutureShiftsForTaskChange", { enumerable: true, get: function () { return shift_resync_services_1.reconcileFutureShiftsForTaskChange; } });
Object.defineProperty(exports, "cancelUpcomingShiftsAcrossPlans", { enumerable: true, get: function () { return shift_resync_services_1.cancelUpcomingShiftsAcrossPlans; } });
Object.defineProperty(exports, "resyncFutureShiftTasksForRoomsIfDue", { enumerable: true, get: function () { return shift_resync_services_1.resyncFutureShiftTasksForRoomsIfDue; } });
Object.defineProperty(exports, "resyncTodayShiftLocationIfDue", { enumerable: true, get: function () { return shift_resync_services_1.resyncTodayShiftLocationIfDue; } });
Object.defineProperty(exports, "resyncTodayShiftAdditionalTaskIfDue", { enumerable: true, get: function () { return shift_resync_services_1.resyncTodayShiftAdditionalTaskIfDue; } });
var shift_roster_services_1 = require("./shift.roster.services");
Object.defineProperty(exports, "getPlanGroupedRosterFromDB", { enumerable: true, get: function () { return shift_roster_services_1.getPlanGroupedRosterFromDB; } });
const shift_resync_services_2 = require("./shift.resync.services");
const shift_query_services_1 = require("./shift.query.services");
const shift_bulk_assign_services_1 = require("./shift.bulk_assign.services");
const shift_report_services_1 = require("./shift.report.services");
const shift_roster_services_2 = require("./shift.roster.services");
const shift_photo_review_services_1 = require("./shift.photo_review.services");
const shiftServices = {
    listWorkerShiftsForDate: shift_query_services_1.listWorkerShiftsForDate,
    resyncTodayShiftTasksForRoomsIfDue: shift_resync_services_2.resyncTodayShiftTasksForRoomsIfDue,
    resyncTodayShiftRoomsIfDue: shift_resync_services_2.resyncTodayShiftRoomsIfDue,
    resyncTodayShiftAdditionalTaskIfDue: shift_resync_services_2.resyncTodayShiftAdditionalTaskIfDue,
    reconcileFutureShiftsForTaskChange: shift_resync_services_2.reconcileFutureShiftsForTaskChange,
    resyncFutureShiftTasksForRoomsIfDue: shift_resync_services_2.resyncFutureShiftTasksForRoomsIfDue,
    cancelUpcomingShiftsAcrossPlans: shift_resync_services_2.cancelUpcomingShiftsAcrossPlans,
    getShiftForDate: shift_query_services_1.getShiftForDate,
    listShiftsInRange: shift_query_services_1.listShiftsInRange,
    getClientLiveShiftsFromDB: shift_query_services_1.getClientLiveShiftsFromDB,
    getActiveShiftForWorker: shift_query_services_1.getActiveShiftForWorker,
    getWorkerTodayMetaFromDB: shift_query_services_1.getWorkerTodayMetaFromDB,
    getNextShiftForWorker: shift_query_services_1.getNextShiftForWorker,
    getTodayLiveShiftMetaFromDB: shift_query_services_1.getTodayLiveShiftMetaFromDB,
    getManagerReportFromDB: shift_report_services_1.getManagerReportFromDB,
    getTodayLiveShiftsFromDB: shift_query_services_1.getTodayLiveShiftsFromDB,
    getSingleLiveShiftFromDB: shift_query_services_1.getSingleLiveShiftFromDB,
    getWorkerPerformanceFromDB: shift_report_services_1.getWorkerPerformanceFromDB,
    getWorkersAttendanceSummaryFromDB: shift_report_services_1.getWorkersAttendanceSummaryFromDB,
    getWorkersAttendanceListFromDB: shift_report_services_1.getWorkersAttendanceListFromDB,
    getWorkerAttendanceSummaryFromDB: shift_report_services_1.getWorkerAttendanceSummaryFromDB,
    getShiftRosterFromDB: shift_roster_services_2.getShiftRosterFromDB,
    getManagerPlanRosterFromDB: shift_roster_services_2.getManagerPlanRosterFromDB,
    getPhotoReviewListFromDB: shift_photo_review_services_1.getPhotoReviewListFromDB,
    setPhotoVerdict: shift_photo_review_services_1.setPhotoVerdict,
    assignWorkersToShift: exports.assignWorkersToShift,
    listEligibleWorkersForShift: exports.listEligibleWorkersForShift,
    previewBulkAssignForWorker: shift_bulk_assign_services_1.previewBulkAssignForWorker,
    bulkAssignWorkerToShifts: shift_bulk_assign_services_1.bulkAssignWorkerToShifts,
    updateShiftStatus: exports.updateShiftStatus,
    uploadShiftTaskPhoto: exports.uploadShiftTaskPhoto,
    markShiftTaskComplete: exports.markShiftTaskComplete,
    checkInToShift: exports.checkInToShift,
    checkOutFromShift: exports.checkOutFromShift,
};
exports.default = shiftServices;
