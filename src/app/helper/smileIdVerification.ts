/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
// smileid.ts
const SmileID = require('smile-identity-core').default;

export const smileID = new SmileID({
    partner_id: process.env.SMILE_PARTNER_ID!,
    api_key: process.env.SMILE_API_KEY!,
    sid_server: 'https://sandbox.smileidentity.com/v1',
});
export const verifyNIN = async (nin: string, phone?: string) => {
    const response = await smileID.basicKyc({
        country: 'NG',
        id_type: 'NIN',
        id_number: nin,
        phone_number: phone, // optional
    });
    return response;
};
export const verifyPVC = async (pvcNumber: string) => {
    const response = await smileID.basicKyc({
        country: 'NG',
        id_type: 'VOTER_ID',
        id_number: pvcNumber,
    });
    return response;
};
export const verifyPassport = async (passportNumber: string) => {
    const response = await smileID.basicKyc({
        country: 'NG',
        id_type: 'PASSPORT',
        id_number: passportNumber,
    });
    return response;
};
export const verifyDL = async (dlNumber: string) => {
    const response = await smileID.basicKyc({
        country: 'NG',
        id_type: 'DRIVERS_LICENSE',
        id_number: dlNumber,
    });
    return response;
};

export const verifyBVN = async (bvn: string) => {
    const response = await smileID.basicKyc({
        country: 'NG',
        id_type: 'BVN',
        id_number: bvn,
    });
    return response;
};
