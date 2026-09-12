import { z } from 'zod';
import { updateUserProfileValidationSchema } from './user.validation';

export type UpdateUserProfileDTO = z.infer<
    typeof updateUserProfileValidationSchema
>['body'];
