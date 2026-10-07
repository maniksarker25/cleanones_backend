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
import mongoose from 'mongoose';
import config from '../app/config';
import {
    calcWorkedMs,
    MS_PER_HOUR,
    roundToTwoDecimals,
} from '../app/modules/shift/shift.shared.util';
import { Shift } from '../app/modules/shift/shift.model';
import { Worker } from '../app/modules/worker/worker.model';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    await mongoose.connect(config.database_url as string);
    console.log(
        `DB connected${DRY_RUN ? ' (dry run — no writes will be made)' : ''}`
    );

    const workers = await Worker.find({
        total_working_hours: { $exists: false },
    })
        .select('total_earning total_paid')
        .lean();
    console.log(`${workers.length} worker(s) to backfill`);
    if (!workers.length) {
        await mongoose.disconnect();
        return;
    }

    const msByWorker = new Map<string, number>();
    const shifts = await Shift.find({
        'assigned_workers.check_out_at': { $ne: null },
    })
        .select(
            'duration_minutes assigned_workers.worker assigned_workers.check_in_at assigned_workers.check_out_at'
        )
        .lean();
    for (const shift of shifts) {
        const count = shift.assigned_workers.length;
        for (const entry of shift.assigned_workers) {
            const ms = calcWorkedMs(entry, shift.duration_minutes, count);
            if (ms <= 0) continue;
            const id = entry.worker.toString();
            msByWorker.set(id, (msByWorker.get(id) ?? 0) + ms);
        }
    }

    let updated = 0;
    for (const worker of workers) {
        const working = roundToTwoDecimals(
            (msByWorker.get(worker._id.toString()) ?? 0) / MS_PER_HOUR
        );
        const earning = worker.total_earning ?? 0;
        const paidRatio =
            earning > 0 ? Math.min((worker.total_paid ?? 0) / earning, 1) : 0;
        const paid = roundToTwoDecimals(working * paidRatio);
        const unpaid = roundToTwoDecimals(working - paid);

        console.log(
            `${worker._id.toString()}: working=${working} paid=${paid} unpaid=${unpaid}`
        );
        if (!DRY_RUN) {
            await Worker.updateOne(
                {
                    _id: worker._id,
                    total_working_hours: { $exists: false },
                },
                {
                    $set: {
                        total_working_hours: working,
                        total_paid_hours: paid,
                        total_unpaid_hours: unpaid,
                    },
                }
            );
        }
        updated++;
    }

    console.log(`${DRY_RUN ? 'Would update' : 'Updated'} ${updated} worker(s)`);
    await mongoose.disconnect();
}

main().catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
});
