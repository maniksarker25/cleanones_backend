// @ts-expect-error — mocean-sdk ships no type declarations.
import moceansdk from 'mocean-sdk';

const mocean = new moceansdk.Mocean(
    new moceansdk.Client({
        apiToken: process.env.MOCEAN_API_TOKEN!,
    })
);

export interface SmsResponse {
    messages: {
        status: number;
        receiver?: string;
        msgid?: string;
        err_msg?: string;
    }[];
}

export const sendSMS = async (
    phoneNumber: string,
    smsMessage: string
): Promise<SmsResponse> => {
    try {
        const response: SmsResponse = await mocean.sms().send({
            'mocean-from': 'TASKALLEY',
            'mocean-to': phoneNumber,
            'mocean-text': smsMessage,
        });

        return response;
    } catch (error) {
        console.error(
            'Failed to send SMS:',
            error instanceof Error ? error.message : error
        );
        throw new Error('Failed to send SMS');
    }
};
