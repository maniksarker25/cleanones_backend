import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import shiftController from './shift.controller';
import shiftValidations from './shift.validation';

const router = Router();

router.get('/my-shifts', auth(USER_ROLE.worker), shiftController.listMyShifts);

router.get('/:planId', auth(USER_ROLE.manager), shiftController.listShifts);

router.get(
    '/:planId/:date',
    auth(USER_ROLE.manager),
    shiftController.getShift
);

router.patch(
    '/:planId/:date/assign-workers',
    auth(USER_ROLE.manager),
    validateRequest(shiftValidations.assignWorkersValidationSchema),
    shiftController.assignWorkers
);

router.patch(
    '/:planId/:date/status',
    auth(USER_ROLE.manager),
    validateRequest(shiftValidations.updateStatusValidationSchema),
    shiftController.updateStatus
);

router.patch(
    '/:planId/:date/tasks/:taskId/photo',
    auth(USER_ROLE.worker),
    validateRequest(shiftValidations.uploadTaskPhotoValidationSchema),
    shiftController.uploadTaskPhoto
);

export const shiftRoutes = router;
