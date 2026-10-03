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
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const client_model_1 = require("../modules/client/client.model");
const worker_model_1 = require("../modules/worker/worker.model");
const superAdmin_model_1 = __importDefault(require("../modules/superAdmin/superAdmin.model"));
const user_constant_1 = require("../modules/user/user.constant");
const simpleAuth = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let token = req.headers.authorization;
        if (!token)
            return next(); // No token → optional
        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }
        let decoded = null;
        try {
            decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
        }
        catch (err) {
            if (err.name === 'TokenExpiredError') {
                decoded = jsonwebtoken_1.default.decode(token);
            }
            else {
                return next(); // ignore invalid token
            }
        }
        if (!decoded)
            return next(); // nothing to attach
        let profileData;
        const { id, role } = decoded;
        if (role === user_constant_1.USER_ROLE.client) {
            profileData = yield client_model_1.Client.findOne({ user: id })
                .select('_id user')
                .populate({
                path: 'user',
                select: '_id isDeleted isBlocked isVerified',
            });
        }
        else if (role === user_constant_1.USER_ROLE.worker) {
            profileData = yield worker_model_1.Worker.findOne({
                user: new mongoose_1.default.Types.ObjectId(id),
            })
                .select('_id user')
                .populate({
                path: 'user',
                select: '_id isDeleted isBlocked isVerified',
            });
        }
        else if (role === user_constant_1.USER_ROLE.superAdmin) {
            profileData = yield superAdmin_model_1.default.findOne({ user: id })
                .select('_id user')
                .populate({
                path: 'user',
                select: '_id isDeleted isBlocked isVerified',
            });
        }
        if (profileData && profileData.user) {
            req.user = decoded;
            req.user.profileId = profileData._id.toString();
        }
        next();
    }
    catch (err) {
        console.error(err);
        next(); // ignore all errors for optional auth
    }
});
exports.default = simpleAuth;
