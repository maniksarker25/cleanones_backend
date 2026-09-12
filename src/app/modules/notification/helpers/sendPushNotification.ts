/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';

interface INotificationPayload {
    playerIds: string[];
    message: string;
    heading?: string;
    url?: string;
    data?: object;
}

const sendPushNotification = async ({
    playerIds,
    message,
    heading = 'Notification',
    url,
    data,
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
