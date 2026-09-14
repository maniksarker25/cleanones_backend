import { Router } from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { USER_ROLE } from '../user/user.constant';
import controller from './question_suggestion.controller';
import validations from './question_suggestion.validation';

const router = Router();
router.post(
    '/create-question-suggestion',
    auth(USER_ROLE.manager),
    validateRequest(validations.create),
    controller.create
);
router.patch(
    '/update-question-suggestion/:id',
    auth(USER_ROLE.manager),
    validateRequest(validations.update),
    controller.update
);
router.delete(
    '/delete-question-suggestion/:id',
    auth(USER_ROLE.manager),
    controller.remove
);
router.get('/all-question-suggestions', controller.getAll);

export const questionSuggestionRoutes = router;
