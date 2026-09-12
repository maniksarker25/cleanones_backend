import { NextFunction, Request, Response, Router } from 'express';
import { uploadFile } from '../../helper/multer-s3-uploader';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import AdminController from './admin.controller';
import AdminValidations from './admin.validation';

const router = Router();

router.post(
    '/create-admin',
    auth(USER_ROLE.superAdmin),
    uploadFile(),
    (req: Request, res: Response, next: NextFunction) => {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data);
        }

        next();
    },
    validateRequest(AdminValidations.createAdminProfileValidationSchema),
    AdminController.createAdmin
);
router.patch(
    '/update-admin',
    auth(USER_ROLE.superAdmin),
    uploadFile(),
    (req: Request, res: Response, next: NextFunction) => {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data);
        }

        next();
    },
    validateRequest(AdminValidations.updateAdminProfileValidationSchema),
    AdminController.updateAdminProfile
);

router.delete(
    '/delete-admin/:id',
    auth(USER_ROLE.superAdmin),
    AdminController.deleteAdmin
);

router.patch(
    '/update-admin-status/:id',
    auth(USER_ROLE.superAdmin),
    AdminController.updateShopStatus
);

router.get(
    '/all-admins',
    auth(USER_ROLE.superAdmin),
    AdminController.getAllAdmin
);

export const AdminRoutes = router;
