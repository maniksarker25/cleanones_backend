import { Router } from 'express';
import validateRequest from '../../middlewares/validateRequest';

import { authLimiter } from '../../config/rateLimit.config';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import authControllers from './auth.controller';
import authValidations from './auth.validation';

const router = Router();

router.post(
    '/login',
    authLimiter,
    validateRequest(authValidations.loginValidationSchema),
    authControllers.loginUser
);

router.post(
    '/change-password',
    authLimiter,
    auth(
        USER_ROLE.client,
        USER_ROLE.worker,
        USER_ROLE.admin,
        USER_ROLE.superAdmin
    ),
    validateRequest(authValidations.changePasswordValidationSchema),
    authControllers.changePassword
);
router.post(
    '/refresh-token',
    authLimiter,
    validateRequest(authValidations.refreshTokenValidationSchema),
    authControllers.refreshToken
);

router.post(
    '/forget-password',
    authLimiter,

    validateRequest(authValidations.forgetPasswordValidationSchema),
    authControllers.forgetPassword
);
router.post(
    '/reset-password',
    authLimiter,

    validateRequest(authValidations.resetPasswordValidationSchema),
    authControllers.resetPassword
);
router.post(
    '/verify-reset-otp',
    authLimiter,

    validateRequest(authValidations.verifyResetOtpValidationSchema),
    authControllers.verifyResetOtp
);

router.post('/resend-reset-code', authLimiter, authControllers.resendResetCode);
router.get(
    '/all-user',

    authControllers.getAllUser
);

export const authRoutes = router;
