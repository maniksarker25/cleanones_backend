import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import roomController from './room.controller';
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
    '/all-rooms/:locationId',
    auth(USER_ROLE.manager),
    roomController.getAllRoomsByLocation
);

router.get(
    '/single-room/:id',
    auth(USER_ROLE.manager),
    roomController.getSingleRoom
);

export const roomRoutes = router;
