import cron from 'node-cron';
import mongoose from 'mongoose';
import { errorLogger } from '../../shared/logger';
import { closeOutWorkerAndMaybeSettle } from './shift.services';
import { Shift } from './shift.model';

const HOUR_MS = 60 * 60 * 1000;

// Grace period after a shift's end_time before a still-checked-in worker counts as "forgot to check out".
const AUTO_CHECKOUT_GRACE_HOURS = Number(
    process.env.SHIFT_AUTO_CHECKOUT_GRACE_HOURS ?? 3
);

/**
 * Force-checks-out stragglers so one forgotten tap doesn't block pay
 * settlement for the whole crew forever. Uses the shift's own end_time as
 * the checkout timestamp (pay is capped at each worker's share regardless)
 * and skips the live "all tasks completed" gate, since that only matters
 * for a crew still actually on site.
 */
export const runAutoCheckoutSweep = async (): Promise<number> => {
    const cutoff = new Date(Date.now() - AUTO_CHECKOUT_GRACE_HOURS * HOUR_MS);

    const strandedShifts = await Shift.find({
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
        const stragglers = shift.assigned_workers.filter(
            (aw) => aw.check_in_at && !aw.check_out_at
        );

        for (const straggler of stragglers) {
            const session = await mongoose.startSession();
            session.startTransaction();
            try {
                await closeOutWorkerAndMaybeSettle(
                    shift._id,
                    straggler.worker,
                    shift.end_time,
                    null,
                    session
                );
                await session.commitTransaction();
                count++;
            } catch (error) {
                await session.abortTransaction();
                errorLogger.error(
                    `runAutoCheckoutSweep: failed to auto-checkout worker ${straggler.worker.toString()} on shift ${shift._id.toString()}`,
                    error
                );
            } finally {
                session.endSession();
            }
        }
    }
    return count;
};

cron.schedule('*/30 * * * *', async () => {
    try {
        const count = await runAutoCheckoutSweep();
        if (count > 0) console.log(`[shift] auto-checkout: ${count} worker(s) closed out`);
    } catch (error) {
        console.error('[shift] auto-checkout sweep failed', error);
    }
});
