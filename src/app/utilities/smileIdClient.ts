/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import crypto from 'crypto';

const BASE_URL = 'https://sandbox.smileidentity.com/v1';
// const BASE_URL = process.env.SMILE_SERVER || 'sandbox.smileidentity.com';

interface IdInfo {
    id_type: 'NIN' | 'BVN' | 'DRIVERS_LICENSE' | 'VOTER_ID' | 'PASSPORT';
    id_number: string;
    dob?: string; // optional for some IDs
}

interface PartnerParams {
    user_id: string;
    job_id: string;
    job_type: 'BASIC_KYC' | 'BUSINESS_VERIFICATION';
}

interface VerificationRequest extends IdInfo {
    partner_id: string;
    partner_params: PartnerParams;
    callback_url?: string;
    signature: string;
    timestamp: number;
}

class SmileIdClient {
    private partner_id: string;
    private api_key: string;
    private axiosInstance: ReturnType<typeof axios.create>;
    constructor(partner_id: string, api_key: string) {
        this.partner_id = partner_id;
        this.api_key = api_key;
        this.axiosInstance = axios.create({
            baseURL: BASE_URL,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    private generateSignature(): { signature: string; timestamp: number } {
        const timestamp = Date.now();
        const payload = `${this.partner_id}${this.api_key}${timestamp}`;
        const signature = crypto
            .createHash('sha256')
            .update(payload)
            .digest('hex');
        return { signature, timestamp };
    }

    private buildRequest(
        idInfo: IdInfo,
        partnerParams: PartnerParams,
        callbackUrl?: string
    ): VerificationRequest {
        const { signature, timestamp } = this.generateSignature();
        return {
            partner_id: this.partner_id,
            partner_params: partnerParams,
            ...idInfo,
            signature,
            timestamp,
            callback_url: callbackUrl,
        };
    }

    async verifyId(
        idInfo: IdInfo,
        partnerParams: PartnerParams,
        callbackUrl?: string
    ) {
        const endpoint = callbackUrl
            ? '/async_id_verification'
            : '/id_verification';
        const request = this.buildRequest(idInfo, partnerParams, callbackUrl);

        try {
            const response = await this.axiosInstance.post(endpoint, request);
            return response.data;
        } catch (error: any) {
            console.error(
                'Smile ID verification error:',
                error.response?.data || error.message
            );
            throw error;
        }
    }
}

export default new SmileIdClient(
    process.env.SMILE_PARTNER_ID!,
    process.env.SMILE_API_KEY!
);
