import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import chatController from './chat.controller';
import chatValidations from './chat.validation';

const router = Router();

router.get(
    '/my-groups',
    auth(USER_ROLE.manager, USER_ROLE.client, USER_ROLE.worker),
    chatController.getMyGroups
);

router.get(
    '/my-direct-chats',
    auth(USER_ROLE.client, USER_ROLE.worker),
    chatController.getMyDirectChats
);

router.get(
    '/:id/members',
    auth(USER_ROLE.manager, USER_ROLE.client, USER_ROLE.worker),
    chatController.getGroupMembers
);

router.patch(
    '/:id/rename',
    auth(USER_ROLE.manager),
    validateRequest(chatValidations.renameChatGroupValidationSchema),
    chatController.renameChatGroup
);

export const chatRoutes = router;
