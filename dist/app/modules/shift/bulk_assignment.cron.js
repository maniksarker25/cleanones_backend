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
exports.runBulkAssignReminderSweep = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("../../shared/logger");
const availability_util_1 = require("../cleaning_plan/availability.util");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const notification_enum_1 = require("../notification/notification.enum");
const notification_services_1 = __importDefault(require("../notification/notification.services"));
const worker_model_1 = require("../worker/worker.model");
const bulk_assignment_model_1 = require("./bulk_assignment.model");
const DAY_MS = 24 * 60 * 60 * 1000;
// Days before a bulk-assign's last date at which the manager is reminded.
const REMINDER_DAYS = [7, 4];
const REMINDER_FIELD = {
    7: 'reminder_7d_sent_at',
    4: 'reminder_4d_sent_at',
};
/**
 * Reminds the plan's manager that a bulk-assign is about to run out, so they
 * can bulk-assign again. One notification per bulk-assign (plan-specific).
 * Uses `to <= today + N` plus a sent-at marker, so a missed cron run (server
 * down) still sends the reminder the next day instead of skipping it.
 */
const runBulkAssignReminderSweep = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const today = (0, availability_util_1.normalizeToUTCDateOnly)(new Date());
    let sent = 0;
    // Check the nearer deadline first so a bulk-assign that's already inside
    // 4 days gets only the 4-day reminder, not both on the same run.
    for (const days of [...REMINDER_DAYS].sort((a, b) => a - b)) {
        const field = REMINDER_FIELD[days];
        const limit = new Date(today.getTime() + days * DAY_MS);
        const due = yield bulk_assignment_model_1.BulkAssignment.find({
            renewed_by: null,
            to: { $gte: today, $lte: limit },
            [field]: null,
        }).lean();
        for (const record of due) {
            try {
                // Don't send the 7-day reminder if the 4-day one is already out.
                if (days === 7 && record.reminder_4d_sent_at)
                    continue;
                const [plan, worker] = yield Promise.all([
                    cleaning_plan_model_1.CleaningPlan.findById(record.cleaning_plan).select('title manager').lean(),
                    worker_model_1.Worker.findById(record.worker).select('name').lean(),
                ]);
                // Plan deleted — nothing left to renew.
                if (!plan) {
                    yield bulk_assignment_model_1.BulkAssignment.updateOne({ _id: record._id }, { [field]: new Date() });
                    continue;
                }
                const daysLeft = Math.round((record.to.getTime() - today.getTime()) / DAY_MS);
                const lastDate = record.to.toISOString().slice(0, 10);
                const workerName = (_a = worker === null || worker === void 0 ? void 0 : worker.name) !== null && _a !== void 0 ? _a : 'the worker';
                yield notification_services_1.default.sendNotification({
                    receiver: ((_b = plan.manager) !== null && _b !== void 0 ? _b : record.manager).toString(),
                    title: 'Bulk assignment ending soon',
                    message: daysLeft <= 0
                        ? `The bulk assignment of ${workerName} for "${plan.title}" ends today (${lastDate}). Please bulk assign again.`
                        : `The bulk assignment of ${workerName} for "${plan.title}" ends in ${daysLeft} day(s) (${lastDate}). Please bulk assign again.`,
                    type: notification_enum_1.ENUM_NOTIFICATION_TYPE.BULK_ASSIGN_EXPIRING,
                    entity: notification_enum_1.NOTIFICATION_ENTITY.CLEANING_PLAN,
                    entityId: record.cleaning_plan.toString(),
                    meta: {
                        planId: record.cleaning_plan.toString(),
                        workerId: record.worker.toString(),
                        lastDate,
                        daysLeft,
                    },
                });
                yield bulk_assignment_model_1.BulkAssignment.updateOne({ _id: record._id }, { [field]: new Date() });
                sent += 1;
            }
            catch (error) {
                logger_1.errorLogger.error(`runBulkAssignReminderSweep: failed for bulk assignment ${record._id.toString()}`, error);
            }
        }
    }
    return sent;
});
exports.runBulkAssignReminderSweep = runBulkAssignReminderSweep;
// Daily at 08:00 server time.
node_cron_1.default.schedule('0 8 * * *', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const count = yield (0, exports.runBulkAssignReminderSweep)();
        if (count > 0)
            console.log(`[bulk-assign] sent ${count} expiry reminder(s)`);
    }
    catch (error) {
        console.error('[bulk-assign] reminder sweep failed', error);
    }
}));
