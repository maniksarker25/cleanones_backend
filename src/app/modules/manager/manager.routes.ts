import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import managerController from './manager.controller';
import managerValidations from './manager.validation';

const router = Router();

router.post(
    '/create-manager',
    auth(USER_ROLE.company_admin),
    validateRequest(managerValidations.createManagerValidationSchema),
    managerController.createManager
);

router.post(
    '/create-manager-for-company',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    validateRequest(managerValidations.createManagerForCompanyValidationSchema),
    managerController.createManagerForCompany
);

router.get(
    '/all-managers',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin, USER_ROLE.company_admin),
    managerController.getAllManagers
);

router.get(
    '/single-manager/:id',
    auth(USER_ROLE.company_admin),
    managerController.getSingleManager
);

router.patch(
    '/update-manager/:id',
    auth(USER_ROLE.company_admin),
    validateRequest(managerValidations.updateManagerValidationSchema),
    managerController.updateManager
);

router.patch(
    '/block-manager/:id',
    auth(USER_ROLE.company_admin),
    managerController.blockManager
);

router.patch(
    '/unblock-manager/:id',
    auth(USER_ROLE.company_admin),
    managerController.unblockManager
);

export const managerRoutes = router;
