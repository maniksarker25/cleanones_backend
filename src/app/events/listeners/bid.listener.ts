import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';
import { errorLogger } from '../../shared/logger';
import { appEventEmitter } from '../eventEmitter';

// bid.placed → customer (a provider placed a bid on their task)
appEventEmitter.on(
    'bid.placed',
    async (payload: {
        bidId: string;
        taskId: string;
        customer: string;
        provider: string;
    }) => {
        console.log('bid placed event.....................');
        await NotificationService.sendNotification({
            receiver: payload.customer,
            title: 'New Bid Received',
            message: `A provider has placed a bid on your task. Review the offer now`,
            type: ENUM_NOTIFICATION_TYPE.BID_PLACED,
            entity: NOTIFICATION_ENTITY.BID,
            entityId: payload.bidId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: {
                bidId: payload.bidId,
                taskId: payload.taskId,
            },
        }).catch((err) =>
            errorLogger.error('bid.placed notification failed', err)
        );
    }
);

// bid.accepted → provider (customer accepted and payment intent created)
appEventEmitter.on(
    'bid.accepted',
    async (payload: {
        bidId: string;
        taskId: string;
        provider: string;
        customer: string;
    }) => {
        await NotificationService.sendNotification({
            receiver: payload.provider,
            title: 'Bid Accepted 🎉',
            message: `Your bid has been accepted. The customer is completing payment`,
            type: ENUM_NOTIFICATION_TYPE.BID_ACCEPTED,
            entity: NOTIFICATION_ENTITY.BID,
            entityId: payload.bidId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: {
                bidId: payload.bidId,
                taskId: payload.taskId,
            },
        }).catch((err) =>
            errorLogger.error('bid.accepted notification failed', err)
        );
    }
);

// bid.rejected → provider
appEventEmitter.on(
    'bid.rejected',
    async (payload: { bidId: string; taskId: string; provider: string }) => {
        await NotificationService.sendNotification({
            receiver: payload.provider,
            title: 'Bid Rejected',
            message: `Your bid was not selected for this task`,
            type: ENUM_NOTIFICATION_TYPE.BID_REJECTED,
            entity: NOTIFICATION_ENTITY.BID,
            entityId: payload.bidId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: {
                bidId: payload.bidId,
                taskId: payload.taskId,
            },
        }).catch((err) =>
            errorLogger.error('bid.rejected notification failed', err)
        );
    }
);

// bid.counter.customer → provider (customer made a counter-offer)
appEventEmitter.on(
    'bid.counter.customer',
    async (payload: { bidId: string; taskId: string; provider: string }) => {
        console.log('Custoemr counter...........');
        await NotificationService.sendNotification({
            receiver: payload.provider,
            title: 'Counter Offer Received',
            message: `The customer has sent a counter offer. Review and respond`,
            type: ENUM_NOTIFICATION_TYPE.BID_COUNTER,
            entity: NOTIFICATION_ENTITY.BID,
            entityId: payload.bidId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: {
                bidId: payload.bidId,
                taskId: payload.taskId,
            },
        }).catch((err) =>
            errorLogger.error('bid.counter.customer notification failed', err)
        );
    }
);

// bid.counter.provider → customer (provider responded to counter-offer)
appEventEmitter.on(
    'bid.counter.provider',
    async (payload: { bidId: string; taskId: string; customer: string }) => {
        console.log('Nice to meet you ');
        await NotificationService.sendNotification({
            receiver: payload.customer,
            title: 'Provider Responded to Counter Offer',
            message: `The provider has responded to your counter offer`,
            type: ENUM_NOTIFICATION_TYPE.BID_COUNTER,
            entity: NOTIFICATION_ENTITY.BID,
            entityId: payload.bidId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: {
                bidId: payload.bidId,
                taskId: payload.taskId,
            },
        }).catch((err) =>
            errorLogger.error('bid.counter.provider notification failed', err)
        );
    }
);
