import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import {
    ENUM_NOTIFICATION_TYPE,
    NOTIFICATION_ACTION,
    NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';

// Realtime delivery to connected sockets already happens directly inside
// chat_message.services.ts (createChatMessage's broadcastToChat). This event
// exists only so a recipient who ISN'T currently connected still gets
// something — sendNotification's own online/offline branch will actually
// skip the push if they turn out to be online after all, so this is safe to
// fire unconditionally for every recipient rather than needing the caller to
// pre-filter by presence.
onAppEvent('chat.message_received', async (payload) => {
    await Promise.all(
        payload.recipientProfileIds.map((receiver) =>
            NotificationService.sendNotification({
                receiver,
                title: 'New message',
                message: payload.preview,
                type: ENUM_NOTIFICATION_TYPE.NEW_CHAT_MESSAGE,
                entity: NOTIFICATION_ENTITY.CHAT,
                action: NOTIFICATION_ACTION.VIEW,
                entityId: payload.chatId,
                meta: { chatType: payload.chatType },
            }).catch((err) =>
                errorLogger.error(
                    'chat.message_received notification failed',
                    err
                )
            )
        )
    );
});
