import axios from 'axios';

interface INotificationPayload {
    playerIds: string[];
    message: string;
    heading?: string;
    url?: string;
    data?: object;
    /** OneSignal collapse key — a new push with the same id replaces the previous one in the tray instead of stacking. */
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
                    // Android needs an explicit summary text when grouping.
                    android_group_message: { en: 'You have new messages' },
                }),
            },
            {
                headers: {
                    Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
                },
            }
        );
    } catch (error) {
        const responseData =
            error && typeof error === 'object' && 'response' in error
                ? (error as { response?: { data?: unknown } }).response?.data
                : undefined;
        console.error(
            'OneSignal Error:',
            responseData ?? (error instanceof Error ? error.message : error)
        );
    }
};

export default sendPushNotification;
