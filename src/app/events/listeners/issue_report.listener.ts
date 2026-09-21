import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';
import { Manager } from '../../modules/manager/manager.model';

// Same fan-out rationale as additional_task.listener.ts — no stored manager
// relationship exists to narrow this to one, so every manager gets their own
// notification row.
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
                errorLogger.error('issue_report notification failed', err)
            )
        )
    );
};

// A worker filed a new issue report.
onAppEvent('issue_report.created', async (payload) => {
    await notifyAllManagers((managerId) => ({
        receiver: managerId,
        title: 'New issue report',
        message: `A worker reported an issue: "${payload.issueType}" (${payload.severity} severity).`,
        type: ENUM_NOTIFICATION_TYPE.ISSUE_REPORT_CREATED,
        entity: NOTIFICATION_ENTITY.ISSUE_REPORT,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.issueId,
        meta: { issueId: payload.issueId, workerId: payload.workerId },
    }));
});

// A manager changed an issue report's status — tell the worker who filed it.
onAppEvent('issue_report.status_changed', async (payload) => {
    const message =
        payload.status === 'RESOLVED'
            ? payload.resolutionNote
                ? `Your issue report has been resolved: ${payload.resolutionNote}`
                : 'Your issue report has been resolved.'
            : `Your issue report status was updated to ${payload.status}.`;

    await NotificationService.sendNotification({
        receiver: payload.workerId,
        title: 'Issue report update',
        message,
        type: ENUM_NOTIFICATION_TYPE.ISSUE_REPORT_STATUS_CHANGED,
        entity: NOTIFICATION_ENTITY.ISSUE_REPORT,
        action: NOTIFICATION_ACTION.VIEW,
        entityId: payload.issueId,
        meta: { issueId: payload.issueId, status: payload.status },
    }).catch((err) =>
        errorLogger.error(
            'issue_report.status_changed notification failed',
            err
        )
    );
});
