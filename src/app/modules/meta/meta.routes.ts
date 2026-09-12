import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import MetaController from './meta.controller';

const router = express.Router();

router.get(
    '/meta-data',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    MetaController.getDashboardMetaData
);

router.get(
    '/customer-chart-data',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    MetaController.getCustomerChartData
);
router.get(
    '/provider-chart-data',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    MetaController.getProviderChartData
);
router.get(
    '/earning-chart-data',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    MetaController.getEarningChartData
);
router.get(
    '/get-activities',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    MetaController.getActivities
);
export const metaRoutes = router;
