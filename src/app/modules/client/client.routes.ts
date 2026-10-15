import { Router } from 'express';
import auth from '../../middlewares/auth';
import csvUpload from '../../middlewares/csvUpload';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import clientController from './client.controller';
import clientCompanyAdminController from './client.company_admin.controller';
import clientValidations from './client.validation';

const router = Router();

router.post(
    '/create-client',
    auth(USER_ROLE.manager),
    validateRequest(clientValidations.createClientValidationSchema),
    clientController.createClient
);

router.post(
    '/bulk-upload',
    auth(USER_ROLE.manager),
    csvUpload,
    clientController.bulkUploadClients
);

router.patch(
    '/update-client/:id',
    auth(USER_ROLE.manager),
    validateRequest(clientValidations.updateClientValidationSchema),
    clientController.updateClient
);

router.delete(
    '/delete-client/:id',
    auth(USER_ROLE.manager),
    clientController.deleteClient
);

router.get(
    '/all-clients',
    auth(USER_ROLE.manager),
    clientController.getAllClients
);

router.get(
    '/overview',
    auth(USER_ROLE.client),
    clientController.getClientOverview
);

router.get(
    '/schedule-roster',
    auth(USER_ROLE.client),
    clientController.getClientScheduleRoster
);

router.get(
    '/active-progress',
    auth(USER_ROLE.client),
    clientController.getClientActiveProgress
);

router.get(
    '/shift-stats',
    auth(USER_ROLE.client),
    clientController.getClientShiftStats
);

router.get(
    '/totals',
    auth(USER_ROLE.client),
    clientController.getClientTotals
);

router.get(
    '/roster',
    auth(USER_ROLE.client),
    clientController.getClientPlanRoster
);

router.get(
    '/company-admin/get-all-clients',
    auth(USER_ROLE.company_admin),
    clientCompanyAdminController.getAllClients
);
router.get(
    '/company-admin/get-single-client/:id',
    auth(USER_ROLE.company_admin),
    clientCompanyAdminController.getSingleClient
);

export const clientRoutes = router;
