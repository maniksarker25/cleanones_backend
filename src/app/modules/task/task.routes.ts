import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import taskController from './task.controller';
import taskValidations from './task.validation';

const router = Router();

router.post(
    '/create-task',
    auth(USER_ROLE.manager),
    validateRequest(taskValidations.createTaskValidationSchema),
    taskController.createTask
);

router.patch(
    '/update-task/:id',
    auth(USER_ROLE.manager),
    validateRequest(taskValidations.updateTaskValidationSchema),
    taskController.updateTask
);

router.delete(
    '/delete-task/:id',
    auth(USER_ROLE.manager),
    taskController.deleteTask
);

router.get(
    '/all-tasks/:roomId',
    auth(USER_ROLE.manager),
    taskController.getAllTasksByRoom
);

router.get(
    '/single-task/:id',
    auth(USER_ROLE.manager),
    taskController.getSingleTask
);

export const taskRoutes = router;
