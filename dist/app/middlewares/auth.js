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
const http_status_1 = __importDefault(require("http-status"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const appError_1 = __importDefault(require("../error/appError"));
const admin_model_1 = __importDefault(require("../modules/admin/admin.model"));
const client_model_1 = require("../modules/client/client.model");
const manager_model_1 = require("../modules/manager/manager.model");
const worker_model_1 = require("../modules/worker/worker.model");
const superAdmin_model_1 = __importDefault(require("../modules/superAdmin/superAdmin.model"));
const user_constant_1 = require("../modules/user/user.constant");
const catchasync_1 = __importDefault(require("../utilities/catchasync"));
// make costume interface
const auth = (...requiredRoles) => {
    return (0, catchasync_1.default)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // check if the token is sent from client -----
        let token = (_a = req === null || req === void 0 ? void 0 : req.headers) === null || _a === void 0 ? void 0 : _a.authorization;
        if (!token) {
            throw new appError_1.default(http_status_1.default.UNAUTHORIZED, 'You are not authorized');
        }
        if (token.startsWith('Bearer ')) {
            token = token.slice(7, token.length);
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
        }
        catch (err) {
            throw new appError_1.default(http_status_1.default.UNAUTHORIZED, 'Token is expired');
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, role, email, profileId, iat } = decoded;
        if (!decoded) {
            throw new appError_1.default(http_status_1.default.UNAUTHORIZED, 'Token is expired');
        }
        // get the user if that here ---------
        // const user = await User.findById(id);
        let profileData;
        if (role == user_constant_1.USER_ROLE.admin) {
            profileData = yield admin_model_1.default.findOne({ user: id })
                .select('_id user')
                .populate({
                path: 'user',
                select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
            });
        }
        else if (role == user_constant_1.USER_ROLE.client) {
            profileData = yield client_model_1.Client.findOne({ user: id })
                .select('_id user')
                .populate({
                path: 'user',
                select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
            });
        }
        else if (role == user_constant_1.USER_ROLE.worker) {
            profileData = yield worker_model_1.Worker.findOne({
                user: new mongoose_1.default.Types.ObjectId(id),
            })
                .select('user _id')
                .populate({
                path: 'user',
                select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
            });
        }
        else if (role === user_constant_1.USER_ROLE.manager) {
            profileData = yield manager_model_1.Manager.findOne({ user: id })
                .select('_id user')
                .populate({
                path: 'user',
                select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
            });
        }
        else if (role === user_constant_1.USER_ROLE.superAdmin) {
            profileData = yield superAdmin_model_1.default.findOne({ user: id })
                .select('_id user')
                .populate({
                path: 'user',
                select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
            });
        }
        if (!profileData) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Unauthorized access');
        }
        const { user } = profileData;
        if (!user) {
            throw new appError_1.default(http_status_1.default.UNAUTHORIZED, 'Unauthorized access');
        }
        if (user.isDeleted) {
            throw new appError_1.default(http_status_1.default.UNAUTHORIZED, 'Unauthorized access 2');
        }
        if (user.isBlocked) {
            throw new appError_1.default(http_status_1.default.UNAUTHORIZED, 'Your account is blocked');
        }
        if (!(user === null || user === void 0 ? void 0 : user.isVerified)) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'You are not verified user');
        }
        if (!user.isActive) {
            throw new appError_1.default(http_status_1.default.FORBIDDEN, 'Your account  is inactivated , please contact support');
        }
        // if (
        //   user?.passwordChangedAt &&
        //   (await User.isJWTIssuedBeforePasswordChange(
        //     user?.passwordChangedAt,
        //     iat as number,
        //   ))
        // ) {
        //   throw new AppError(httpStatus.FORBIDDEN, 'You are not authorized 2');
        // }
        if (requiredRoles && !requiredRoles.includes(role)) {
            throw new appError_1.default(http_status_1.default.UNAUTHORIZED, 'Your are not authorized 3');
        }
        // add those properties in req
        req.user = decoded;
        req.user.profileId = profileData._id.toString();
        next();
    }));
};
exports.default = auth;
