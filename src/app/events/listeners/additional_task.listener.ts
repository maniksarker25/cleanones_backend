import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';
import { notifyPlanManager } from './notifyManager';

// A client requested extra, one-off work — the plan's own manager needs to
// see this to approve/reject it.
onAppEvent('additional_task.created', async (payload) => {
    await notifyPlanManager(payload.planId, (managerId) => ({
        receiver: managerId,
        title: 'New additional task request',
        message: `A client requested extra work: "${payload.name}".`,
        type: ENUM_NOTIFICATION_TYPE.ADDITIONAL_TASK_CREATED,
        entity: NOTIFICATION_ENTITY.ADDITIONAL_TASK,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.taskId,
        meta: { planId: payload.planId, clientId: payload.clientId },
    }), 'additional_task.created');
});

onAppEvent('additional_task.approved', async (payload) => {
    await NotificationService.sendNotification({
        receiver: payload.clientId,
        title: 'Additional task approved',
        message: `Your request "${payload.name}" was approved.`,
        type: ENUM_NOTIFICATION_TYPE.ADDITIONAL_TASK_APPROVED,
        entity: NOTIFICATION_ENTITY.ADDITIONAL_TASK,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.taskId,
        meta: { planId: payload.planId },
    }).catch((err) =>
        errorLogger.error('additional_task.approved notification failed', err)
    );
});

onAppEvent('additional_task.rejected', async (payload) => {
    await NotificationService.sendNotification({
        receiver: payload.clientId,
        title: 'Additional task rejected',
        message: payload.rejectReason
            ? `Your request "${payload.name}" was rejected: ${payload.rejectReason}`
            : `Your request "${payload.name}" was rejected.`,
        type: ENUM_NOTIFICATION_TYPE.ADDITIONAL_TASK_REJECTED,
        entity: NOTIFICATION_ENTITY.ADDITIONAL_TASK,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.taskId,
        meta: { planId: payload.planId, rejectReason: payload.rejectReason ?? null },
    }).catch((err) =>
        errorLogger.error('additional_task.rejected notification failed', err)
    );
});
