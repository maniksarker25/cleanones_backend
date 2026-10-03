"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserProfileValidationSchema = exports.registerUserValidationSchema = void 0;
const zod_1 = require("zod");
const enum_1 = require("../../utilities/enum");
// Zod schema for user creation
exports.registerUserValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        userData: zod_1.z.object({
            firstName: zod_1.z.string().min(1, 'Name is required').max(100),
            lastName: zod_1.z.string().min(1, 'Name is required').max(100),
            email: zod_1.z
                .string({ invalid_type_error: 'Please add a valid email' })
                .email('Invalid email format')
                .toLowerCase(),
        }),
        password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
        confirmPassword: zod_1.z.string().min(6, 'Confirm password is required'),
        role: zod_1.z.enum(['worker', 'client', 'manager'], {
            required_error: 'Role is required',
        }),
    }),
});
exports.updateUserProfileValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().trim().min(1, 'Name cannot be empty').optional(),
        phone: zod_1.z.string().min(6, 'Phone number is too short').optional(),
        profile_image: zod_1.z
            .string()
            .url('Invalid image URL')
            .optional()
            .or(zod_1.z.literal('')),
        address: zod_1.z.string().optional(),
        dateOfBirth: zod_1.z.coerce.date().optional().nullable(),
    }),
});
//
const loginValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required' }),
        password: zod_1.z.string({ required_error: 'Password is required' }),
    }),
});
const changePasswordValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        oldPassword: zod_1.z.string({ required_error: 'Old password is required' }),
        newPassword: zod_1.z.string({ required_error: 'Password is required' }),
    }),
});
// refresh token validation schema -----------
const refreshTokenValidationSchema = zod_1.z.object({
    cookies: zod_1.z.object({
        refreshToken: zod_1.z.string({ required_error: 'Refresh token is required' }),
    }),
});
// forget password validation schema
const forgetPasswordValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'User email is required' }),
    }),
});
// reset password validation schema
const resetPasswordValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'User email is required' }),
        newPassword: zod_1.z.string({ required_error: 'New password is required' }),
    }),
});
const verifyCodeValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required' }),
        verifyCode: zod_1.z.number({ required_error: 'Verify code is required' }),
    }),
});
const resendVerifyCodeSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string({ required_error: 'Email is required' }),
    }),
});
const changeUserStatus = zod_1.z.object({
    body: zod_1.z.object({
        status: zod_1.z.enum(Object.values(enum_1.ENUM_USER_STATUS)),
    }),
});
const deleteUserAccountValidationSchema = zod_1.z.object({
    body: zod_1.z.object({
        password: zod_1.z.string({ required_error: 'Password is required' }),
    }),
});
const userValidations = {
    registerUserValidationSchema: exports.registerUserValidationSchema,
    loginValidationSchema,
    changePasswordValidationSchema,
    refreshTokenValidationSchema,
    forgetPasswordValidationSchema,
    resetPasswordValidationSchema,
    verifyCodeValidationSchema,
    resendVerifyCodeSchema,
    changeUserStatus,
    deleteUserAccountValidationSchema,
    updateUserProfileValidationSchema: exports.updateUserProfileValidationSchema,
};
exports.default = userValidations;
