import express from 'express';
import { uploadFile } from '../../helper/multer-s3-uploader';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import fileController from './file-upload.controller';

const router = express.Router();

router.post(
    '/upload-conversation-files',
    auth(USER_ROLE.worker, USER_ROLE.client,USER_ROLE.manager),
    uploadFile(),
    fileController.uploadConversationFiles
);
router.post(
    '/delete-files',
        auth(USER_ROLE.worker, USER_ROLE.client,USER_ROLE.manager),
    fileController.deleteFiles
);

export const fileUploadRoutes = router;
