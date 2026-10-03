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
/**
 * One-off seed: creates a single Manager (User + Manager profile, linked via
 * profileId/profileModel) for a freshly pointed-at database, mirroring the
 * User -> role-profile -> profileId back-link pattern used by
 * src/app/DB/index.ts's seedSuperAdmin. Idempotent: no-ops if a User with
 * this email already exists.
 *
 * Run with: npx ts-node --transpile-only src/scripts/seed-manager.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../app/config"));
const manager_model_1 = require("../app/modules/manager/manager.model");
const user_constant_1 = require("../app/modules/user/user.constant");
const user_model_1 = require("../app/modules/user/user.model");
const MANAGER_EMAIL = 'manager@yopmail.com';
const MANAGER_PASSWORD = '12345678';
const MANAGER_NAME = 'Manager';
const MANAGER_PHONE = '0000000001';
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(config_1.default.database_url);
        console.log('DB connected');
        const existing = yield user_model_1.User.findOne({ email: MANAGER_EMAIL });
        if (existing) {
            console.log(`User with email ${MANAGER_EMAIL} already exists, skipping seed.`);
            yield mongoose_1.default.disconnect();
            return;
        }
        const session = yield mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const user = yield user_model_1.User.create([
                {
                    email: MANAGER_EMAIL,
                    password: MANAGER_PASSWORD,
                    role: user_constant_1.USER_ROLE.manager,
                    roles: [user_constant_1.USER_ROLE.manager],
                    phone: MANAGER_PHONE,
                    isVerified: true,
                    profileModel: 'Manager',
                },
            ], { session });
            const manager = yield manager_model_1.Manager.create([
                {
                    user: user[0]._id,
                    name: MANAGER_NAME,
                    email: MANAGER_EMAIL,
                    phone: MANAGER_PHONE,
                },
            ], { session });
            yield user_model_1.User.findByIdAndUpdate(user[0]._id, { profileId: manager[0]._id }, { session });
            yield session.commitTransaction();
            session.endSession();
            console.log(`Manager seeded: ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`);
        }
        catch (error) {
            yield session.abortTransaction();
            session.endSession();
            throw error;
        }
        yield mongoose_1.default.disconnect();
    });
}
main().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
});
