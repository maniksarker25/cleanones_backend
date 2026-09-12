import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import workerController from './worker.controller';
import workerValidations from './worker.validation';

const router = Router();

router.patch(
    '/my-availability',
    auth(USER_ROLE.worker),
    validateRequest(workerValidations.availabilityValidationSchema),
    workerController.updateMyAvailability
);

router.use(auth(USER_ROLE.manager));

router.post(
    '/create-worker',
    validateRequest(workerValidations.createWorkerValidationSchema),
    workerController.createWorker
);
router.patch(
    '/update-worker/:id',
    validateRequest(workerValidations.updateWorkerValidationSchema),
    workerController.updateWorker
);
router.delete('/delete-worker/:id', workerController.deleteWorker);
router.get('/all-workers', workerController.getAllWorkers);
router.get('/single-worker/:id', workerController.getSingleWorker);

export const workerRoutes = router;
