"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSuperAdminSchema = void 0;
const zod_1 = require("zod");
exports.updateSuperAdminSchema = zod_1.z.object({
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    email: zod_1.z
        .string()
        .email('Invalid email format')
        .nonempty('Email is required')
        .optional(),
    profile_image: zod_1.z.string().optional().default(''),
});
const superAdminValidations = {
    updateSuperAdminSchema: exports.updateSuperAdminSchema,
};
exports.default = superAdminValidations;
