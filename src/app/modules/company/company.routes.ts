import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import companyController from './company.controller';
import companyValidations from './company.validation';

const router = Router();

router.post(
    '/create-company',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    validateRequest(companyValidations.createCompanyValidationSchema),
    companyController.createCompany
);

router.get(
    '/all-companies',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    companyController.getAllCompanies
);

router.get(
    '/single-company/:id',
    auth(USER_ROLE.superAdmin, USER_ROLE.admin),
    companyController.getSingleCompany
);

router.patch(
    '/update-my-company',
    auth(USER_ROLE.company_admin),
    validateRequest(companyValidations.updateCompanyValidationSchema),
    companyController.updateMyCompany
);

export const companyRoutes = router;
