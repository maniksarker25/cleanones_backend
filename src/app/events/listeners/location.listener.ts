import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';

// A location was deleted/deactivated, taking every CleaningPlan at that
// location — and every one of their staffed future shifts — down with it
// (see deleteLocationFromDB in location.services.ts). One notice to the
// client covering every plan under this location at once (not one per
// plan), and one consolidated notice per affected worker (not one per plan
// or per shift) — a worker staffed across several of the location's plans
// still gets exactly one notification.
onAppEvent('location.deactivated', async (payload) => {
    await Promise.all([
        NotificationService.sendNotification({
            receiver: payload.clientId,
            title: 'Location deactivated',
            message: payload.planCount
                ? `The location "${payload.locationName}" was deactivated — ${payload.planCount} cleaning plan(s) and their upcoming shifts were cancelled.`
                : `The location "${payload.locationName}" was deactivated.`,
            type: ENUM_NOTIFICATION_TYPE.LOCATION_DEACTIVATED,
            entity: NOTIFICATION_ENTITY.LOCATION,
            action: NOTIFICATION_ACTION.VIEW,
            entityId: payload.locationId,
            meta: { locationId: payload.locationId },
        }).catch((err) =>
            errorLogger.error('location.deactivated notification failed (client)', err)
        ),
        ...payload.workerIds.map((workerId) =>
            NotificationService.sendNotification({
                receiver: workerId,
                title: 'Shifts cancelled',
                message: `All of your shifts under the location "${payload.locationName}" have been cancelled.`,
                type: ENUM_NOTIFICATION_TYPE.SHIFT_CANCELLED,
                entity: NOTIFICATION_ENTITY.LOCATION,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.locationId,
                meta: { locationId: payload.locationId },
            }).catch((err) =>
                errorLogger.error(
                    'location.deactivated notification failed (worker)',
                    err
                )
            )
        ),
    ]);
});
