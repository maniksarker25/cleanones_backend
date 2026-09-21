import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';

// A client was deleted, taking every active Location under them — and every
// CleaningPlan at those locations, and every one of their staffed future
// shifts — down with it (see deleteClientFromDB in client.services.ts). The
// client themselves gets no notice (their own account is what's being
// deactivated); only the affected workers are notified, one consolidated
// notice each even if they were staffed across several of the client's
// locations/plans.
onAppEvent('client.deleted', async (payload) => {
    await Promise.all(
        payload.workerIds.map((workerId) =>
            NotificationService.sendNotification({
                receiver: workerId,
                title: 'Shifts cancelled',
                message: `All of your shifts for client "${payload.clientName}" have been cancelled.`,
                type: ENUM_NOTIFICATION_TYPE.CLIENT_DELETED,
                entity: NOTIFICATION_ENTITY.CLIENT,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.clientId,
                meta: { clientId: payload.clientId },
            }).catch((err) =>
                errorLogger.error('client.deleted notification failed (worker)', err)
            )
        )
    );
});
