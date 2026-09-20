import cron from 'node-cron';
import { Types } from 'mongoose';
import { Shift } from '../shift/shift.model';
import { photoAiConfig } from './photo_ai.config';
import { PhotoAiService } from './photo_ai.service';

const HOUR_MS = 60 * 60 * 1000;

const ESCALATE_AFTER_HOURS = Number(process.env.PHOTO_AI_ESCALATE_HOURS ?? 48);

const AUTO_ACCEPT_AFTER_DAYS = Number(process.env.PHOTO_AI_AUTO_ACCEPT_DAYS ?? 7);

type RequirementHit = {
    shiftId: Types.ObjectId;
    taskId: Types.ObjectId;
    title: string;
};

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

export const runEscalationSweep = async (): Promise<number> => {
    const cutoff = new Date(Date.now() - ESCALATE_AFTER_HOURS * HOUR_MS);
    const hits = await findUnreviewed(cutoff, (r) => !r.escalated_at);
    for (const hit of hits) {
        await setOnRequirement(hit, { escalated_at: new Date() });
    }
    return hits.length;
};

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

cron.schedule('7 * * * *', () => guard('escalation', runEscalationSweep));

cron.schedule('10 3 * * *', () => guard('auto-accept', runAutoAcceptSweep));

cron.schedule('*/20 * * * *', () => guard('pending-retry', runPendingRetrySweep));

export const photoAiCrons = {
    runEscalationSweep,
    runAutoAcceptSweep,
    runPendingRetrySweep,
};
