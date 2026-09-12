/* eslint-disable no-unused-vars */
import { Model, Types } from 'mongoose';
import { USER_ROLE } from './user.constant';

export interface TUser {
    _id: string;
    profileId: Types.ObjectId | string;
    profileModel?: string;
    email: string;
    phone: string;
    password: string;
    passwordChangedAt?: Date;
    role: (typeof USER_ROLE)[keyof typeof USER_ROLE];
    roles: Array<(typeof USER_ROLE)[keyof typeof USER_ROLE]>;
    isBlocked: boolean;
    verifyCode: number;
    resetCode: number;
    isVerified: boolean;
    isResetVerified: boolean;
    codeExpireIn: Date;
    isActive: boolean;
    isDeleted: boolean;
    appleId: string;
    googleId: string;
    playerIds: string[];
    isMultiRole: boolean;
    isIdVerified: boolean;
    notificationEnabled: boolean;
    full_name?: string;
    is_admin_created?: boolean;
    is_approved?: boolean;
    approval_status?: string;
    rejection_reason?: string;
    is_temporary_password?: boolean;
    temporary_password_created_at?: Date;
    otp_code?: string;
    otp_expires_at?: Date;
    profile_photo?: string;
    last_login?: Date;
    push_notifications_enabled?: boolean;
    onesignal_player_id?: string;
    email_notifications?: boolean;
    sms_cleaning_alerts?: boolean;
    portal_language?: string;
    last_password_changed_at?: Date;
    member_since?: string;
    account_status?: string;
    status?: string;
    status_reason?: string;
    timezone?: string;
}

export interface TLoginUser {
    email: string;
    password: string;
}

export interface ILoginWithGoogle {
    name: string;
    email: string;
    profile_image?: string;
    phone?: string;
}

export interface UserModel extends Model<TUser> {
    // myStaticMethod(): number;
    isUserExists(phoneNumber: string): Promise<TUser>;
    //   isUserDeleted(email: string): Promise<boolean>;
    //   isUserBlocked(email: string): Promise<boolean>;
    isPasswordMatched(
        plainPassword: string,
        hashPassword: string
    ): Promise<TUser>;
    isJWTIssuedBeforePasswordChange(
        passwordChangeTimeStamp: Date,
        jwtIssuedTimeStamp: number
    ): Promise<boolean>;
}

export type TUserRole = keyof typeof USER_ROLE;
