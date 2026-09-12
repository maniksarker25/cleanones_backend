import { appEventEmitter } from '../../events/eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from './notification.enum';
import NotificationService from './notification.services';

// Order Created → bartender
appEventEmitter.on('order.created', async (payload) => {
    await NotificationService.sendNotification({
        receiver: payload.bartender,
        title: 'New Order',
        message: 'You have a new order',
        type: 'ORDER',
        entityId: payload.orderId,
    });
});

// Order Status → customer
appEventEmitter.on('order.status.changed', async (payload) => {
    await NotificationService.sendNotification({
        receiver: payload.customer,
        title: 'Order Update',
        message: `Order is now ${payload.status}`,
        type: 'ORDER',
        entityId: payload.orderId,
    });
});

// Job Accepted → bartender
appEventEmitter.on(
    'job.application.accepted',
    async (payload: { jobId: string; bartender: string; customer: string }) => {
        await NotificationService.sendNotification({
            receiver: payload.bartender,
            title: 'Application Accepted 🎉',
            message: `You have been selected for a job`,
            type: ENUM_NOTIFICATION_TYPE.BID_ACCEPTED,
            entity: NOTIFICATION_ENTITY.JOB,
            entityId: payload.jobId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: {
                jobId: payload.jobId,
                status: 'ASSIGNED',
            },
        }).catch((err) => {
            errorLogger.error('Job accepted notifiscation failed', err);
        });
    }
);
