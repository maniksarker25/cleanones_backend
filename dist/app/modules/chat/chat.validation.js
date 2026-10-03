"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const renameChatGroupValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string({ required_error: 'Name is required' }).min(1),
    }),
});
const chatValidations = {
    renameChatGroupValidationSchema,
};
exports.default = chatValidations;
