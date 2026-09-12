import { Request } from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../utilities/cloudinary';

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req: Request, file) => {
        let folder = 'uploads';

        switch (file.fieldname) {
            case 'profile_image':
                folder = 'images/profile';
                break;
            case 'category_image':
                folder = 'images/category';
                break;
            case 'task_attachments':
                folder = 'images/task_attachments';
                break;
            case 'service_image':
                folder = 'images/service_image';
                break;
            case 'reject_evidence':
                folder = 'images/reject_evidence';
                break;
            case 'question_image':
                folder = 'images/question_image';
                break;
            case 'conversation_pdf':
            case 'identification_document':
                folder = 'documents';
                break;
        }

        return {
            folder: folder,
            resource_type: file.mimetype.startsWith('video') ? 'video' : 'auto', // 'auto' for images & pdf
            public_id: `${Date.now()}-${file.originalname.replace(
                /\s+/g,
                '_'
            )}`,
        };
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

export const uploadFile = () =>
    upload.fields([
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
    ]);
