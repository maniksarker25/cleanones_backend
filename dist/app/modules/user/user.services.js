"use strict";
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../../config"));
const appError_1 = __importDefault(require("../../error/appError"));
const deleteFromS3_1 = require("../../helper/deleteFromS3");
const registerSucessEmail_1 = require("../../mailTemplate/registerSucessEmail");
const sendEmail_1 = __importDefault(require("../../utilities/sendEmail"));
const admin_model_1 = __importDefault(require("../admin/admin.model"));
const client_model_1 = require("../client/client.model");
const worker_model_1 = require("../worker/worker.model");
const manager_model_1 = require("../manager/manager.model");
const device_service_1 = require("../device/device.service");
const superAdmin_model_1 = __importDefault(require("../superAdmin/superAdmin.model"));
const user_constant_1 = require("./user.constant");
const user_model_1 = require("./user.model");
const user_utils_1 = require("./user.utils");
const user_validation_1 = require("./user.validation");
const worker_validation_1 = __importDefault(require("../worker/worker.validation"));
const generateVerifyCode = () => {
    return Math.floor(100000 + Math.random() * 900000);
};
const registerUser = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const { password, confirmPassword, playerId, platform = 'android', role } = payload, profileData = __rest(payload, ["password", "confirmPassword", "playerId", "platform", "role"]);
    // Normalize once, up front — every downstream read of profileData.email
    // (the lookup below, User.create, and the profile record itself) then
    // sees the same lowercase value regardless of how the client typed it.
    if (typeof profileData.email === 'string') {
        profileData.email = profileData.email.trim().toLowerCase();
    }
    if (role === 'worker') {
        profileData.name = worker_validation_1.default.updateWorkerBody.parse({
            name: (_a = profileData.name) !== null && _a !== void 0 ? _a : [(_b = profileData.userData) === null || _b === void 0 ? void 0 : _b.firstName, (_c = profileData.userData) === null || _c === void 0 ? void 0 : _c.lastName]
                .filter(Boolean).join(' '),
        }).name;
    }
    // validate password
    if (password !== confirmPassword) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "Password and confirm password doesn't match");
    }
    const hashedPassword = yield bcrypt_1.default.hash(password, 10);
    const session = yield mongoose_1.default.startSession();
    let user;
    let profile;
    let verifyCode;
    try {
        yield session.withTransaction(() => __awaiter(void 0, void 0, void 0, function* () {
            verifyCode = generateVerifyCode();
            user = yield user_model_1.User.findOne({
                email: profileData.email,
                isDeleted: { $ne: true },
            }).session(session);
            if (user === null || user === void 0 ? void 0 : user.isVerified) {
                throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This email already exists');
            }
            if (!user) {
                [user] = yield user_model_1.User.create([
                    {
                        email: profileData.email,
                        phone: profileData.phone,
                        password: hashedPassword,
                        role,
                        roles: [role],
                        verifyCode,
                        codeExpireIn: new Date(Date.now() + 5 * 60 * 1000),
                        isVerified: false,
                    },
                ], { session });
            }
            else {
                user.password = hashedPassword;
                user.role = role;
                user.roles = [role];
                user.verifyCode = verifyCode;
                user.codeExpireIn = new Date(Date.now() + 5 * 60 * 1000);
                yield user.save({ session });
            }
            const profilePayload = Object.assign(Object.assign({}, profileData), { user: user._id });
            if (role === 'client') {
                profile = yield client_model_1.Client.findOneAndUpdate({ user: user._id }, profilePayload, {
                    upsert: true,
                    new: true,
                    session,
                    setDefaultsOnInsert: true,
                });
            }
            else if (role === 'worker') {
                profile = yield worker_model_1.Worker.findOneAndUpdate({ user: user._id }, profilePayload, {
                    upsert: true,
                    new: true,
                    session,
                    setDefaultsOnInsert: true,
                });
            }
            else if (role === 'manager') {
                profile = yield manager_model_1.Manager.findOneAndUpdate({ user: user._id }, profilePayload, {
                    upsert: true,
                    new: true,
                    session,
                    setDefaultsOnInsert: true,
                });
            }
            user.profileId = profile._id;
            yield user.save({ session });
        }));
        if (playerId) {
            yield (0, device_service_1.upsertDevice)(user.profileId.toString(), playerId, platform);
        }
        yield (0, sendEmail_1.default)({
            email: profileData.email,
            subject: 'Activate Your Account',
            html: (0, registerSucessEmail_1.registrationSuccessEmail)(profileData.name || 'User', verifyCode),
        });
        return profile;
    }
    catch (error) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, (error === null || error === void 0 ? void 0 : error.message) || 'Service unavailable');
    }
    finally {
        session.endSession();
    }
});
exports.registerUser = registerUser;
const verifyCode = (rawEmail, verifyCode) => __awaiter(void 0, void 0, void 0, function* () {
    const email = rawEmail.trim().toLowerCase();
    const user = yield user_model_1.User.findOne({ email, isDeleted: { $ne: true } });
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    if (user.codeExpireIn < new Date(Date.now())) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Verify code is expired');
    }
    if (verifyCode !== user.verifyCode) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "Code doesn't match");
    }
    const result = yield user_model_1.User.findByIdAndUpdate(user._id, { isVerified: true }, { new: true, runValidators: true });
    if (!result) {
        throw new appError_1.default(http_status_1.default.SERVICE_UNAVAILABLE, 'Server temporary unable please try again letter');
    }
    // Create JWT tokens
    const jwtPayload = {
        id: result === null || result === void 0 ? void 0 : result._id,
        profileId: result === null || result === void 0 ? void 0 : result.profileId,
        email: result === null || result === void 0 ? void 0 : result.email,
        role: result === null || result === void 0 ? void 0 : result.role,
    };
    const accessToken = (0, user_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    const refreshToken = (0, user_utils_1.createToken)(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
    const obj = {};
    if (user.role == user_constant_1.USER_ROLE.worker) {
        const worker = yield worker_model_1.Worker.findById(user.profileId);
        // Add any worker specific checks here
    }
    return Object.assign(Object.assign({ accessToken,
        refreshToken }, obj), { role: user === null || user === void 0 ? void 0 : user.role });
});
const resendVerifyCode = (rawEmail) => __awaiter(void 0, void 0, void 0, function* () {
    const email = rawEmail.trim().toLowerCase();
    const user = yield user_model_1.User.findOne({ email, isDeleted: { $ne: true } });
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    const verifyCode = generateVerifyCode();
    const updateUser = yield user_model_1.User.findByIdAndUpdate(user._id, {
        verifyCode: verifyCode,
        codeExpireIn: new Date(Date.now() + 5 * 60000),
    }, { new: true, runValidators: true });
    if (!updateUser) {
        throw new appError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Something went wrong . Please again resend the code after a few second');
    }
    (0, sendEmail_1.default)({
        email: email,
        subject: 'Activate Your Account',
        html: (0, registerSucessEmail_1.registrationSuccessEmail)('User', parseInt(verifyCode.toString())),
    });
    return null;
});
const getMyProfile = (userData) => __awaiter(void 0, void 0, void 0, function* () {
    let result = null;
    if (userData.role === user_constant_1.USER_ROLE.client) {
        result = yield client_model_1.Client.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive isAdminVerified',
        });
    }
    else if (userData.role === user_constant_1.USER_ROLE.worker) {
        result = yield worker_model_1.Worker.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive isAdminVerified',
        });
    }
    else if (userData.role === user_constant_1.USER_ROLE.manager) {
        result = yield manager_model_1.Manager.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive isAdminVerified',
        });
    }
    else if (userData.role === user_constant_1.USER_ROLE.superAdmin) {
        result = yield superAdmin_model_1.default.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive ',
        });
    }
    else if (userData.role === user_constant_1.USER_ROLE.admin) {
        result = yield admin_model_1.default.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive ',
        });
    }
    return result;
});
const deleteUserAccount = (user, password) => __awaiter(void 0, void 0, void 0, function* () {
    const userData = yield user_model_1.User.findById(user.id);
    if (!userData) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    if (!(yield user_model_1.User.isPasswordMatched(password, userData === null || userData === void 0 ? void 0 : userData.password))) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'Password do not match');
    }
    if (userData.role === user_constant_1.USER_ROLE.client) {
        yield client_model_1.Client.findByIdAndDelete(user.profileId);
    }
    else if (userData.role === user_constant_1.USER_ROLE.worker) {
        yield worker_model_1.Worker.findByIdAndDelete(user.profileId);
    }
    else if (userData.role === user_constant_1.USER_ROLE.manager) {
        yield manager_model_1.Manager.findByIdAndDelete(user.profileId);
    }
    yield user_model_1.User.findByIdAndDelete(user.id);
    return null;
});
// update user
const updateUserProfile = (userData, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (userData.role == user_constant_1.USER_ROLE.client) {
        const user = yield client_model_1.Client.findById(userData.profileId);
        if (!user) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Profile not found');
        }
        const result = yield client_model_1.Client.findByIdAndUpdate(userData.profileId, payload, {
            new: true,
            runValidators: true,
        });
        return result;
    }
    else if (userData.role == user_constant_1.USER_ROLE.worker) {
        // Working days must use the dedicated availability endpoint.
        payload = user_validation_1.updateUserProfileValidationSchema.shape.body.strict().parse(payload);
        const user = yield worker_model_1.Worker.findById(userData.profileId);
        if (!user) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Profile not found');
        }
        const result = yield worker_model_1.Worker.findByIdAndUpdate(userData.profileId, payload, {
            new: true,
            runValidators: true,
        });
        return result;
    }
    else if (userData.role == user_constant_1.USER_ROLE.manager) {
        const user = yield manager_model_1.Manager.findById(userData.profileId);
        if (!user) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Profile not found');
        }
        const result = yield manager_model_1.Manager.findByIdAndUpdate(userData.profileId, payload, {
            new: true,
            runValidators: true,
        });
        return result;
    }
    else if (userData.role == user_constant_1.USER_ROLE.superAdmin) {
        const admin = yield superAdmin_model_1.default.findById(userData.profileId);
        if (!admin) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Profile not found');
        }
        const result = yield superAdmin_model_1.default.findByIdAndUpdate(userData.profileId, payload, { new: true, runValidators: true });
        if (payload.profile_image && admin.profile_image) {
            (0, deleteFromS3_1.deleteFileFromS3)(admin.profile_image);
        }
        return result;
    }
    else if (userData.role == user_constant_1.USER_ROLE.admin) {
        const admin = yield admin_model_1.default.findById(userData.profileId);
        if (!admin) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Profile not found');
        }
        const result = yield admin_model_1.default.findByIdAndUpdate(userData.profileId, payload, { new: true, runValidators: true });
        if (payload.profile_image && admin.profile_image) {
            (0, deleteFromS3_1.deleteFileFromS3)(admin.profile_image);
        }
        return result;
    }
});
const changeUserStatus = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield user_model_1.User.findById(id);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'User not found');
    }
    const result = yield user_model_1.User.findByIdAndUpdate(id, { isBlocked: !user.isBlocked }, { new: true, runValidators: true });
    return result;
});
// upgrade account - simplified without customer/provider logic
const upgradeAccount = (userData) => __awaiter(void 0, void 0, void 0, function* () {
    throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Upgrading account is not supported yet');
});
const userServices = {
    registerUser: exports.registerUser,
    verifyCode,
    resendVerifyCode,
    getMyProfile,
    changeUserStatus,
    deleteUserAccount,
    updateUserProfile,
    upgradeAccount,
};
exports.default = userServices;
