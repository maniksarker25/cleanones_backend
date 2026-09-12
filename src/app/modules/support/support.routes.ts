import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import SupportController from './support.controller';

const router = express.Router();

router.post(
    '/create',
    auth(USER_ROLE.client, USER_ROLE.worker),
    SupportController.createSupport
);

router.get(
    '/get-all',
    auth(USER_ROLE.superAdmin),
    SupportController.getAllSupport
);

router.patch(
    '/update-status/:id',
    auth(USER_ROLE.superAdmin),
    SupportController.updateStatus
);

router.get('/get-single/:id', SupportController.getSingle);
export const supportRoutes = router;
