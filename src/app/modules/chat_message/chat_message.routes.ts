import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import chatMessageController from './chat_message.controller';

const router = Router();

router.get(
    '/:chatId',
    auth(USER_ROLE.manager, USER_ROLE.client, USER_ROLE.worker),
    chatMessageController.getChatMessages
);

router.delete(
    '/:id',
    auth(USER_ROLE.manager, USER_ROLE.client, USER_ROLE.worker),
    chatMessageController.deleteChatMessage
);

export const chatMessageRoutes = router;
