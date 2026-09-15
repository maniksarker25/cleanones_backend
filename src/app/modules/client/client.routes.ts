import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import clientController from './client.controller';
import clientValidations from './client.validation';

const router = Router();

router.post(
    '/create-client',
    auth(USER_ROLE.manager),
    validateRequest(clientValidations.createClientValidationSchema),
    clientController.createClient
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

export const clientRoutes = router;
