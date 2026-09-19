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

// A plan was cancelled — tell the client. Workers who were staffed on any of
// its shifts are not tracked here (the plan itself never held a roster); a
// cancelled plan's future shifts are handled separately if/when that cascade
// is added.
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
