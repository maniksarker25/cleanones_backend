import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import roomController from './room.controller';
import roomCompanyAdminController from './room.company_admin.controller';
import roomValidations from './room.validation';

const router = Router();

router.post(
    '/create-room',
    auth(USER_ROLE.manager),
    validateRequest(roomValidations.createRoomValidationSchema),
    roomController.createRoom
);

router.patch(
    '/update-room/:id',
    auth(USER_ROLE.manager),
    validateRequest(roomValidations.updateRoomValidationSchema),
    roomController.updateRoom
);

router.delete(
    '/delete-room/:id',
    auth(USER_ROLE.manager,),
    roomController.deleteRoom
);

router.get(
    '/all-rooms',
    auth(USER_ROLE.manager),
    roomController.getAllRooms
);

router.get(
    '/all-rooms/:locationId',
    auth(USER_ROLE.manager),
    roomController.getAllRoomsByLocation
);

router.get(
    '/my-rooms/:locationId',
    auth(USER_ROLE.client),
    roomController.getMyRooms
);

router.get(
    '/single-room/:id',
    auth(USER_ROLE.manager),
    roomController.getSingleRoom
);

router.get(
    '/company-admin/get-all-rooms',
    auth(USER_ROLE.company_admin),
    roomCompanyAdminController.getAllRooms
);
router.get(
    '/company-admin/get-single-room/:id',
    auth(USER_ROLE.company_admin),
    roomCompanyAdminController.getSingleRoom
);

export const roomRoutes = router;
