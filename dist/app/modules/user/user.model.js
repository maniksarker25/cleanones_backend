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
exports.User = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = require("mongoose");
const config_1 = __importDefault(require("../../config"));
const user_constant_1 = require("./user.constant");
const userSchema = new mongoose_1.Schema({
    profileId: {
        type: mongoose_1.Schema.Types.ObjectId,
        refPath: 'profileModel',
        default: null,
    },
    profileModel: {
        type: String,
        enum: Object.values(user_constant_1.PROFILE_MODEL_BY_ROLE),
        default: null,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
    },
    passwordChangedAt: {
        type: Date,
    },
    role: {
        type: String,
        enum: Object.values(user_constant_1.USER_ROLE),
        required: true,
    },
    roles: {
        type: [String],
        enum: Object.values(user_constant_1.USER_ROLE),
        default: ['client'],
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    verifyCode: {
        type: Number,
    },
    resetCode: {
        type: Number,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isResetVerified: {
        type: Boolean,
        default: false,
    },
    codeExpireIn: {
        type: Date,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    appleId: {
        type: String,
    },
    googleId: {
        type: String,
    },
    playerIds: { type: [String], default: [] },
    isMultiRole: {
        type: Boolean,
        default: false,
    },
    isIdVerified: {
        type: Boolean,
        default: false,
    },
    notificationEnabled: {
        type: Boolean,
        default: true,
    },
    full_name: { type: String, default: '' },
    is_admin_created: { type: Boolean, default: false },
    is_approved: { type: Boolean, default: true },
    approval_status: { type: String, default: 'approved' },
    rejection_reason: { type: String, default: null },
    is_temporary_password: { type: Boolean, default: false },
    temporary_password_created_at: { type: Date, default: null },
    otp_code: { type: String, default: null },
    otp_expires_at: { type: Date, default: null },
    profile_photo: { type: String, default: null },
    last_login: { type: Date, default: null },
    push_notifications_enabled: { type: Boolean, default: true },
    onesignal_player_id: { type: String, default: null },
    email_notifications: { type: Boolean, default: true },
    sms_cleaning_alerts: { type: Boolean, default: false },
    portal_language: { type: String, default: 'English (US)' },
    last_password_changed_at: { type: Date, default: null },
    member_since: { type: String, default: null },
    account_status: { type: String, default: null },
    status: { type: String, default: null },
    status_reason: { type: String, default: null },
    timezone: { type: String, default: null },
}, {
    timestamps: true,
    versionKey: false,
});
// Email is only unique among active accounts — a deleted user's old email
// must never block a brand new account from taking it. Every app-level
// findOne({ email }) lookup across auth/admin/client/worker/user services is
// expected to scope by isDeleted the same way; this index is the DB-level
// backstop against a race two of those checks can't catch on their own.
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const user = this;
        if (user.password) {
            user.password = yield bcrypt_1.default.hash(user.password, Number(config_1.default.bcrypt_salt_rounds));
        }
        next();
    });
});
userSchema.post('save', function (doc, next) {
    doc.password = '';
    next();
});
// statics method for check is user exists
userSchema.statics.isUserExists = function (phoneNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield exports.User.findOne({ phoneNumber }).select('+password');
    });
};
// statics method for check password match  ----
userSchema.statics.isPasswordMatched = function (plainPasswords, hashPassword) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield bcrypt_1.default.compare(plainPasswords, hashPassword);
    });
};
userSchema.statics.isJWTIssuedBeforePasswordChange = function (passwordChangeTimeStamp, jwtIssuedTimeStamp) {
    return __awaiter(this, void 0, void 0, function* () {
        const passwordChangeTime = new Date(passwordChangeTimeStamp).getTime() / 1000;
        return passwordChangeTime > jwtIssuedTimeStamp;
    });
};
exports.User = (0, mongoose_1.model)('User', userSchema);
