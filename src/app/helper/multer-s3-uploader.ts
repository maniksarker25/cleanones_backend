/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { S3Client } from '@aws-sdk/client-s3';
import { Request } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';

/**
 * Configure and setup AWS S3 client
 */
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'eu-west-3',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

/**
 * Setup file upload to AWS S3
 */
export const uploadFile = () => {
    const fileFilter = (req: Request, file: any, cb: any) => {
        const allowedFieldnames = [
            'image',
            'profile_image',
            'category_image',
            'task_attachments',
            'service_image',
            'question_image',
            'reject_evidence',
            'conversation_pdf',
            'conversation_image',
            'identification_document',
            'beforeImages',
            'afterImages',
            'report_evidence',
        ];

        if (file.fieldname === undefined) {
            // Allow requests without any files
            cb(null, true);
        } else if (allowedFieldnames.includes(file.fieldname)) {
            if (
                file.mimetype === 'image/jpeg' ||
                file.mimetype === 'image/png' ||
                file.mimetype === 'image/jpg' ||
                file.mimetype === 'image/webp' ||
                file.mimetype === 'video/mp4' ||
                file.mimetype === 'video/mov' ||
                file.mimetype === 'video/quicktime' ||
                file.mimetype === 'video/mpeg' ||
                file.mimetype === 'video/ogg' ||
                file.mimetype === 'video/webm' ||
                file.mimetype === 'video/x-msvideo' ||
                file.mimetype === 'video/x-flv' ||
                file.mimetype === 'video/3gpp' ||
                file.mimetype === 'video/3gpp2' ||
                file.mimetype === 'video/x-matroska' ||
                file.mimetype === 'application/pdf'
            ) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file type'));
            }
        } else {
            cb(new Error('Invalid fieldname'));
        }
    };

    const storage = multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET_NAME || 'your-bucket-name',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        // Removing ACL setting as your bucket doesn't support ACLs
        key: function (req, file, cb) {
            let uploadPath = '';

            // Maintain the same folder structure as before
            if (file.fieldname === 'profile_image') {
                uploadPath = 'uploads/images/profile';
            } else if (file.fieldname === 'category_image') {
                uploadPath = 'uploads/images/category';
            } else if (file.fieldname === 'video') {
                uploadPath = 'uploads/videos';
            } else if (file.fieldname === 'thumbnail') {
                uploadPath = 'uploads/images/thumbnail';
            } else if (file.fieldname === 'task_attachments') {
                uploadPath = 'uploads/images/task_attachments';
            } else if (file.fieldname === 'service_image') {
                uploadPath = 'uploads/images/service_image';
            } else if (file.fieldname === 'reject_evidence') {
                uploadPath = 'uploads/images/reject_evidence';
            } else if (file.fieldname === 'question_image') {
                uploadPath = 'uploads/images/question_image';
            } else if (file.fieldname === 'conversation_pdf') {
                uploadPath = 'uploads/documents/conversation_pdf';
            } else if (file.fieldname === 'conversation_image') {
                uploadPath = 'uploads/images/conversation_image';
            } else if (file.fieldname === 'identification_document') {
                uploadPath = 'uploads/documents/identification_document';
            } else if (file.fieldname === 'beforeImages') {
                uploadPath = 'uploads/images/task_images/beforeImages';
            } else if (file.fieldname === 'afterImages') {
                uploadPath = 'uploads/images/task_images/afterImages';
            } else if (file.fieldname === 'report_evidence') {
                uploadPath = 'uploads/images/report_evidence';
            } else {
                uploadPath = 'uploads';
            }

            // Sanitize the filename just like in the original code
            const sanitizedOriginalName = file.originalname
                .replace(/\s+/g, '_')
                .replace(/[^\w.-]+/g, '');

            const name = Date.now() + '-' + sanitizedOriginalName;

            // Construct the full S3 key (path + filename)
            const fullPath = `${uploadPath}/${name}`;

            cb(null, fullPath);
        },
    });

    const upload = multer({
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 50 * 1024 * 1024, // 50MB limit, adjust as needed
        },
    }).fields([
        { name: 'image', maxCount: 1 },
        { name: 'profile_image', maxCount: 1 },
        { name: 'category_image', maxCount: 2 },
        { name: 'question_image', maxCount: 2 },
        { name: 'reject_evidence', maxCount: 2 },
        { name: 'task_attachments', maxCount: 5 },
        { name: 'service_image', maxCount: 5 },
        { name: 'conversation_image', maxCount: 5 },
        { name: 'conversation_pdf', maxCount: 2 },
        { name: 'identification_document', maxCount: 1 },
        { name: 'beforeImages', maxCount: 8 },
        { name: 'report_evidence', maxCount: 8 },
        { name: 'afterImages', maxCount: 8 },
    ]);

    return upload;
};

export const getCloudFrontUrl = (s3FilePath: string): string => {
    return `${process.env.CLOUDFRONT_URL}/${s3FilePath}`;
};
