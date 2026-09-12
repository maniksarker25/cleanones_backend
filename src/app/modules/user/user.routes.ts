import { Router } from 'express';
import { authLimiter } from '../../config/rateLimit.config';
import { uploadFile } from '../../helper/multer-s3-uploader';
import auth from '../../middlewares/auth';
import parseJsonBody from '../../middlewares/parseJsonBody';
import validateRequest from '../../middlewares/validateRequest';
import CustomerValidations from '../customer/customer.validation';
import { USER_ROLE } from './user.constant';
import userControllers from './user.controller';
import userValidations from './user.validation';

const router = Router();

router.post(
    '/sign-up',
    authLimiter,

    validateRequest(userValidations.registerUserValidationSchema),
    userControllers.registerUser
);
//
router.post(
    '/verify-code',
    authLimiter,

    validateRequest(userValidations.verifyCodeValidationSchema),
    userControllers.verifyCode
);

router.post(
    '/resend-verify-code',
    authLimiter,

    validateRequest(userValidations.resendVerifyCodeSchema),
    userControllers.resendVerifyCode
);

router.get(
    '/get-my-profile',
    auth(
        USER_ROLE.client,
        USER_ROLE.worker,
        USER_ROLE.admin,
        USER_ROLE.superAdmin
    ),
    userControllers.getMyProfile
);
router.patch(
    '/update-profile',

    auth(
        USER_ROLE.client,
        USER_ROLE.worker,
        USER_ROLE.admin,
        USER_ROLE.superAdmin
    ),
    uploadFile(),
    parseJsonBody(),
    validateRequest(userValidations.updateUserProfileValidationSchema),
    userControllers.updateUserProfile
);
//===
router.patch(
    '/block-unblock/:id',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    userControllers.changeUserStatus
);
router.post(
    '/delete-account',
    auth(USER_ROLE.client),
    validateRequest(userValidations.deleteUserAccountValidationSchema),
    userControllers.deleteUserAccount
);

router.post(
    '/upgrade-account',
    auth(USER_ROLE.client, USER_ROLE.worker),
    userControllers.upgradeAccount
);

export const userRoutes = router;
