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
exports.maybeAutoCompleteShift = exports.getShiftOrThrow = exports.ensureActivePlan = exports.attachWorkerNames = exports.getWorkerNameMap = exports.resolveShiftEndTime = exports.calcWorkedMs = exports.MS_PER_HOUR = exports.roundToTwoDecimals = exports.FULL_WEEKDAY_NAMES = void 0;
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const availability_util_1 = require("../cleaning_plan/availability.util");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const worker_model_1 = require("../worker/worker.model");
const shift_model_1 = require("./shift.model");
exports.FULL_WEEKDAY_NAMES = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
];
const roundToTwoDecimals = (value) => Math.round(value * 100) / 100;
exports.roundToTwoDecimals = roundToTwoDecimals;
exports.MS_PER_HOUR = 3600000;
/**
 * Credited work time for one worker on one shift, in ms:
 * min(check_out - check_in, scheduled duration / assigned worker count).
 * Missing check-in/out (or an inverted pair) counts as 0. Single source of
 * truth for both pay settlement and the worker work-hours stats.
 */
const calcWorkedMs = (entry, durationMinutes, assignedWorkerCount) => {
    if (!entry.check_in_at || !entry.check_out_at)
        return 0;
    const actualMs = entry.check_out_at.getTime() - entry.check_in_at.getTime();
    if (actualMs <= 0)
        return 0;
    const shareMs = (durationMinutes * 60000) / Math.max(assignedWorkerCount, 1);
    return Math.min(actualMs, shareMs);
};
exports.calcWorkedMs = calcWorkedMs;
// end_time is required now, but shifts from before the field existed have none — fall back to date_time + duration.
const resolveShiftEndTime = (shift) => { var _a; return (_a = shift.end_time) !== null && _a !== void 0 ? _a : new Date(shift.date_time.getTime() + shift.duration_minutes * 60000); };
exports.resolveShiftEndTime = resolveShiftEndTime;
/** Current names for a set of workers, in one query. Missing/deleted workers are simply absent from the map. */
const getWorkerNameMap = (workerIds) => __awaiter(void 0, void 0, void 0, function* () {
    const uniqueIds = [...new Set(workerIds.map((id) => id.toString()))];
    if (!uniqueIds.length)
        return new Map();
    const workers = yield worker_model_1.Worker.find({ _id: { $in: uniqueIds } })
        .select('name')
        .lean();
    return new Map(workers.map((w) => [w._id.toString(), w.name]));
});
exports.getWorkerNameMap = getWorkerNameMap;
/**
 * Shifts store only the worker ref — the name lives on Worker so a rename is
 * reflected everywhere. Display paths call this to resolve each crew entry's
 * current name (batched: one Worker query for all the shifts passed in).
 */
const attachWorkerNames = (shifts) => __awaiter(void 0, void 0, void 0, function* () {
    const nameById = yield (0, exports.getWorkerNameMap)(shifts.flatMap((s) => s.assigned_workers.map((aw) => aw.worker)));
    return shifts.map((shift) => (Object.assign(Object.assign({}, shift), { assigned_workers: shift.assigned_workers.map((aw) => {
            var _a;
            return (Object.assign(Object.assign({}, aw), { name: (_a = nameById.get(aw.worker.toString())) !== null && _a !== void 0 ? _a : '' }));
        }) })));
});
exports.attachWorkerNames = attachWorkerNames;
// .lean() — every caller only reads plan fields (location, rooms, is_active,
// _id) to build a snapshot or check state; none of them save this doc back.
const ensureActivePlan = (planId) => __awaiter(void 0, void 0, void 0, function* () {
    const plan = yield cleaning_plan_model_1.CleaningPlan.findById(planId).lean();
    if (!plan)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Cleaning plan not found');
    return plan;
});
exports.ensureActivePlan = ensureActivePlan;
// A Shift only exists once a manager has staffed it — nothing auto-materializes it.
const getShiftOrThrow = (planId, date) => __awaiter(void 0, void 0, void 0, function* () {
    const day = (0, availability_util_1.normalizeToUTCDateOnly)(date);
    const shift = yield shift_model_1.Shift.findOne({ cleaning_plan: planId, date: day });
    if (!shift) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'No shift has been scheduled for this date yet');
    }
    return shift;
});
exports.getShiftOrThrow = getShiftOrThrow;
/** Auto-advances status to 'completed' once every task is done — never re-triggers or revives a cancelled shift. */
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
    // Only the call that actually flips the status fires the event.
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
exports.maybeAutoCompleteShift = maybeAutoCompleteShift;
