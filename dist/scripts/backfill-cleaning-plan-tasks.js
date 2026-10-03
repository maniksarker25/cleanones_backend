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
 * One-off migration: CleaningPlan gained its own `tasks` field (the plan's
 * explicitly-selected subset of its rooms' Tasks — see
 * cleaning_plan.interface.ts and buildShiftSnapshot in
 * shift.snapshot.util.ts), replacing the old behavior of a shift pulling in
 * EVERY active task under the plan's rooms. Documents written before this
 * change have no `tasks` field at all.
 *
 * This backfills `tasks` on those plans with every currently-active task
 * under their existing `rooms` — i.e. it reproduces today's (pre-change)
 * shift-generation behavior exactly, so no existing plan's shifts change the
 * moment the new task-scoped code ships. A manager can later edit the plan
 * to narrow it down to a specific subset.
 *
 * Idempotent and safe to re-run: only touches plans where `tasks` doesn't
 * exist yet.
 *
 * MUST run after the schema/model change (`tasks` field added) is deployed,
 * and BEFORE the service-layer code that reads `plan.tasks` (buildShiftSnapshot,
 * computeSyncedShiftTasks, etc.) is deployed — otherwise any plan not yet
 * backfilled would briefly generate empty shifts.
 *
 * Run with: npx ts-node src/scripts/backfill-cleaning-plan-tasks.ts
 * Preview only, no writes: add --dry-run
 */
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../app/config"));
const cleaning_plan_model_1 = require("../app/modules/cleaning_plan/cleaning_plan.model");
const task_model_1 = require("../app/modules/task/task.model");
const DRY_RUN = process.argv.includes('--dry-run');
function main() {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(config_1.default.database_url);
        console.log(`DB connected${DRY_RUN ? ' (dry run — no writes will be made)' : ''}`);
        const plans = yield cleaning_plan_model_1.CleaningPlan.find({ tasks: { $exists: false } })
            .select('rooms')
            .lean();
        console.log(`Found ${plans.length} cleaning plan(s) with no 'tasks' field yet`);
        let plansTouched = 0;
        let tasksBackfilled = 0;
        for (const plan of plans) {
            const activeTasks = yield task_model_1.Task.find({
                room: { $in: (_a = plan.rooms) !== null && _a !== void 0 ? _a : [] },
                is_active: true,
            })
                .select('_id')
                .lean();
            const taskIds = activeTasks.map((t) => t._id);
            if (!DRY_RUN) {
                yield cleaning_plan_model_1.CleaningPlan.updateOne({ _id: plan._id }, { $set: { tasks: taskIds } });
            }
            plansTouched += 1;
            tasksBackfilled += taskIds.length;
        }
        console.log(`${DRY_RUN ? '[dry run] Would backfill' : 'Backfilled'} tasks on ${plansTouched} plan(s), ` +
            `${tasksBackfilled} task reference(s) total`);
        console.log(DRY_RUN ? 'Dry run complete — no changes made' : 'Migration complete');
        yield mongoose_1.default.disconnect();
    });
}
main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
