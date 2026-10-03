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
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../config"));
const superAdmin_model_1 = __importDefault(require("../modules/superAdmin/superAdmin.model"));
const user_constant_1 = require("../modules/user/user.constant");
const user_model_1 = require("../modules/user/user.model");
const superAdminData = {
    name: 'Mr Admin',
    phone: '018938493824',
    email: config_1.default.super_admin_email,
};
const seedSuperAdmin = () => __awaiter(void 0, void 0, void 0, function* () {
    // check when database is connected , we will check is there any user who is super admin
    const superAdminExits = yield user_model_1.User.findOne({ role: user_constant_1.USER_ROLE.superAdmin });
    if (superAdminExits) {
        console.log('Admin already exits');
        return;
    }
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const userDataPayload = {
            email: config_1.default.super_admin_email,
            password: config_1.default.super_admin_password,
            role: user_constant_1.USER_ROLE.superAdmin,
            phone: superAdminData.phone,
            isVerified: true,
        };
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const user = yield user_model_1.User.create([userDataPayload], { session });
        const superAdminPayload = Object.assign(Object.assign({}, superAdminData), { user: user[0]._id });
        const result = yield superAdmin_model_1.default.create([superAdminPayload], {
            session,
        });
        yield user_model_1.User.findByIdAndUpdate(user[0]._id, { profileId: result[0]._id }, { session });
        yield session.commitTransaction();
        session.endSession();
        console.log('Super Admin Created Successfully');
        return result[0];
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
exports.default = seedSuperAdmin;
