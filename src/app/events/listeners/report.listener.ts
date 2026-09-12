import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';
import { errorLogger } from '../../shared/logger';
import { appEventEmitter } from '../eventEmitter';

// report.created → the reported party
appEventEmitter.on(
    'report.created',
    async (payload: {
        reportId: string;
        taskId: string;
        reportTo: string;
        reportByRole: string;
    }) => {
        await NotificationService.sendNotification({
            receiver: payload.reportTo,
            title: 'Report Filed Against You',
            message: `A report has been filed regarding task activity. Our team will review shortly`,
            type: ENUM_NOTIFICATION_TYPE.REPORT_CREATED,
            entity: NOTIFICATION_ENTITY.REPORT,
            entityId: payload.reportId,
            action: NOTIFICATION_ACTION.VIEW,
            meta: {
                reportId: payload.reportId,
                taskId: payload.taskId,
            },
        }).catch((err) =>
            errorLogger.error('report.created notification failed', err)
        );
    }
);

// report.resolved.refunded → customer (admin issued refund)
appEventEmitter.on(
    'report.resolved.refunded',
    async (payload: {
        reportId: string;
        taskId: string;
        customer: string;
        provider: string;
        resolutionNote?: string;
    }) => {
        await Promise.allSettled([
            NotificationService.sendNotification({
                receiver: payload.customer,
                title: 'Report Resolved — Refund Issued',
                message: `Your report has been reviewed and a refund has been issued to your account`,
                type: ENUM_NOTIFICATION_TYPE.REPORT_RESOLVED,
                entity: NOTIFICATION_ENTITY.REPORT,
                entityId: payload.reportId,
                action: NOTIFICATION_ACTION.VIEW,
                meta: {
                    reportId: payload.reportId,
                    taskId: payload.taskId,
                    isRefunded: true,
                },
            }),
            NotificationService.sendNotification({
                receiver: payload.provider,
                title: 'Report Resolved',
                message: `The dispute report for this task has been resolved by the admin`,
                type: ENUM_NOTIFICATION_TYPE.REPORT_RESOLVED,
                entity: NOTIFICATION_ENTITY.REPORT,
                entityId: payload.reportId,
                action: NOTIFICATION_ACTION.VIEW,
                meta: {
                    reportId: payload.reportId,
                    taskId: payload.taskId,
                    isRefunded: true,
                },
            }),
        ]).catch((err) =>
            errorLogger.error(
                'report.resolved.refunded notification failed',
                err
            )
        );
    }
);

// report.resolved.paid → provider (admin ruled in provider's favour)
appEventEmitter.on(
    'report.resolved.paid',
    async (payload: {
        reportId: string;
        taskId: string;
        customer: string;
        provider: string;
        resolutionNote?: string;
    }) => {
        await Promise.allSettled([
            NotificationService.sendNotification({
                receiver: payload.provider,
                title: 'Report Resolved — Payment Released 💰',
                message: `The dispute has been resolved in your favour. Your payment has been transferred`,
                type: ENUM_NOTIFICATION_TYPE.REPORT_RESOLVED,
                entity: NOTIFICATION_ENTITY.REPORT,
                entityId: payload.reportId,
                action: NOTIFICATION_ACTION.VIEW,
                meta: {
                    reportId: payload.reportId,
                    taskId: payload.taskId,
                    isRefunded: false,
                },
            }),
            NotificationService.sendNotification({
                receiver: payload.customer,
                title: 'Report Resolved',
                message: `The dispute report for this task has been reviewed and resolved by the admin`,
                type: ENUM_NOTIFICATION_TYPE.REPORT_RESOLVED,
                entity: NOTIFICATION_ENTITY.REPORT,
                entityId: payload.reportId,
                action: NOTIFICATION_ACTION.VIEW,
                meta: {
                    reportId: payload.reportId,
                    taskId: payload.taskId,
                    isRefunded: false,
                },
            }),
        ]).catch((err) =>
            errorLogger.error('report.resolved.paid notification failed', err)
        );
    }
);
