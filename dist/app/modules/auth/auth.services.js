"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
const bcrypt_1 = __importDefault(require("bcrypt"));
const http_status_1 = __importDefault(require("http-status"));
const config_1 = __importDefault(require("../../config"));
const appError_1 = __importDefault(require("../../error/appError"));
const resetPasswordEmailBody_1 = require("../../mailTemplate/resetPasswordEmailBody");
const sendEmail_1 = __importDefault(require("../../utilities/sendEmail"));
const device_service_1 = require("../device/device.service");
const user_model_1 = require("../user/user.model");
const user_utils_1 = require("../user/user.utils");
const generateVerifyCode = () => {
    return Math.floor(100000 + Math.random() * 900000);
};
/**
 * Email is only unique among active accounts (see the partial index on
 * User.email) — a deleted user's old email can already belong to a brand new
 * account. A plain findOne({ email }) would be ambiguous between the two, so
 * every lookup below goes through this: match the active account first, and
 * only if none exists, check for a deleted one purely to keep the specific
 * "already deleted" message instead of a generic "not found".
 */
const findActiveUserByEmail = (rawEmail) => __awaiter(void 0, void 0, void 0, function* () {
    // Email is stored lowercase (see User.email's schema-level `lowercase:
    // true`), but plenty of callers into this function are raw user input —
    // normalize here so "Test@X.com" and "test@x.com" are always treated as
    // the same account, regardless of how the caller typed it.
    const email = rawEmail.trim().toLowerCase();
    const user = yield user_model_1.User.findOne({ email, isDeleted: { $ne: true } });
    if (user)
        return user;
    const deletedUser = yield user_model_1.User.findOne({ email, isDeleted: true });
    if (deletedUser) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is already deleted');
    }
    return null;
});
const loginUserIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const user = yield findActiveUserByEmail(payload.email);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Invalid credentials');
    }
    if (user.isBlocked) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked');
    }
    if (!user.isActive) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'Your account  is inactivated , please contact support');
    }
    if (!user.isVerified) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'You are not verified user . Please verify your email');
    }
    if (payload.role && !user.roles.includes(payload.role)) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, `${payload.role} account not found`);
    }
    if (!(yield user_model_1.User.isPasswordMatched(payload === null || payload === void 0 ? void 0 : payload.password, user === null || user === void 0 ? void 0 : user.password))) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'Invalid credentials');
    }
    const platform = (payload === null || payload === void 0 ? void 0 : payload.platform) ? payload === null || payload === void 0 ? void 0 : payload.platform : 'android';
    if (payload.playerId) {
        (0, device_service_1.upsertDevice)(user.profileId, payload.playerId, platform);
    }
    const jwtPayload = {
        id: user === null || user === void 0 ? void 0 : user._id,
        profileId: (_a = user.profileId) === null || _a === void 0 ? void 0 : _a.toString(),
        email: user === null || user === void 0 ? void 0 : user.email,
        role: payload.role || user.role,
    };
    const accessToken = (0, user_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    const refreshToken = (0, user_utils_1.createToken)(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
    const obj = {};
    return Object.assign(Object.assign({ accessToken,
        refreshToken }, obj), { role: user === null || user === void 0 ? void 0 : user.role });
});
// change password
const changePasswordIntoDB = (userData, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (payload.newPassword !== payload.confirmNewPassword) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "Password and confirm password doesn't match");
    }
    const user = yield user_model_1.User.findById(userData.id);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'This user does not exist');
    }
    if (user.isDeleted) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is already deleted');
    }
    if (user.isBlocked) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked');
    }
    if (!(yield user_model_1.User.isPasswordMatched(payload === null || payload === void 0 ? void 0 : payload.oldPassword, user === null || user === void 0 ? void 0 : user.password))) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'Password do not match');
    }
    //hash new password
    const newHashedPassword = yield bcrypt_1.default.hash(payload.newPassword, Number(config_1.default.bcrypt_salt_rounds));
    yield user_model_1.User.findOneAndUpdate({
        _id: userData.id,
        role: userData.role,
    }, {
        password: newHashedPassword,
        passwordChangedAt: new Date(),
    });
    return null;
});
const refreshToken = (token) => __awaiter(void 0, void 0, void 0, function* () {
    var _b;
    const decoded = (0, user_utils_1.verifyToken)(token, config_1.default.jwt_refresh_secret);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { username, email, iat, id } = decoded;
    const user = yield user_model_1.User.findById(id);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'This user does not exist');
    }
    if (user.isDeleted) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is already deleted');
    }
    if (user.isBlocked) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked');
    }
    // if (
    //   user?.passwordChangedAt &&
    //   (await User.isJWTIssuedBeforePasswordChange(
    //     user?.passwordChangedAt,
    //     iat as number,
    //   ))
    // ) {
    //   throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized');
    // }
    const jwtPayload = {
        id: user === null || user === void 0 ? void 0 : user._id,
        profileId: (_b = user === null || user === void 0 ? void 0 : user.profileId) === null || _b === void 0 ? void 0 : _b.toString(),
        email: user === null || user === void 0 ? void 0 : user.email,
        role: user === null || user === void 0 ? void 0 : user.role,
    };
    const accessToken = (0, user_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    return { accessToken };
});
// forgot password
const forgetPassword = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield findActiveUserByEmail(email);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'This user does not exist');
    }
    if (user.isBlocked) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked');
    }
    const resetCode = generateVerifyCode();
    yield user_model_1.User.findByIdAndUpdate(user._id, {
        resetCode: resetCode,
        isResetVerified: false,
        codeExpireIn: new Date(Date.now() + 5 * 60000),
    });
    (0, sendEmail_1.default)({
        email: user.email,
        subject: 'Reset password code',
        html: (0, resetPasswordEmailBody_1.resetPasswordEmailBody)('Dear', resetCode),
    });
    return null;
});
// verify forgot otp
const verifyResetOtp = (email, resetCode) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield findActiveUserByEmail(email);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'This user does not exist');
    }
    if (user.isBlocked) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked');
    }
    if (user.codeExpireIn < new Date(Date.now())) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Reset code is expire');
    }
    if (user.resetCode !== Number(resetCode)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Reset code is invalid');
    }
    yield user_model_1.User.findByIdAndUpdate(user._id, { isResetVerified: true }, { new: true, runValidators: true });
    return null;
});
// reset password
const resetPassword = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    var _c;
    if (payload.password !== payload.confirmPassword) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "Password and confirm password doesn't match");
    }
    const user = yield findActiveUserByEmail(payload.email);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'This user does not exist');
    }
    if (!user.isResetVerified) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'You need to verify reset code before reset password');
    }
    if (!user.codeExpireIn || user.codeExpireIn < new Date(Date.now())) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Reset code is expired, please request a new one');
    }
    if (user.isBlocked) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked');
    }
    const newHashedPassword = yield bcrypt_1.default.hash(payload.password, Number(config_1.default.bcrypt_salt_rounds));
    yield user_model_1.User.findByIdAndUpdate(user._id, {
        password: newHashedPassword,
        passwordChangedAt: new Date(),
        isResetVerified: false,
        resetCode: null,
        codeExpireIn: null,
    });
    const jwtPayload = {
        id: user === null || user === void 0 ? void 0 : user._id,
        profileId: (_c = user === null || user === void 0 ? void 0 : user.profileId) === null || _c === void 0 ? void 0 : _c.toString(),
        email: user === null || user === void 0 ? void 0 : user.email,
        role: user === null || user === void 0 ? void 0 : user.role,
    };
    const accessToken = (0, user_utils_1.createToken)(jwtPayload, config_1.default.jwt_access_secret, config_1.default.jwt_access_expires_in);
    const refreshToken = (0, user_utils_1.createToken)(jwtPayload, config_1.default.jwt_refresh_secret, config_1.default.jwt_refresh_expires_in);
    return { accessToken, refreshToken };
});
const resendResetCode = (email) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield findActiveUserByEmail(email);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'This user does not exist');
    }
    if (user.isBlocked) {
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'This user is blocked');
    }
    const resetCode = generateVerifyCode();
    yield user_model_1.User.findByIdAndUpdate(user._id, {
        resetCode: resetCode,
        isResetVerified: false,
        codeExpireIn: new Date(Date.now() + 5 * 60000),
    });
    (0, sendEmail_1.default)({
        email: user.email,
        subject: 'Reset password code',
        html: (0, resetPasswordEmailBody_1.resetPasswordEmailBody)('Dear', resetCode),
    });
    return null;
});
const getAllUserFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield user_model_1.User.find().select('-password -resetCode -verifyCode');
    return result;
});
const authServices = {
    loginUserIntoDB,
    changePasswordIntoDB,
    refreshToken,
    forgetPassword,
    resetPassword,
    verifyResetOtp,
    resendResetCode,
    getAllUserFromDB,
};
exports.default = authServices;
