import express from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../user/user.constant';
import LegalInfoController from './legal_info.controller';

const router = express.Router();

router.post(
  '/add-update',
  auth(USER_ROLE.superAdmin),
  LegalInfoController.addOrUpdateLegalInfo,
);
router.get('/get', LegalInfoController.getLegalInfoByVenueOwnerId);

export const legalInfoRoutes = router;
