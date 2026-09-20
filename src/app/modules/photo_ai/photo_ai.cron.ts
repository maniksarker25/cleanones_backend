/**
 * Scheduled sweeps that keep the review queue finite.
 *
 * Without these the queue only grows: there is no other way for a flagged
 * photo to leave it, and a queue nobody can reach the bottom of stops being
 * read within a couple of months.
 *
 * Scheduling happens on import, matching device.service.ts.
 */
import cron from 'node-cron';
import { Types } from 'mongoose';
import { Shift } from '../shift/shift.model';
import { photoAiConfig } from './photo_ai.config';
import { PhotoAiService } from './photo_ai.service';

const HOUR_MS = 60 * 60 * 1000;

/** Hours a flagged photo may sit unreviewed before it is escalated. */
const ESCALATE_AFTER_HOURS = Number(process.env.PHOTO_AI_ESCALATE_HOURS ?? 48);
/** Days after which an unreviewed photo is accepted and leaves the queue. */
const AUTO_ACCEPT_AFTER_DAYS = Number(process.env.PHOTO_AI_AUTO_ACCEPT_DAYS ?? 7);

type RequirementHit = {
    shiftId: Types.ObjectId;
    taskId: Types.ObjectId;
    title: string;
};

/**
 * Photos still awaiting a manager decision whose evaluation is older than
 * `cutoff`. The Mongo query is a coarse filter over the shift; the per-photo
 * test runs in the loop because the array filters cannot be combined reliably
 * across sibling fields.
 */
const findUnreviewed = async (
    cutoff: Date,
    test: (requirement: Record<string, unknown>) => boolean
): Promise<RequirementHit[]> => {
    const shifts = await Shift.find({
        'tasks.photo_requirements.is_uploaded': true,
        'tasks.photo_requirements.ai_evaluated_at': { $lte: cutoff },
    })
        .select('tasks.task tasks.photo_requirements')
        .lean();

    const hits: RequirementHit[] = [];
    for (const shift of shifts) {
        for (const task of shift.tasks ?? []) {
            for (const requirement of task.photo_requirements ?? []) {
                if (!requirement.is_uploaded) continue;
                if (requirement.manager_verdict) continue;
                if (requirement.auto_accepted) continue;
                if (!requirement.ai_evaluated_at) continue;
                if (new Date(requirement.ai_evaluated_at) > cutoff) continue;
                if (!test(requirement as Record<string, unknown>)) continue;
                hits.push({
                    shiftId: shift._id,
                    taskId: task.task,
                    title: requirement.title,
                });
            }
        }
    }
    return hits;
};

const setOnRequirement = async (
    hit: RequirementHit,
    fields: Record<string, unknown>
) => {
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
        update[`tasks.$[t].photo_requirements.$[p].${key}`] = value;
    }
    await Shift.updateOne(
        { _id: hit.shiftId },
        { $set: update },
        {
            arrayFilters: [{ 't.task': hit.taskId }, { 'p.title': hit.title }],
        }
    );
};

/** D — flag anything a manager has left sitting, so it can be chased. */
export const runEscalationSweep = async (): Promise<number> => {
    const cutoff = new Date(Date.now() - ESCALATE_AFTER_HOURS * HOUR_MS);
    const hits = await findUnreviewed(cutoff, (r) => !r.escalated_at);
    for (const hit of hits) {
        await setOnRequirement(hit, { escalated_at: new Date() });
    }
    return hits.length;
};

/**
 * B — accept what nobody reviewed, and record that nobody did.
 *
 * `auto_accepted` is what makes this honest: three months from now it shows
 * how much of the queue was actually read rather than quietly expiring.
 */
export const runAutoAcceptSweep = async (): Promise<number> => {
    const cutoff = new Date(
        Date.now() - AUTO_ACCEPT_AFTER_DAYS * 24 * HOUR_MS
    );
    const hits = await findUnreviewed(cutoff, () => true);
    for (const hit of hits) {
        await setOnRequirement(hit, { auto_accepted: true });
    }
    return hits.length;
};

/**
 * Retries evaluations left pending by an outage. Past the ceiling they are
 * marked skipped: a verdict that arrives after the shift is closed and
 * invoiced helps nobody, and retrying forever just burns quota.
 */
export const runPendingRetrySweep = async (): Promise<number> => {
    const ceiling = new Date(
        Date.now() - photoAiConfig.retry.ceiling_hours * HOUR_MS
    );

    const shifts = await Shift.find({
        'tasks.photo_requirements.ai_status': 'pending',
    })
        .select('tasks rooms')
        .lean();

    let handled = 0;
    for (const shift of shifts) {
        for (const task of shift.tasks ?? []) {
            const room = shift.rooms?.find(
                (r) => r.room?.toString() === task.room?.toString()
            );
            for (const requirement of task.photo_requirements ?? []) {
                if (requirement.ai_status !== 'pending') continue;
                if (!requirement.photo_url) continue;

                const hit = {
                    shiftId: shift._id,
                    taskId: task.task,
                    title: requirement.title,
                };

                // Age is taken from the shift date because a pending photo has
                // no ai_evaluated_at yet.
                if (new Date(shift.date) < ceiling) {
                    await setOnRequirement(hit, {
                        ai_status: 'skipped',
                        ai_error: 'retry ceiling reached',
                    });
                    handled++;
                    continue;
                }

                const result = await PhotoAiService.evaluatePhoto({
                    photo_url: requirement.photo_url,
                    requirement: {
                        title: requirement.title,
                        description: requirement.description,
                        reference_image_url: requirement.reference_image_url,
                    },
                    context: {
                        room_name: room?.name,
                        room_type: room?.room_type,
                        task_name: task.name,
                    },
                });

                // Still unreachable — leave it pending for the next sweep.
                if (result.status === 'pending') continue;

                await setOnRequirement(
                    hit,
                    PhotoAiService.aiResultToFields(result) as Record<
                        string,
                        unknown
                    >
                );
                handled++;
            }
        }
    }
    return handled;
};

const guard = async (name: string, run: () => Promise<number>) => {
    try {
        const count = await run();
        if (count > 0) console.log(`[photo_ai] ${name}: ${count} updated`);
    } catch (error) {
        console.error(`[photo_ai] ${name} failed`, error);
    }
};

// Hourly: escalation is time-sensitive but not urgent to the minute.
cron.schedule('7 * * * *', () => guard('escalation', runEscalationSweep));

// Daily at 03:10, away from the shift materialisation window.
cron.schedule('10 3 * * *', () => guard('auto-accept', runAutoAcceptSweep));

// Every 20 minutes, so a short Gemini outage clears on its own.
cron.schedule('*/20 * * * *', () => guard('pending-retry', runPendingRetrySweep));

export const photoAiCrons = {
    runEscalationSweep,
    runAutoAcceptSweep,
    runPendingRetrySweep,
};
