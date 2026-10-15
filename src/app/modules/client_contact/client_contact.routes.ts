import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import controller from './client_contact.controller';
import clientContactCompanyAdminController from './client_contact.company_admin.controller';
import validations from './client_contact.validation';

const router = Router();

router.get(
    '/company-admin/get-all-client-contacts',
    auth(USER_ROLE.company_admin),
    clientContactCompanyAdminController.getAllClientContacts
);
router.get(
    '/company-admin/get-single-client-contact/:id',
    auth(USER_ROLE.company_admin),
    clientContactCompanyAdminController.getSingleClientContact
);

router.use(auth(USER_ROLE.manager));

router.post(
    '/create-client-contact',
    validateRequest(validations.createClientContactValidationSchema),
    controller.createClientContact
);
router.patch(
    '/update-client-contact/:id',
    validateRequest(validations.updateClientContactValidationSchema),
    controller.updateClientContact
);
router.delete('/delete-client-contact/:id', controller.deleteClientContact);
router.get('/all-client-contacts', controller.getAllClientContacts);
router.get('/single-client-contact/:id', controller.getSingleClientContact);

export const clientContactRoutes = router;
