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
/**
 * One-off migration: Worker gained total_working_hours, total_paid_hours and
 * total_unpaid_hours (see worker.model.ts). They are kept in lockstep with
 * total_earning / total_paid going forward (shift check-out and invoice
 * creation), so existing workers need them seeded once.
 *
 * - total_working_hours: credited hours across ALL of the worker's shifts
 *   (calcWorkedMs, the same hours settlePayForWorker used at check-out).
 *   Cancelled shifts are included on purpose: the earning for a shift is
 *   credited at check-out and never reversed, so hours must match the money.
 * - total_paid_hours / total_unpaid_hours: split in the same ratio as money,
 *   i.e. paid = working * total_paid / total_earning. Old invoices carry no
 *   hours, and this matches how new invoices settle hours (proportionally).
 *
 * Idempotent: only touches workers that do not have total_working_hours yet.
 * Run it right after deploying: once a worker checks out on the new code, $inc
 * creates the field and that worker would be skipped here (and under-counted).
 *
 * Run with: npx ts-node src/scripts/backfill-worker-hours.ts
 * Preview only, no writes: add --dry-run
 */
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../app/config"));
const shift_shared_util_1 = require("../app/modules/shift/shift.shared.util");
const shift_model_1 = require("../app/modules/shift/shift.model");
const worker_model_1 = require("../app/modules/worker/worker.model");
const DRY_RUN = process.argv.includes('--dry-run');
function main() {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(config_1.default.database_url);
        console.log(`DB connected${DRY_RUN ? ' (dry run — no writes will be made)' : ''}`);
        const workers = yield worker_model_1.Worker.find({
            total_working_hours: { $exists: false },
        })
            .select('total_earning total_paid')
            .lean();
        console.log(`${workers.length} worker(s) to backfill`);
        if (!workers.length) {
            yield mongoose_1.default.disconnect();
            return;
        }
        const msByWorker = new Map();
        const shifts = yield shift_model_1.Shift.find({
            'assigned_workers.check_out_at': { $ne: null },
        })
            .select('duration_minutes assigned_workers.worker assigned_workers.check_in_at assigned_workers.check_out_at')
            .lean();
        for (const shift of shifts) {
            const count = shift.assigned_workers.length;
            for (const entry of shift.assigned_workers) {
                const ms = (0, shift_shared_util_1.calcWorkedMs)(entry, shift.duration_minutes, count);
                if (ms <= 0)
                    continue;
                const id = entry.worker.toString();
                msByWorker.set(id, ((_a = msByWorker.get(id)) !== null && _a !== void 0 ? _a : 0) + ms);
            }
        }
        let updated = 0;
        for (const worker of workers) {
            const working = (0, shift_shared_util_1.roundToTwoDecimals)(((_b = msByWorker.get(worker._id.toString())) !== null && _b !== void 0 ? _b : 0) / shift_shared_util_1.MS_PER_HOUR);
            const earning = (_c = worker.total_earning) !== null && _c !== void 0 ? _c : 0;
            const paidRatio = earning > 0 ? Math.min(((_d = worker.total_paid) !== null && _d !== void 0 ? _d : 0) / earning, 1) : 0;
            const paid = (0, shift_shared_util_1.roundToTwoDecimals)(working * paidRatio);
            const unpaid = (0, shift_shared_util_1.roundToTwoDecimals)(working - paid);
            console.log(`${worker._id.toString()}: working=${working} paid=${paid} unpaid=${unpaid}`);
            if (!DRY_RUN) {
                yield worker_model_1.Worker.updateOne({
                    _id: worker._id,
                    total_working_hours: { $exists: false },
                }, {
                    $set: {
                        total_working_hours: working,
                        total_paid_hours: paid,
                        total_unpaid_hours: unpaid,
                    },
                });
            }
            updated++;
        }
        console.log(`${DRY_RUN ? 'Would update' : 'Updated'} ${updated} worker(s)`);
        yield mongoose_1.default.disconnect();
    });
}
main().catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
});
