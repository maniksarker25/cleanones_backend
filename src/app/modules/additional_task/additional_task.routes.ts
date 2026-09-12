import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import additionalTaskController from './additional_task.controller';
import additionalTaskValidations from './additional_task.validation';

const router = Router();

// ─── Client routes ────────────────────────────────────────────────────────────

router.post(
    '/create-additional-task',
    auth(USER_ROLE.client),
    validateRequest(
        additionalTaskValidations.createAdditionalTaskValidationSchema
    ),
    additionalTaskController.createAdditionalTask
);

router.patch(
    '/update-additional-task/:id',
    auth(USER_ROLE.client),
    validateRequest(
        additionalTaskValidations.updateAdditionalTaskValidationSchema
    ),
    additionalTaskController.updateAdditionalTask
);

router.delete(
    '/delete-additional-task/:id',
    auth(USER_ROLE.client),
    additionalTaskController.deleteAdditionalTask
);

// ─── Manager routes ───────────────────────────────────────────────────────────

router.patch(
    '/approve-additional-task/:id',
    auth(USER_ROLE.manager),
    validateRequest(
        additionalTaskValidations.approveAdditionalTaskValidationSchema
    ),
    additionalTaskController.approveAdditionalTask
);

// ─── Shared get routes ────────────────────────────────────────────────────────

router.get(
    '/all-additional-tasks/:planId',
    auth(USER_ROLE.manager, USER_ROLE.client),
    additionalTaskController.getAllAdditionalTasksByPlan
);

router.get(
    '/single-additional-task/:id',
    auth(USER_ROLE.manager, USER_ROLE.client),
    additionalTaskController.getSingleAdditionalTask
);

export const additionalTaskRoutes = router;
