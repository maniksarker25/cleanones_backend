"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
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
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importDefault(require("mongoose"));
const appError_1 = __importDefault(require("../../error/appError"));
const adminCredentialsEmailBody_1 = __importDefault(require("../../mailTemplate/adminCredentialsEmailBody"));
const sendEmail_1 = __importDefault(require("../../utilities/sendEmail"));
const user_constant_1 = require("../user/user.constant");
const user_model_1 = require("../user/user.model");
const admin_model_1 = __importDefault(require("./admin.model"));
const generateVerifyCode = () => {
    return Math.floor(100000 + Math.random() * 900000);
};
const createAdminIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { password, confirmPassword } = payload, userData = __rest(payload, ["password", "confirmPassword"]);
    if (password !== confirmPassword) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "Password and confirm password doesn't match");
    }
    // Normalize once, up front — the duplicate check, User.create,
    // Admin.create and the confirmation email all read userData.email below.
    userData.email = userData.email.trim().toLowerCase();
    const emailExist = yield user_model_1.User.findOne({
        email: userData.email,
        isDeleted: { $ne: true },
    });
    if (emailExist) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This email already exists');
    }
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const verifyCode = generateVerifyCode();
        const userDataPayload = {
            email: userData === null || userData === void 0 ? void 0 : userData.email,
            phone: userData === null || userData === void 0 ? void 0 : userData.phone,
            password,
            role: user_constant_1.USER_ROLE.admin,
            roles: [user_constant_1.USER_ROLE.admin],
            verifyCode,
            codeExpireIn: new Date(Date.now() + 5 * 60000),
            isVerified: true,
        };
        // Create user
        const [user] = yield user_model_1.User.create([userDataPayload], { session });
        const adminPayload = Object.assign(Object.assign({}, userData), { user: user._id });
        const [profile] = yield admin_model_1.default.create([adminPayload], { session });
        yield user_model_1.User.findByIdAndUpdate(user._id, { profileId: profile._id }, { session });
        yield (0, sendEmail_1.default)({
            email: userData.email,
            subject: 'Your Admin Dashboard Login Credentials',
            html: (0, adminCredentialsEmailBody_1.default)(userData.name || 'Admin', userData.email, password),
        });
        // If SMS sent successfully, commit transaction
        yield session.commitTransaction();
        session.endSession();
        return profile;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const updateAdminProfile = (userId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield admin_model_1.default.findOneAndUpdate({ user: userId }, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
const deleteAdminFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const admin = yield admin_model_1.default.findById(id).session(session);
        if (!admin) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Admin not found');
        }
        // Delete associated User and Admin within the transaction
        yield user_model_1.User.findByIdAndDelete(admin.user).session(session);
        yield admin_model_1.default.findByIdAndDelete(id).session(session);
        yield session.commitTransaction();
        return null;
    }
    catch (error) {
        yield session.abortTransaction();
        throw error; // re-throw the error for further handling
    }
    finally {
        session.endSession();
    }
});
// update Admin status
const updateAdminStatus = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield admin_model_1.default.startSession();
    session.startTransaction();
    try {
        const admin = yield admin_model_1.default.findById(id);
        if (!admin) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Admin not found');
        }
        const result = yield admin_model_1.default.findByIdAndUpdate(id, { isActive: !admin.isActive }, { runValidators: true, new: true, session: session });
        if (!result) {
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Failed to updated status');
        }
        yield user_model_1.User.findOneAndUpdate({ _id: result.user }, { isActive: result.isActive }, { runValidators: true, new: true, session: session });
        yield session.commitTransaction();
        session.endSession();
        return result;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw new appError_1.default(http_status_1.default.SERVICE_UNAVAILABLE, 'Something went wrong ,try again letter ');
    }
});
// get all Admin
const getAllAdminFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const AdminQuery = new QueryBuilder_1.default(admin_model_1.default.find(), query)
        .search(['storeName'])
        .fields()
        .filter()
        .paginate()
        .sort();
    const meta = yield AdminQuery.countTotal();
    const result = yield AdminQuery.modelQuery;
    return {
        meta,
        result,
    };
});
const AdminServices = {
    updateAdminProfile,
    updateAdminStatus,
    getAllAdminFromDB,
    deleteAdminFromDB,
    createAdminIntoDB,
};
exports.default = AdminServices;
