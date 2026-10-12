import cron from 'node-cron';
import { errorLogger } from '../../shared/logger';
import { normalizeToUTCDateOnly } from '../cleaning_plan/availability.util';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { ENUM_NOTIFICATION_TYPE, NOTIFICATION_ENTITY } from '../notification/notification.enum';
import NotificationService from '../notification/notification.services';
import { Worker } from '../worker/worker.model';
import { BulkAssignment } from './bulk_assignment.model';

const DAY_MS = 24 * 60 * 60 * 1000;

// Days before a bulk-assign's last date at which the manager is reminded.
const REMINDER_DAYS = [7, 4] as const;

const REMINDER_FIELD = {
    7: 'reminder_7d_sent_at',
    4: 'reminder_4d_sent_at',
} as const;

/**
 * Reminds the plan's manager that a bulk-assign is about to run out, so they
 * can bulk-assign again. One notification per bulk-assign (plan-specific).
 * Uses `to <= today + N` plus a sent-at marker, so a missed cron run (server
 * down) still sends the reminder the next day instead of skipping it.
 */
export const runBulkAssignReminderSweep = async (): Promise<number> => {
    const today = normalizeToUTCDateOnly(new Date());
    let sent = 0;

    // Check the nearer deadline first so a bulk-assign that's already inside
    // 4 days gets only the 4-day reminder, not both on the same run.
    for (const days of [...REMINDER_DAYS].sort((a, b) => a - b)) {
        const field = REMINDER_FIELD[days];
        const limit = new Date(today.getTime() + days * DAY_MS);

        const due = await BulkAssignment.find({
            renewed_by: null,
            to: { $gte: today, $lte: limit },
            [field]: null,
        }).lean();

        for (const record of due) {
            try {
                // Don't send the 7-day reminder if the 4-day one is already out.
                if (days === 7 && record.reminder_4d_sent_at) continue;

                const [plan, worker] = await Promise.all([
                    CleaningPlan.findById(record.cleaning_plan).select('title manager').lean(),
                    Worker.findById(record.worker).select('name').lean(),
                ]);

                // Plan deleted — nothing left to renew.
                if (!plan) {
                    await BulkAssignment.updateOne({ _id: record._id }, { [field]: new Date() });
                    continue;
                }

                const daysLeft = Math.round((record.to.getTime() - today.getTime()) / DAY_MS);
                const lastDate = record.to.toISOString().slice(0, 10);
                const workerName = worker?.name ?? 'the worker';

                await NotificationService.sendNotification({
                    receiver: (plan.manager ?? record.manager).toString(),
                    title: 'Bulk assignment ending soon',
                    message:
                        daysLeft <= 0
                            ? `The bulk assignment of ${workerName} for "${plan.title}" ends today (${lastDate}). Please bulk assign again.`
                            : `The bulk assignment of ${workerName} for "${plan.title}" ends in ${daysLeft} day(s) (${lastDate}). Please bulk assign again.`,
                    type: ENUM_NOTIFICATION_TYPE.BULK_ASSIGN_EXPIRING,
                    entity: NOTIFICATION_ENTITY.CLEANING_PLAN,
                    entityId: record.cleaning_plan.toString(),
                    meta: {
                        planId: record.cleaning_plan.toString(),
                        workerId: record.worker.toString(),
                        lastDate,
                        daysLeft,
                    },
                });

                await BulkAssignment.updateOne({ _id: record._id }, { [field]: new Date() });
                sent += 1;
            } catch (error) {
                errorLogger.error(
                    `runBulkAssignReminderSweep: failed for bulk assignment ${record._id.toString()}`,
                    error
                );
            }
        }
    }
    return sent;
};

// Daily at 08:00 server time.
cron.schedule('0 8 * * *', async () => {
    try {
        const count = await runBulkAssignReminderSweep();
        if (count > 0) console.log(`[bulk-assign] sent ${count} expiry reminder(s)`);
    } catch (error) {
        console.error('[bulk-assign] reminder sweep failed', error);
    }
});
