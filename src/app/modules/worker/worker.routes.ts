import { Router } from 'express';
import auth from '../../middlewares/auth';
import csvUpload from '../../middlewares/csvUpload';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import workerController from './worker.controller';
import workerCompanyAdminController from './worker.company_admin.controller';
import workerValidations from './worker.validation';

const router = Router();

router.get(
    '/my-availability',
    auth(USER_ROLE.worker),
    workerController.getMyAvailability
);
router.patch(
    '/my-availability',
    auth(USER_ROLE.worker),
    validateRequest(workerValidations.availabilityValidationSchema),
    workerController.updateMyAvailability
);

router.get(
    '/company-admin/get-all-workers',
    auth(USER_ROLE.company_admin),
    workerCompanyAdminController.getAllWorkers
);
router.get(
    '/company-admin/get-single-worker/:id',
    auth(USER_ROLE.company_admin),
    workerCompanyAdminController.getSingleWorker
);

router.use(auth(USER_ROLE.manager));

router.post(
    '/create-worker',
    validateRequest(workerValidations.createWorkerValidationSchema),
    workerController.createWorker
);
router.post(
    '/bulk-upload',
    csvUpload,
    workerController.bulkUploadWorkers
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
