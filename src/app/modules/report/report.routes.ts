import express from 'express';
import { uploadFile } from '../../helper/multer-s3-uploader';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import reportController from './report.controller';
import reportValidations from './report.validation';

const router = express.Router();

router.post(
    '/create',
    auth(USER_ROLE.client, USER_ROLE.worker),
    uploadFile(),
    (req, res, next) => {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data);
        }
        next();
    },
    validateRequest(reportValidations.createReportValidationSchema),
    reportController.createReport
);

router.get('/get-all', reportController.getAll);
router.get('/get-single/:id', reportController.getSingle);
router.post(
    '/mark-resolved/:id',
    auth(USER_ROLE.superAdmin),
    reportController.markAsResolved
);
export const reportRoutes = router;
