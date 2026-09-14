import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';
import { Manager } from '../../modules/manager/manager.model';

// There's no persisted "manager" membership list anywhere in this app (see
// chat.services.ts's ensureChatAccessOrThrow) — every manager has blanket
// access to everything manager-scoped by role, not by a stored relationship.
// Fanning out one Notification per manager mirrors that: each manager gets
// their own row (their own read/seen state) rather than a single shared one.
const notifyAllManagers = async (
    build: (managerId: string) => Parameters<
        typeof NotificationService.sendNotification
    >[0]
) => {
    const managers = await Manager.find().select('_id').lean();
    await Promise.all(
        managers.map((manager) =>
            NotificationService.sendNotification(
                build(manager._id.toString())
            ).catch((err) =>
                errorLogger.error('additional_task notification failed', err)
            )
        )
    );
};

// A client requested extra, one-off work — every manager needs to see this
// to approve/reject it.
onAppEvent('additional_task.created', async (payload) => {
    await notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'New additional task request',
        message: `A client requested extra work: "${payload.name}".`,
        type: ENUM_NOTIFICATION_TYPE.ADDITIONAL_TASK_CREATED,
        entity: NOTIFICATION_ENTITY.ADDITIONAL_TASK,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.taskId,
        meta: { planId: payload.planId, clientId: payload.clientId },
    }));
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
        message: `Your request "${payload.name}" was rejected.`,
        type: ENUM_NOTIFICATION_TYPE.ADDITIONAL_TASK_REJECTED,
        entity: NOTIFICATION_ENTITY.ADDITIONAL_TASK,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.taskId,
        meta: { planId: payload.planId },
    }).catch((err) =>
        errorLogger.error('additional_task.rejected notification failed', err)
    );
});
