/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

interface INotificationPayload {
    playerIds: string[];
    message: string;
    heading?: string;
    url?: string;
    data?: object;
    /**
     * OneSignal collapse key (`collapse_id` on iOS/APNs, `android_group` +
     * `android_group_message` on Android). When set, a new push with the
     * same collapseId REPLACES the previous unread one for that key in the
     * OS notification tray instead of stacking as a separate alert — pass
     * something like a chat id so 20 messages while offline show up as one
     * tray entry, not twenty.
     */
    collapseId?: string;
}

const sendPushNotification = async ({
    playerIds,
    message,
    heading = 'Notification',
    url,
    data,
    collapseId,
}: INotificationPayload) => {
    if (!playerIds?.length) return;

    try {
        await axios.post(
            'https://onesignal.com/api/v1/notifications',
            {
                app_id: process.env.ONESIGNAL_APP_ID,
                include_player_ids: playerIds,
                contents: { en: message },
                headings: { en: heading },
                url,
                data,
                ...(collapseId && {
                    collapse_id: collapseId,
                    android_group: collapseId,
                    // Android also needs an explicit summary text when
                    // grouping, otherwise it just shows the latest message
                    // with no "N more" indication.
                    android_group_message: { en: 'You have new messages' },
                }),
            },
            {
                headers: {
                    Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
                },
            }
        );
    } catch (error: any) {
        console.error(
            'OneSignal Error:',
            error?.response?.data || error.message
        );
    }
};

export default sendPushNotification;
