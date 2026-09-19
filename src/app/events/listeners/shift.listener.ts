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

// A worker was newly staffed onto a shift occurrence.
onAppEvent('shift.worker_assigned', async (payload) => {
    await Promise.all(
        payload.addedWorkerIds.map((workerId) =>
            NotificationService.sendNotification({
                receiver: workerId,
                title: 'New shift assignment',
                message: `You've been scheduled for a shift on "${payload.title}".`,
                type: ENUM_NOTIFICATION_TYPE.SHIFT_WORKER_ASSIGNED,
                entity: NOTIFICATION_ENTITY.SHIFT,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.shiftId,
                meta: { planId: payload.planId, start_date: payload.start_date },
            }).catch((err) =>
                errorLogger.error('shift.worker_assigned notification failed', err)
            )
        )
    );
});

// A worker was taken off a shift occurrence.
onAppEvent('shift.worker_removed', async (payload) => {
    await Promise.all(
        payload.removedWorkerIds.map((workerId) =>
            NotificationService.sendNotification({
                receiver: workerId,
                title: 'Removed from shift',
                message: `You've been removed from a shift on "${payload.title}".`,
                type: ENUM_NOTIFICATION_TYPE.SHIFT_WORKER_REMOVED,
                entity: NOTIFICATION_ENTITY.SHIFT,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.shiftId,
                meta: { planId: payload.planId },
            }).catch((err) =>
                errorLogger.error('shift.worker_removed notification failed', err)
            )
        )
    );
});

// A future, already-staffed shift was cancelled by a task/room recurrence
// edit that took its date out of the plan's pattern (see
// reconcileFutureShiftsForTaskChange in shift.services.ts). Both the crew
// that was scheduled and the client need to know their date fell through.
onAppEvent('shift.cancelled', async (payload) => {
    await Promise.all([
        ...payload.cancelledWorkerIds.map((workerId) =>
            NotificationService.sendNotification({
                receiver: workerId,
                title: 'Shift cancelled',
                message: `Your shift on "${payload.title}" was cancelled — the schedule for this plan changed.`,
                type: ENUM_NOTIFICATION_TYPE.SHIFT_CANCELLED,
                entity: NOTIFICATION_ENTITY.SHIFT,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.shiftId,
                meta: { planId: payload.planId, date: payload.date },
            }).catch((err) =>
                errorLogger.error('shift.cancelled notification failed (worker)', err)
            )
        ),
        NotificationService.sendNotification({
            receiver: payload.clientId,
            title: 'A scheduled shift was cancelled',
            message: `A shift on "${payload.title}" was cancelled because its schedule changed.`,
            type: ENUM_NOTIFICATION_TYPE.SHIFT_CANCELLED,
            entity: NOTIFICATION_ENTITY.SHIFT,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.shiftId,
            meta: { planId: payload.planId, date: payload.date },
        }).catch((err) =>
            errorLogger.error('shift.cancelled notification failed (client)', err)
        ),
    ]);
});

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
