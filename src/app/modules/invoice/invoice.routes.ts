import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import invoiceController from './invoice.controller';
import invoiceValidations from './invoice.validation';

const router = Router();

router.post(
    '/create-invoice',
    auth(USER_ROLE.manager),
    validateRequest(invoiceValidations.createInvoiceValidationSchema),
    invoiceController.createInvoice
);

router.get(
    '/all-invoices',
    auth(USER_ROLE.manager),
    invoiceController.getAllInvoices
);

router.get(
    '/my-invoices',
    auth(USER_ROLE.worker),
    invoiceController.getMyInvoices
);

export const invoiceRoutes = router;
