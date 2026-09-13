import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import locationController from './location.controller';
import locationValidations from './location.validation';

const router = Router();

router.post(
    '/create-location',
    auth(USER_ROLE.manager),
    validateRequest(locationValidations.createLocationValidationSchema),
    locationController.createLocation
);

router.patch(
    '/update-location/:id',
    auth(USER_ROLE.manager),
    validateRequest(locationValidations.updateLocationValidationSchema),
    locationController.updateLocation
);

router.delete(
    '/delete-location/:id',
    auth(USER_ROLE.manager),
    locationController.deleteLocation
);

router.get(
    '/all-locations',
    auth(USER_ROLE.manager),
    locationController.getAllLocations
);

router.get(
    '/client-locations/:clientId',
    auth(USER_ROLE.manager),
    locationController.getClientLocations
);

// Client: get their own locations
router.get(
    '/my-locations',
    auth(USER_ROLE.client),
    locationController.getMyLocations
);

router.get(
    '/single-location/:id',
    auth(USER_ROLE.manager,USER_ROLE.client),
    locationController.getSingleLocation
);

export const locationRoutes = router;
