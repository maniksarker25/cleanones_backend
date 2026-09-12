/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
// types/express.d.ts or a similar file in your project--
//
declare namespace Express {
    export interface Request {
        files?: {
            product_image?: File[]; // Add more fields as needed, e.g. category_image, profile_image
            // Add other fields you might expect to receive---
            profile_image?: File[];
            course_banner?: File[];
            banner?: File[];
            class_banner?: File[];
            category_image?: File[];
            task_attachments?: File[];
            service_image?: File[];
            question_image?: File[];
            reject_evidence?: File[];
            conversation_image?: File[];
            conversation_video?: File[];
            conversation_pdf?: File[];
            identification_document?: File[];
            beforeImages?: File[];
            afterImages?: File[];
            cancellationEvidence?: File[];
            report_evidence?: File[];
        };
    }
}

// src/types/express/index.d.ts

declare namespace Express {
    interface Request {
        rawBody?: Buffer;
    }
}
