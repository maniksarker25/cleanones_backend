import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import notificationController from './notification.controller';
const router = express.Router();

router.get(
    '/get-notifications',
    auth(
        USER_ROLE.superAdmin,
        USER_ROLE.admin,
        USER_ROLE.manager,
        USER_ROLE.client,
        USER_ROLE.worker
    ),
    notificationController.getAllNotification
);
router.patch(
    '/see-notifications',
    auth(
        USER_ROLE.superAdmin,
        USER_ROLE.admin,
        USER_ROLE.manager,
        USER_ROLE.client,
        USER_ROLE.worker
    ),
    notificationController.seeNotification
);

router.delete(
    '/delete-notification/:id',
    auth(
        USER_ROLE.superAdmin,
        USER_ROLE.admin,
        USER_ROLE.manager,
        USER_ROLE.client,
        USER_ROLE.worker
    ),
    notificationController.deleteNotification
);

export const notificationRoutes = router;
