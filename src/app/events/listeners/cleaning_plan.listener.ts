import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';

// A plan was created — it carries no crew of its own (see
// cleaning_plan.interface.ts), so only the client is notified here; workers
// are notified individually once staffed onto a specific shift (see
// shift.listener.ts's shift.worker_assigned handler).
onAppEvent('cleaning_plan.created', async (payload) => {
    await NotificationService.sendNotification({
        receiver: payload.clientId,
        title: 'New cleaning plan',
        message: `A cleaning plan "${payload.title}" has been created.`,
        type: ENUM_NOTIFICATION_TYPE.CLEANING_PLAN_CREATED,
        entity: NOTIFICATION_ENTITY.CLEANING_PLAN,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.planId,
        meta: { planId: payload.planId },
    }).catch((err) =>
        errorLogger.error('cleaning_plan.created notification failed', err)
    );
});

// A plan was cancelled — tell the client. The workers affected are notified
// separately (see cleaning_plan.shifts_cancelled below), one consolidated
// notice each rather than folded into this one, since they need a
// worker-specific "your shift" message, not the client-facing plan notice.
onAppEvent('cleaning_plan.deleted', async (payload) => {
    await NotificationService.sendNotification({
        receiver: payload.clientId,
        title: 'Cleaning plan cancelled',
        message: `The cleaning plan "${payload.title}" has been cancelled.`,
        type: ENUM_NOTIFICATION_TYPE.CLEANING_PLAN_DELETED,
        entity: NOTIFICATION_ENTITY.CLEANING_PLAN,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.planId,
        meta: { planId: payload.planId },
    }).catch((err) =>
        errorLogger.error('cleaning_plan.deleted notification failed', err)
    );
});

// Every future ('upcoming') shift under a deleted/deactivated plan was just
// cancelled (see deleteCleaningPlanFromDB in cleaning_plan.services.ts) — one
// consolidated notice per affected worker, not one per shift, since from
// their side "this plan got cancelled" is a single event even if they were
// staffed on several of its future dates.
onAppEvent('cleaning_plan.shifts_cancelled', async (payload) => {
    await Promise.all(
        payload.workerIds.map((workerId) =>
            NotificationService.sendNotification({
                receiver: workerId,
                title: 'Shifts cancelled',
                message: `All of your shifts under "${payload.title}" have been cancelled — the cleaning plan was cancelled.`,
                type: ENUM_NOTIFICATION_TYPE.SHIFT_CANCELLED,
                entity: NOTIFICATION_ENTITY.CLEANING_PLAN,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.planId,
                meta: { planId: payload.planId },
            }).catch((err) =>
                errorLogger.error(
                    'cleaning_plan.shifts_cancelled notification failed',
                    err
                )
            )
        )
    );
});
