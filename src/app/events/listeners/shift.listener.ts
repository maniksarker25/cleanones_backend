import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';
import { Manager } from '../../modules/manager/manager.model';

// Same fan-out rationale as additional_task.listener.ts — attendance is a
// manager-wide concern, not tied to one specific manager per plan.
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
            ).catch((err) => errorLogger.error('shift notification failed', err))
        )
    );
};

onAppEvent('shift.checked_in', async (payload) => {
    await notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'Worker checked in',
        message: `A worker checked in for their shift.`,
        type: ENUM_NOTIFICATION_TYPE.SHIFT_CHECKED_IN,
        entity: NOTIFICATION_ENTITY.SHIFT,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId, workerId: payload.workerId, at: payload.at },
    }));
});

onAppEvent('shift.checked_out', async (payload) => {
    await notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'Worker checked out',
        message: `A worker checked out of their shift.`,
        type: ENUM_NOTIFICATION_TYPE.SHIFT_CHECKED_OUT,
        entity: NOTIFICATION_ENTITY.SHIFT,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId, workerId: payload.workerId, at: payload.at },
    }));
});

// Every task on the shift got completed — let the client know their
// cleaning is done, and let managers know too (attendance/QA follow-up).
onAppEvent('shift.completed', async (payload) => {
    await NotificationService.sendNotification({
        receiver: payload.clientId,
        title: "Today's cleaning completed",
        message: 'All tasks for today have been completed.',
        type: ENUM_NOTIFICATION_TYPE.SHIFT_COMPLETED,
        entity: NOTIFICATION_ENTITY.SHIFT,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId },
    }).catch((err) =>
        errorLogger.error('shift.completed notification failed', err)
    );

    await notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'Shift completed',
        message: 'A shift has been fully completed.',
        type: ENUM_NOTIFICATION_TYPE.SHIFT_COMPLETED,
        entity: NOTIFICATION_ENTITY.SHIFT,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.shiftId,
        meta: { planId: payload.planId },
    }));
});
