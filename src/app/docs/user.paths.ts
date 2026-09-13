// User contracts are kept separate from the larger route catalog for readability.
const jsonBody = (schema: Record<string, unknown>) => ({
    required: true,
    content: { 'application/json': { schema } },
});
const object = (properties: Record<string, unknown>, required: string[] = []) => ({
    type: 'object', properties, ...(required.length ? { required } : {}),
});
const string = { type: 'string' };
const email = { type: 'string', example: 'client@yopmail.com' };
const profile = {
    type: 'object', nullable: true, additionalProperties: true,
    description: 'Role-specific profile. Fields depend on the Client, Worker, Admin or SuperAdmin model. Reads populate user with account flags; updates return the user reference.',
};
const success = (data: Record<string, unknown>, message: string) => ({
    description: 'Successful request.',
    content: { 'application/json': { schema: object({
        success: { type: 'boolean', enum: [true] },
        message: { type: 'string', example: message }, data,
    }, ['success', 'message', 'data']) } },
});
const errors = Object.fromEntries([
    ['400', 'Invalid request or business rule failure.'],
    ['401', 'Missing or invalid token, blocked account, or role not allowed.'],
    ['403', 'Inactive account or incorrect password.'],
    ['404', 'User or profile not found; registration also wraps service failures as 404.'],
    ['429', 'Rate limit exceeded.'],
    ['500', 'Server error; the current error handler also returns 500 for Zod validation failures.'],
].map(([code, description]) => [code, {
    description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
}]));
const access = (roles: string[]) => ({
    tags: ['Users'], 'x-roles': roles,
    security: roles.length ? [{ bearerAuth: [] }] : [],
});
const profileRoles = ['client', 'worker', 'admin', 'superAdmin'];
const updateProfile = object({
    name: { type: 'string', minLength: 1, example: 'Alex Morgan' },
    phone: { type: 'string', minLength: 6, example: '+8801700000000' },
    profile_image: { type: 'string', description: 'Image URL or an empty string.' },
    address: { type: 'string', example: 'Dhaka, Bangladesh' },
    dateOfBirth: { type: 'string', format: 'date', nullable: true },
});

const userPaths = {
    '/user/sign-up': {
        post: {
            ...access([]), operationId: 'postUserSignUp', summary: 'Register a user',
            description: 'Public, rate-limited registration. Passwords must match. Current contract mismatch: validation requires nested userData.firstName/lastName/email, while the service reads name/email/phone at the top level. The schema below describes validation, not a guaranteed working registration payload. Service password hashing also overlaps the User save hook. Returns a role-specific profile when successful and sends a verification email.',
            requestBody: jsonBody(object({
                userData: object({
                    firstName: { type: 'string', minLength: 1, maxLength: 100, example: 'Alex' },
                    lastName: { type: 'string', minLength: 1, maxLength: 100, example: 'Morgan' },
                    email: { ...email, format: 'email' },
                }, ['firstName', 'lastName', 'email']),
                password: { type: 'string', minLength: 6, format: 'password' },
                confirmPassword: { type: 'string', minLength: 6, format: 'password' },
                role: { type: 'string', enum: ['worker', 'client', 'manager'] },
            }, ['userData', 'password', 'confirmPassword', 'role'])),
            responses: { ...errors, '200': success(profile, 'User registration successful. Check email for verify your account') },
        },
    },
    '/user/verify-code': {
        post: {
            ...access([]), operationId: 'postUserVerifyCode', summary: 'Verify an account by email code',
            description: 'Public, rate-limited endpoint. Checks the stored code and expiry, verifies the account, and returns access and refresh tokens in the JSON body.',
            requestBody: jsonBody(object({ email, verifyCode: { type: 'number', example: 123456 } }, ['email', 'verifyCode'])),
            responses: { ...errors, '200': success(object({ accessToken: string, refreshToken: string, role: string }, ['accessToken', 'refreshToken', 'role']), 'Successfully verified your account with email') },
        },
    },
    '/user/resend-verify-code': {
        post: {
            ...access([]), operationId: 'postUserResendVerifyCode', summary: 'Resend account verification code',
            description: 'Public, rate-limited endpoint. Replaces the verification code, sets a five-minute expiry, and emails the code.',
            requestBody: jsonBody(object({ email }, ['email'])),
            responses: { ...errors, '200': success({ nullable: true, example: null }, 'Verify code send to your email inbox') },
        },
    },
    '/user/get-my-profile': {
        get: {
            ...access(profileRoles), operationId: 'getUserMyProfile', summary: 'Get my profile',
            description: 'Returns the authenticated account profile with populated user account flags. Managers are not allowed by this route. Admin is listed in the route, but its authentication profile lookup is currently unfinished.',
            responses: { ...errors, '200': success(profile, 'Successfully retrieved your data') },
        },
    },
    '/user/update-profile': {
        patch: {
            ...access(profileRoles), operationId: 'patchUserUpdateProfile', summary: 'Update my profile',
            description: 'Partial profile update. Accepts JSON or multipart with a JSON string in data and an optional profile_image upload (maximum 50 MB). Only fields supported by the role-specific model persist. Worker working_days must use the dedicated availability endpoint. Managers are not allowed by this route; admin authentication lookup is unfinished.',
            requestBody: {
                required: true, content: {
                    'application/json': { schema: updateProfile },
                    'multipart/form-data': { schema: object({
                        data: { type: 'string', description: 'JSON-encoded profile update.', example: '{"name":"Alex Morgan","phone":"+8801700000000"}' },
                        profile_image: { type: 'string', format: 'binary' },
                    }) },
                },
            },
            responses: { ...errors, '200': success(profile, 'Profile updated successfully') },
        },
    },
    '/user/block-unblock/{id}': {
        patch: {
            ...access(['superAdmin', 'admin']), operationId: 'patchUserBlockUnblock', summary: 'Toggle a user’s blocked status',
            description: 'No request body. Toggles isBlocked for the User ID supplied in the path. Returns the updated User document. Admin authentication lookup is unfinished.',
            parameters: [{ name: 'id', in: 'path', required: true, description: 'User ID, not a profile ID.', schema: { $ref: '#/components/schemas/ObjectId' } }],
            responses: { ...errors, '200': success({
                ...object({ _id: { $ref: '#/components/schemas/ObjectId' }, role: string, isBlocked: { type: 'boolean' } }),
                additionalProperties: true, description: 'Updated User document; the service does not project its fields.',
            }, 'Customer is Blocked') },
        },
    },
    '/user/delete-account': {
        post: {
            ...access(['client']), operationId: 'postUserDeleteAccount', summary: 'Delete my client account',
            description: 'Checks the password, then permanently deletes the authenticated client profile and User document. Related locations, rooms and tasks are not deleted by this service.',
            requestBody: jsonBody(object({ password: { type: 'string', format: 'password' } }, ['password'])),
            responses: { ...errors, '200': success({ nullable: true, example: null }, 'Your account deleted successfully') },
        },
    },
    '/user/upgrade-account': {
        post: {
            ...access(['client', 'worker']), operationId: 'postUserUpgradeAccount', summary: 'Upgrade account (not implemented)',
            description: 'Mounted endpoint with no request body. After authentication, the service always returns 400: Upgrading account is not supported yet.',
            responses: { ...errors, '400': {
                description: 'Upgrading account is not supported yet.',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            } },
        },
    },
};

export default userPaths;
