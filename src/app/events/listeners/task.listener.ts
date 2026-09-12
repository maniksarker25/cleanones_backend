import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';
import { errorLogger } from '../../shared/logger';
import { appEventEmitter } from '../eventEmitter';

// task.created → customer
appEventEmitter.on(
    'task.created',
    async (payload: { taskId: string; customer: string }) => {
        await NotificationService.sendNotification({
            receiver: payload.customer,
            title: 'Task Created!',
            message: `Your task has been created and is open for bids`,
            type: ENUM_NOTIFICATION_TYPE.TASK_CREATED,
            entity: NOTIFICATION_ENTITY.TASK,
            entityId: payload.taskId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: { taskId: payload.taskId, status: 'OPEN' },
        }).catch((err) =>
            errorLogger.error('task.created notification failed', err)
        );
    }
);

// task.offer.accepted → customer (provider accepted the private offer)
appEventEmitter.on(
    'task.offer.accepted',
    async (payload: { taskId: string; customer: string; provider: string }) => {
        await NotificationService.sendNotification({
            receiver: payload.customer,
            title: 'Offer Accepted 🎉',
            message: `The provider has accepted your offer. Your task is now in progress`,
            type: ENUM_NOTIFICATION_TYPE.TASK_ACCEPTED,
            entity: NOTIFICATION_ENTITY.TASK,
            entityId: payload.taskId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: { taskId: payload.taskId, status: 'IN_PROGRESS' },
        }).catch((err) =>
            errorLogger.error('task.offer.accepted notification failed', err)
        );
    }
);

// task.offer.rejected → customer (provider rejected the private offer)
appEventEmitter.on(
    'task.offer.rejected',
    async (payload: { taskId: string; customer: string }) => {
        await NotificationService.sendNotification({
            receiver: payload.customer,
            title: 'Offer Rejected',
            message: `The provider rejected your offer. Your task is now open for bids from other providers`,
            type: ENUM_NOTIFICATION_TYPE.OFFER_REJECTED,
            entity: NOTIFICATION_ENTITY.TASK,
            entityId: payload.taskId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: { taskId: payload.taskId, status: 'OPEN' },
        }).catch((err) =>
            errorLogger.error('task.offer.rejected notification failed', err)
        );
    }
);

// task.started → customer (provider uploaded before images and started)
appEventEmitter.on(
    'task.started',
    async (payload: { taskId: string; customer: string; provider: string }) => {
        await NotificationService.sendNotification({
            receiver: payload.customer,
            title: 'Task Started',
            message: `The provider has started working on your task`,
            type: ENUM_NOTIFICATION_TYPE.TASK_STARTED,
            entity: NOTIFICATION_ENTITY.TASK,
            entityId: payload.taskId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: { taskId: payload.taskId, status: 'IN_PROGRESS' },
        }).catch((err) =>
            errorLogger.error('task.started notification failed', err)
        );
    }
);

// task.marked.complete.provider → customer (provider uploaded after images)
appEventEmitter.on(
    'task.marked.complete.provider',
    async (payload: { taskId: string; customer: string; provider: string }) => {
        await NotificationService.sendNotification({
            receiver: payload.customer,
            title: 'Task Marked as Complete',
            message: `The provider has marked your task as complete. Please review and confirm`,
            type: ENUM_NOTIFICATION_TYPE.TASK_COMPLETED,
            entity: NOTIFICATION_ENTITY.TASK,
            entityId: payload.taskId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: { taskId: payload.taskId, status: 'IN_PROGRESS' },
        }).catch((err) =>
            errorLogger.error(
                'task.marked.complete.provider notification failed',
                err
            )
        );
    }
);

// task.completed → provider (customer confirmed completion, payment released)
appEventEmitter.on(
    'task.completed',
    async (payload: { taskId: string; provider: string; customer: string }) => {
        await NotificationService.sendNotification({
            receiver: payload.provider,
            title: 'Payment Released 💰',
            message: `The customer has confirmed task completion. Your payment has been transferred`,
            type: ENUM_NOTIFICATION_TYPE.TASK_COMPLETED,
            entity: NOTIFICATION_ENTITY.TASK,
            entityId: payload.taskId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: { taskId: payload.taskId, status: 'COMPLETED' },
        }).catch((err) =>
            errorLogger.error('task.completed notification failed', err)
        );
    }
);

// task.cancelled → provider (if assigned)
appEventEmitter.on(
    'task.cancelled',
    async (payload: {
        taskId: string;
        provider?: string;
        customer: string;
    }) => {
        if (!payload.provider) return;
        await NotificationService.sendNotification({
            receiver: payload.provider,
            title: 'Task Cancelled',
            message: `The customer has cancelled the task`,
            type: ENUM_NOTIFICATION_TYPE.TASK_CANCELLED,
            entity: NOTIFICATION_ENTITY.TASK,
            entityId: payload.taskId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: { taskId: payload.taskId, status: 'CANCELLED' },
        }).catch((err) =>
            errorLogger.error('task.cancelled notification failed', err)
        );
    }
);
