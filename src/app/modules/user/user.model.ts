import bcrypt from 'bcrypt';
import { Schema, model } from 'mongoose';
import config from '../../config';
import { PROFILE_MODEL_BY_ROLE, USER_ROLE } from './user.constant';
import { TUser, UserModel } from './user.interface';

const userSchema = new Schema<TUser>(
    {
        profileId: {
            type: Schema.Types.ObjectId,
            refPath: 'profileModel',
            default: null,
        },
        profileModel: {
            type: String,
            enum: Object.values(PROFILE_MODEL_BY_ROLE),
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
            enum: Object.values(USER_ROLE),
            required: true,
        },
        roles: {
            type: [String],
            enum: Object.values(USER_ROLE),
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
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

userSchema.pre('save', async function (next) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const user = this;
    if (user.password) {
        user.password = await bcrypt.hash(
            user.password,
            Number(config.bcrypt_salt_rounds)
        );
    }
    next();
});

userSchema.post('save', function (doc, next) {
    doc.password = '';
    next();
});
// statics method for check is user exists
userSchema.statics.isUserExists = async function (phoneNumber: string) {
    return await User.findOne({ phoneNumber }).select('+password');
};
// statics method for check password match  ----
userSchema.statics.isPasswordMatched = async function (
    plainPasswords: string,
    hashPassword: string
) {
    return await bcrypt.compare(plainPasswords, hashPassword);
};

userSchema.statics.isJWTIssuedBeforePasswordChange = async function (
    passwordChangeTimeStamp,
    jwtIssuedTimeStamp
) {
    const passwordChangeTime =
        new Date(passwordChangeTimeStamp).getTime() / 1000;

    return passwordChangeTime > jwtIssuedTimeStamp;
};

export const User = model<TUser, UserModel>('User', userSchema);
