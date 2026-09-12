/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';

// types/verification.ts
export type IDTypeFrontend =
    | 'PASSPORT'
    | 'NATIONAL_ID'
    | 'DRIVER_LICENSE'
    | 'VOTER_ID'
    | 'BVN';

export const frontendToSmileIdType: any = {
    PASSPORT: 'PASSPORT_NGA',
    NATIONAL_ID: 'NIN_V2',
    DRIVER_LICENSE: 'DRIVERS_LICENSE',
    VOTER_ID: 'VOTER_ID',
    BVN: 'BVN',
};

// utils/verification.ts

interface VerificationPayload {
    first_name: string;
    last_name: string;
    middle_name?: string;
    dob: string;
    gender?: string;
    phone_number?: string;
    country: string;
    id_number: string;
    id_type: string; // SmileID id_type
    partner_id: string;
    partner_params: {
        job_id: string;
        job_type: number;
        user_id: string;
        sandbox_result?: string;
    };
    signature: string;
    timestamp: string;
}

export const generateSignature = (
    partnerId: string,
    apiKey: string,
    timestamp: string
) => {
    const hmac = crypto.createHmac('sha256', apiKey);
    hmac.update(timestamp, 'utf8');
    hmac.update(partnerId, 'utf8');
    hmac.update('sid_request', 'utf8');
    return hmac.digest('base64');
};

export const buildVerificationPayload = (
    profileId: string,
    frontendType: any,
    data:
        | {
              first_name: string;
              last_name: string;
              middle_name?: string;
              dob: string;
              gender?: string;
              phone_number?: string;
              country: string;
              id_number: string;
              job_id: string;
              job_type: number;
              user_id: string;
              sandbox_result?: string;
          }
        | any
): VerificationPayload => {
    const smileIdType = frontendToSmileIdType[frontendType];

    if (!smileIdType) throw new Error('Invalid ID type provided');

    const timestamp = new Date().toISOString();
    const partnerId = process.env.SMILE_PARTNER_ID as string;
    const apiKey = process.env.SMILE_API_KEY as string;
    const signature = generateSignature(partnerId, apiKey, timestamp);
    const jobId = crypto.randomUUID();

    return {
        ...data,
        country: 'NG',
        id_type: smileIdType,
        partner_id: partnerId,
        signature,
        timestamp,
        partner_params: {
            job_id: jobId,
            job_type: 5,
            user_id: profileId,
            // sandbox_result: '1',
        },
    };
};
