import { onAppEvent } from '../eventEmitter';
import { errorLogger } from '../../shared/logger';
import NotificationService from '../../modules/notification/notification.services';

// Realtime delivery to connected sockets already happens directly inside
// chat_message.services.ts (createChatMessage's broadcastToChat). This event
// exists only to cover offline recipients with an OS push — deliberately
// via sendChatPushNotification, NOT sendNotification: chat messages don't
// get a Notification row (would flood the generic notification list, one
// row per message) and the push is collapsed per-chat (see
// sendChatPushNotification's own comment) so an offline recipient gets one
// "new messages" tray entry, not one per message. sendChatPushNotification
// already no-ops for an online recipient, so this is safe to call
// unconditionally for every recipient without pre-filtering by presence.
onAppEvent('chat.message_received', async (payload) => {
    await Promise.all(
        payload.recipientProfileIds.map((receiver) =>
            NotificationService.sendChatPushNotification({
                receiver,
                title: 'New message',
                message: payload.preview,
                chatId: payload.chatId,
                data: { chatType: payload.chatType },
            }).catch((err) =>
                errorLogger.error(
                    'chat.message_received push notification failed',
                    err
                )
            )
        )
    );
});
