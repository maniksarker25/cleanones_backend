import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';

// A plan was created — let the client know, and let every worker assigned
// right at creation know they're on it.
onAppEvent('cleaning_plan.created', async (payload) => {
    const notify = [payload.clientId, ...payload.assignedWorkerIds];

    await Promise.all(
        notify.map((receiver) =>
            NotificationService.sendNotification({
                receiver,
                title: 'New cleaning plan',
                message: `A cleaning plan "${payload.title}" has been scheduled.`,
                type: ENUM_NOTIFICATION_TYPE.CLEANING_PLAN_CREATED,
                entity: NOTIFICATION_ENTITY.CLEANING_PLAN,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.planId,
                meta: { planId: payload.planId, start_date: payload.start_date },
            }).catch((err) =>
                errorLogger.error('cleaning_plan.created notification failed', err)
            )
        )
    );
});

// A worker was newly added to an existing plan (not the plan's full roster —
// see CleaningPlanWorkerAssignedPayload).
onAppEvent('cleaning_plan.worker_assigned', async (payload) => {
    await Promise.all(
        payload.addedWorkerIds.map((workerId) =>
            NotificationService.sendNotification({
                receiver: workerId,
                title: 'New cleaning plan assignment',
                message: `You've been assigned to the cleaning plan "${payload.title}".`,
                type: ENUM_NOTIFICATION_TYPE.CLEANING_PLAN_WORKER_ASSIGNED,
                entity: NOTIFICATION_ENTITY.CLEANING_PLAN,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.planId,
                meta: { planId: payload.planId, start_date: payload.start_date },
            }).catch((err) =>
                errorLogger.error(
                    'cleaning_plan.worker_assigned notification failed',
                    err
                )
            )
        )
    );
});

// A worker was taken off an existing plan.
onAppEvent('cleaning_plan.worker_removed', async (payload) => {
    await Promise.all(
        payload.removedWorkerIds.map((workerId) =>
            NotificationService.sendNotification({
                receiver: workerId,
                title: 'Removed from cleaning plan',
                message: `You've been removed from the cleaning plan "${payload.title}".`,
                type: ENUM_NOTIFICATION_TYPE.CLEANING_PLAN_WORKER_REMOVED,
                entity: NOTIFICATION_ENTITY.CLEANING_PLAN,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.planId,
                meta: { planId: payload.planId },
            }).catch((err) =>
                errorLogger.error(
                    'cleaning_plan.worker_removed notification failed',
                    err
                )
            )
        )
    );
});

// A plan was cancelled — tell the client and everyone who was assigned to it.
onAppEvent('cleaning_plan.deleted', async (payload) => {
    const notify = [payload.clientId, ...payload.workerIds];

    await Promise.all(
        notify.map((receiver) =>
            NotificationService.sendNotification({
                receiver,
                title: 'Cleaning plan cancelled',
                message: `The cleaning plan "${payload.title}" has been cancelled.`,
                type: ENUM_NOTIFICATION_TYPE.CLEANING_PLAN_DELETED,
                entity: NOTIFICATION_ENTITY.CLEANING_PLAN,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.planId,
                meta: { planId: payload.planId },
            }).catch((err) =>
                errorLogger.error('cleaning_plan.deleted notification failed', err)
            )
        )
    );
});
