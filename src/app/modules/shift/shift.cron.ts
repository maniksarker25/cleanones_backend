import cron from 'node-cron';
import { anyPatternOccursOnDate, normalizeToUTCDateOnly } from '../cleaning_plan/availability.util';
import { loadTaskPatterns } from '../cleaning_plan/cleaning_plan.availability.services';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { getOrCreateShift } from './shift.services';

/**
 * Materializes today's shift for every active plan that occurs today.
 * Idempotent by construction (getOrCreateShift + the unique cleaning_plan+date
 * index) — a plan a manager already touched for today is silently skipped.
 */
export const materializeTodaysShifts = async () => {
    const today = normalizeToUTCDateOnly(new Date());

    const plans = await CleaningPlan.find({
        is_active: true,
        status: { $ne: 'completed' },
    })
        .select('rooms date_time end_date')
        .lean();

    let created = 0;
    for (const plan of plans) {
        try {
            const patterns = await loadTaskPatterns(
                plan.rooms ?? [],
                plan.date_time,
                plan.end_date ?? null
            );
            if (!anyPatternOccursOnDate(patterns, today)) continue;

            await getOrCreateShift(plan._id, today);
            created += 1;
        } catch (error) {
            console.error(
                `Shift materialization failed for plan ${plan._id}:`,
                error
            );
        }
    }
    return created;
};

// Runs every 2 hours (not just once at midnight) materializing today's
// occurrences for every plan whose rooms' tasks recur on this date. Safe to
// run this often: getOrCreateShift + the unique cleaning_plan+date index make
// every run a no-op for plans already materialized. Running more frequently
// is pure resilience — if the server is down (or mid-deploy) at the midnight
// run, the next run within 2 hours catches up instead of leaving that day's
// shifts unmaterialized until someone happens to touch the plan.
cron.schedule('5 */2 * * *', async () => {
    try {
        console.log('Shift materialization cron started');
        const created = await materializeTodaysShifts();
        console.log(`Shift materialization done. Processed: ${created}`);
    } catch (error) {
        console.error('Shift materialization cron failed:', error);
    }
});
