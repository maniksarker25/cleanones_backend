// Augmenting Express's own global Request type requires the `namespace` form —
// there's no ES2015-module equivalent for extending a third-party global namespace.
/* eslint-disable-next-line @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars */
declare namespace Express {
    export interface Request {
        files?: {
            image?: MulterS3.File[];
            profile_image?: MulterS3.File[];
            category_image?: MulterS3.File[];
            task_attachments?: MulterS3.File[];
            service_image?: MulterS3.File[];
            question_image?: MulterS3.File[];
            reject_evidence?: MulterS3.File[];
            conversation_image?: MulterS3.File[];
            conversation_video?: MulterS3.File[];
            conversation_pdf?: MulterS3.File[];
            identification_document?: MulterS3.File[];
            beforeImages?: MulterS3.File[];
            afterImages?: MulterS3.File[];
            report_evidence?: MulterS3.File[];
        };
    }
}
