import { Types } from 'mongoose';
import { errorLogger } from '../../shared/logger';
import { CleaningPlan } from '../../modules/cleaning_plan/cleaning_plan.model';
import NotificationService from '../../modules/notification/notification.services';
import { Worker } from '../../modules/worker/worker.model';

type NotificationInput = Parameters<
    typeof NotificationService.sendNotification
>[0];

/**
 * Every manager owns a separate tenant, so a plan/worker event goes to the one
 * manager who owns it — never fanned out to every manager. The owner is looked
 * up from the plan or worker the event is about. If that record is gone (the
 * event outlived it) nothing is sent.
 */
const send = async (
    managerId: Types.ObjectId | string | null | undefined,
    build: (managerId: string) => NotificationInput,
    label: string
) => {
    if (!managerId) return;
    await NotificationService.sendNotification(build(managerId.toString())).catch(
        (err) => errorLogger.error(`${label} notification failed`, err)
    );
};

export const notifyPlanManager = async (
    planId: string,
    build: (managerId: string) => NotificationInput,
    label: string
) => {
    const plan = await CleaningPlan.findById(planId).select('manager').lean();
    await send(plan?.manager, build, label);
};

export const notifyWorkerManager = async (
    workerId: string,
    build: (managerId: string) => NotificationInput,
    label: string
) => {
    const worker = await Worker.findById(workerId).select('manager').lean();
    await send(worker?.manager, build, label);
};
