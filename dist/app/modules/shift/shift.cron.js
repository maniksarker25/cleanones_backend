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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAutoCheckoutSweep = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../../shared/logger");
const shift_services_1 = require("./shift.services");
const shift_model_1 = require("./shift.model");
const HOUR_MS = 60 * 60 * 1000;
// Grace period after a shift's end_time before a still-checked-in worker counts as "forgot to check out".
const AUTO_CHECKOUT_GRACE_HOURS = Number((_a = process.env.SHIFT_AUTO_CHECKOUT_GRACE_HOURS) !== null && _a !== void 0 ? _a : 3);
/**
 * Force-checks-out stragglers so one forgotten tap doesn't block pay
 * settlement for the whole crew forever. Uses the shift's own end_time as
 * the checkout timestamp (pay is capped at each worker's share regardless)
 * and skips the live "all tasks completed" gate, since that only matters
 * for a crew still actually on site.
 */
const runAutoCheckoutSweep = () => __awaiter(void 0, void 0, void 0, function* () {
    const cutoff = new Date(Date.now() - AUTO_CHECKOUT_GRACE_HOURS * HOUR_MS);
    const strandedShifts = yield shift_model_1.Shift.find({
        status: { $ne: 'cancelled' },
        end_time: { $lte: cutoff },
        assigned_workers: {
            $elemMatch: { check_in_at: { $ne: null }, check_out_at: null },
        },
    })
        .select('_id end_time assigned_workers')
        .lean();
    let count = 0;
    for (const shift of strandedShifts) {
        const stragglers = shift.assigned_workers.filter((aw) => aw.check_in_at && !aw.check_out_at);
        for (const straggler of stragglers) {
            const session = yield mongoose_1.default.startSession();
            session.startTransaction();
            try {
                yield (0, shift_services_1.closeOutWorkerAndMaybeSettle)(shift._id, straggler.worker, shift.end_time, null, session);
                yield session.commitTransaction();
                count++;
            }
            catch (error) {
                yield session.abortTransaction();
                logger_1.errorLogger.error(`runAutoCheckoutSweep: failed to auto-checkout worker ${straggler.worker.toString()} on shift ${shift._id.toString()}`, error);
            }
            finally {
                session.endSession();
            }
        }
    }
    return count;
});
exports.runAutoCheckoutSweep = runAutoCheckoutSweep;
node_cron_1.default.schedule('*/30 * * * *', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const count = yield (0, exports.runAutoCheckoutSweep)();
        if (count > 0)
            console.log(`[shift] auto-checkout: ${count} worker(s) closed out`);
    }
    catch (error) {
        console.error('[shift] auto-checkout sweep failed', error);
    }
}));
