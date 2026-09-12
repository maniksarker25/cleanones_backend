import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import messageController from './message.controller';

const router = express.Router();

router.get(
    '/get-messages/:id',
    auth(USER_ROLE.client, USER_ROLE.worker),
    messageController.getMessages
);

export const messageRoutes = router;
