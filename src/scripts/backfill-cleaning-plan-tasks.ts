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
import mongoose from 'mongoose';
import config from '../app/config';
import { CleaningPlan } from '../app/modules/cleaning_plan/cleaning_plan.model';
import { Task } from '../app/modules/task/task.model';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    await mongoose.connect(config.database_url as string);
    console.log(`DB connected${DRY_RUN ? ' (dry run — no writes will be made)' : ''}`);

    const plans = await CleaningPlan.find({ tasks: { $exists: false } })
        .select('rooms')
        .lean();

    console.log(`Found ${plans.length} cleaning plan(s) with no 'tasks' field yet`);

    let plansTouched = 0;
    let tasksBackfilled = 0;

    for (const plan of plans) {
        const activeTasks = await Task.find({
            room: { $in: plan.rooms ?? [] },
            is_active: true,
        })
            .select('_id')
            .lean();
        const taskIds = activeTasks.map((t) => t._id);

        if (!DRY_RUN) {
            await CleaningPlan.updateOne(
                { _id: plan._id },
                { $set: { tasks: taskIds } }
            );
        }

        plansTouched += 1;
        tasksBackfilled += taskIds.length;
    }

    console.log(
        `${DRY_RUN ? '[dry run] Would backfill' : 'Backfilled'} tasks on ${plansTouched} plan(s), ` +
            `${tasksBackfilled} task reference(s) total`
    );

    console.log(DRY_RUN ? 'Dry run complete — no changes made' : 'Migration complete');
    await mongoose.disconnect();
}

main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
