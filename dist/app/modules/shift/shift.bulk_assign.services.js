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
exports.bulkAssignWorkerToShifts = exports.previewBulkAssignForWorker = exports.MAX_BULK_ASSIGN_RANGE_DAYS = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importStar(require("mongoose"));
const appError_1 = __importDefault(require("../../error/appError"));
const logger_1 = require("../../shared/logger");
const availability_util_1 = require("../cleaning_plan/availability.util");
const worker_eligibility_util_1 = require("../worker/worker.eligibility.util");
const worker_model_1 = require("../worker/worker.model");
const bulk_assignment_model_1 = require("./bulk_assignment.model");
const shift_model_1 = require("./shift.model");
const shift_services_1 = require("./shift.services");
const shift_query_services_1 = require("./shift.query.services");
const shift_shared_util_1 = require("./shift.shared.util");
// Caps how far a bulk-assign preview/confirm can span, so neither walk is unbounded.
// 62 so a full 2-month range always fits. Keep in sync with MAX_BULK_ASSIGN_DATES in shift.validation.ts.
exports.MAX_BULK_ASSIGN_RANGE_DAYS = 62;
// A due date with nobody covering it: virtual, cancelled, or an empty crew.
const isUnstaffedGap = (entry) => entry.is_virtual || entry.status === 'cancelled' || entry.assigned_workers.length === 0;
/**
 * Read-only preview for bulk-assign: splits this plan's still-unstaffed
 * dates in [from, to] by whether the worker's own working_days covers them.
 */
const previewBulkAssignForWorker = (planId, workerId, from, to) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
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
    yield (0, worker_eligibility_util_1.assertWorkersEligible)([workerId]);
    const worker = yield worker_model_1.Worker.findById(workerId).select('name working_days').lean();
    if (!worker) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker not found');
    }
    const workingDays = new Set((_a = worker.working_days) !== null && _a !== void 0 ? _a : []);
    const shiftEntries = (yield (0, shift_query_services_1.listShiftsInRange)(planId, fromDay, toDay));
    const matching_dates = [];
    const other_gap_dates = [];
    let already_covered_count = 0;
    for (const entry of shiftEntries) {
        if (!isUnstaffedGap(entry)) {
            already_covered_count += 1;
            continue;
        }
        const weekday = shift_shared_util_1.FULL_WEEKDAY_NAMES[entry.date.getUTCDay()];
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
 * Saves the bulk-assign so the reminder cron knows when it runs out, and marks
 * any earlier un-renewed bulk-assign for the same plan+worker as renewed
 * (this one starts after its last date), which stops its reminders.
 */
const recordBulkAssignment = (managerId, planId, workerId, assignedDates) => __awaiter(void 0, void 0, void 0, function* () {
    const sorted = [...assignedDates].sort();
    const from = new Date(sorted[0]);
    const to = new Date(sorted[sorted.length - 1]);
    const record = yield bulk_assignment_model_1.BulkAssignment.create({
        cleaning_plan: planId,
        worker: workerId,
        manager: managerId,
        from,
        to,
    });
    yield bulk_assignment_model_1.BulkAssignment.updateMany({
        _id: { $ne: record._id },
        cleaning_plan: planId,
        worker: workerId,
        renewed_by: null,
        to: { $lt: to },
    }, { renewed_by: record._id });
});
/**
 * Write side of bulk-assign: stages the worker onto every still-unstaffed
 * date, delegating each one to assignWorkersToShift so eligibility checks
 * and notifications behave the same as a single manual assign. Best-effort,
 * not all-or-nothing — a scheduling conflict is skipped (not a failure)
 * unless `force` is set, in which case it's assigned anyway.
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
    const coveredDateKeys = new Set(existingShifts
        .filter((s) => !isUnstaffedGap(Object.assign(Object.assign({}, s), { is_virtual: false })))
        .map((s) => s.date.toISOString()));
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
            yield (0, shift_services_1.assignWorkersToShift)(managerId, planId, date, [{ worker: new mongoose_1.Types.ObjectId(workerId), role }], (0, availability_util_1.combineDateWithTimeOfDay)(date, startTime), (0, availability_util_1.combineDateWithTimeOfDay)(date, endTime), force);
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
                // One bad date (e.g. a DB hiccup) shouldn't fail the whole batch.
                logger_1.errorLogger.error(`bulkAssignWorkerToShifts: unexpected error assigning ${planId}/${dateLabel}`, error);
                outcome.failed.push({
                    date: dateLabel,
                    message: 'Unexpected error while assigning this date — please retry.',
                });
            }
        }
    }
    if (outcome.assigned.length > 0) {
        try {
            yield recordBulkAssignment(managerId, planId, workerId, outcome.assigned);
        }
        catch (error) {
            // The shifts are already created; a failed bookkeeping write must not fail the request.
            logger_1.errorLogger.error(`bulkAssignWorkerToShifts: failed to record bulk assignment ${planId}`, error);
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
