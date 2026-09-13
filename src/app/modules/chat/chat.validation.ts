import { z } from 'zod';

const renameChatGroupValidationSchema = z.object({
    body: z.object({
        name: z.string({ required_error: 'Name is required' }).min(1),
    }),
});

const chatValidations = {
    renameChatGroupValidationSchema,
};

export default chatValidations;
