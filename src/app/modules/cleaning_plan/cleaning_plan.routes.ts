import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import cleaningPlanController from './cleaning_plan.controller';
import cleaningPlanValidations from './cleaning_plan.validation';

const router = Router();

router.post(
    '/create-cleaning-plan',
    auth(USER_ROLE.manager),
    validateRequest(
        cleaningPlanValidations.createCleaningPlanValidationSchema
    ),
    cleaningPlanController.createCleaningPlan
);

router.patch(
    '/update-cleaning-plan/:id',
    auth(USER_ROLE.manager),
    validateRequest(
        cleaningPlanValidations.updateCleaningPlanValidationSchema
    ),
    cleaningPlanController.updateCleaningPlan
);

router.delete(
    '/delete-cleaning-plan/:id',
    auth(USER_ROLE.manager),
    cleaningPlanController.deleteCleaningPlan
);

router.get(
    '/all-cleaning-plans',
    auth(USER_ROLE.manager),
    cleaningPlanController.getAllCleaningPlans
);

router.get(
    '/single-cleaning-plan/:id',
    auth(USER_ROLE.manager),
    cleaningPlanController.getSingleCleaningPlan
);

export const cleaningPlanRoutes = router;
