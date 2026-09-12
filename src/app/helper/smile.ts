// import { IDApi, Signature } from 'smile-identity-core';

// // Types for the job submission
// interface JobDetails {
//     partner_params: {
//         job_id: string;
//         user_id: string;
//         job_type: number;
//     };
//     id_info: {
//         first_name: string;
//         last_name: string;
//         country: string;
//         id_type: string;
//         id_number: string;
//         dob: string;
//         phone_number: string;
//         signature: string;
//         timestamp: string;
//     };
// }

// // Function to generate signature
// export function generateSignature(
//     partner_id: string,
//     api_key: string,
//     timestamp: string
// ): Promise<string> {
//     const connection = new Signature(partner_id, api_key);
//     return connection.generate_signature(timestamp);
// }

// // Function to submit KYC verification job (ID verification)
// export function submitKYCJob(
//     partner_id: string,
//     api_key: string,
//     api_base_url: string,
//     job_details: JobDetails
// ): Promise<any> {
//     const connection = new IDApi(partner_id, api_key, api_base_url);

//     return connection
//         .submit_job(job_details.partner_params, job_details.id_info)
//         .then((response) => response)
//         .catch((error) => {
//             console.error('Error submitting job:', error);
//             throw error;
//         });
// }
