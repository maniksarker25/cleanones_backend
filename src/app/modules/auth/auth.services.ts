/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */
import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import config from '../../config';
import AppError from '../../error/appError';
import { resetPasswordEmailBody } from '../../mailTemplate/resetPasswordEmailBody';
import sendEmail from '../../utilities/sendEmail';
import { upsertDevice } from '../device/device.service';

import { TUserRole } from '../user/user.interface';
import { User } from '../user/user.model';
import { createToken, verifyToken } from '../user/user.utils';
import { TLoginUser } from './auth.interface';
const generateVerifyCode = (): number => {
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
const findActiveUserByEmail = async (rawEmail: string) => {
    // Email is stored lowercase (see User.email's schema-level `lowercase:
    // true`), but plenty of callers into this function are raw user input —
    // normalize here so "Test@X.com" and "test@x.com" are always treated as
    // the same account, regardless of how the caller typed it.
    const email = rawEmail.trim().toLowerCase();
    const user = await User.findOne({ email, isDeleted: { $ne: true } });
    if (user) return user;

    const deletedUser = await User.findOne({ email, isDeleted: true });
    if (deletedUser) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'This user is already deleted'
        );
    }
    return null;
};

const loginUserIntoDB = async (payload: TLoginUser) => {
    const user = await findActiveUserByEmail(payload.email);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'Invalid credentials');
    }
    if (user.isBlocked) {
        throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
    }
    if (!user.isActive) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'Your account  is inactivated , please contact support'
        );
    }

    if (!user.isVerified) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'You are not verified user . Please verify your email'
        );
    }
    if (payload.role && !user.roles.includes(payload.role)) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            `${payload.role} account not found`
        );
    }
    if (!(await User.isPasswordMatched(payload?.password, user?.password))) {
        throw new AppError(httpStatus.FORBIDDEN, 'Invalid credentials');
    }

    const platform = payload?.platform ? payload?.platform : 'android';

    if (payload.playerId) {
        upsertDevice(user.profileId as string, payload.playerId, platform);
    }
    const jwtPayload = {
        id: user?._id,
        profileId: user.profileId?.toString() as string,
        email: user?.email,
        role: payload.role || user.role,
    };
    const accessToken = createToken(
        jwtPayload,
        config.jwt_access_secret as string,
        config.jwt_access_expires_in as string
    );
    const refreshToken = createToken(
        jwtPayload,
        config.jwt_refresh_secret as string,
        config.jwt_refresh_expires_in as string
    );

    const obj: any = {};
    return {
        accessToken,
        refreshToken,
        ...obj,
        role: user?.role,
    };
};

// change password
const changePasswordIntoDB = async (
    userData: JwtPayload,
    payload: {
        oldPassword: string;
        newPassword: string;
        confirmNewPassword: string;
    }
) => {
    if (payload.newPassword !== payload.confirmNewPassword) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Password and confirm password doesn't match"
        );
    }
    const user = await User.findById(userData.id);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
    }
    if (user.isDeleted) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'This user is already deleted'
        );
    }
    if (user.isBlocked) {
        throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
    }

    if (!(await User.isPasswordMatched(payload?.oldPassword, user?.password))) {
        throw new AppError(httpStatus.FORBIDDEN, 'Password do not match');
    }
    //hash new password
    const newHashedPassword = await bcrypt.hash(
        payload.newPassword,
        Number(config.bcrypt_salt_rounds)
    );
    await User.findOneAndUpdate(
        {
            _id: userData.id,
            role: userData.role,
        },
        {
            password: newHashedPassword,
            passwordChangedAt: new Date(),
        }
    );
    return null;
};

const refreshToken = async (token: string) => {
    const decoded = verifyToken(token, config.jwt_refresh_secret as string);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { username, email, iat, id } = decoded;
    const user = await User.findById(id);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
    }
    if (user.isDeleted) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'This user is already deleted'
        );
    }
    if (user.isBlocked) {
        throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
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
        id: user?._id,
        profileId: user?.profileId?.toString() as string,
        email: user?.email,
        role: user?.role as TUserRole,
    };
    const accessToken = createToken(
        jwtPayload,
        config.jwt_access_secret as string,
        config.jwt_access_expires_in as string
    );
    return { accessToken };
};

// forgot password
const forgetPassword = async (email: string) => {
    const user = await findActiveUserByEmail(email);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
    }
    if (user.isBlocked) {
        throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
    }

    const resetCode = generateVerifyCode();
    await User.findByIdAndUpdate(user._id, {
        resetCode: resetCode,
        isResetVerified: false,
        codeExpireIn: new Date(Date.now() + 5 * 60000),
    });
    sendEmail({
        email: user.email,
        subject: 'Reset password code',
        html: resetPasswordEmailBody('Dear', resetCode),
    });

    return null;
};

// verify forgot otp

const verifyResetOtp = async (email: string, resetCode: number) => {
    const user = await findActiveUserByEmail(email);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
    }
    if (user.isBlocked) {
        throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
    }

    if (user.codeExpireIn < new Date(Date.now())) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Reset code is expire');
    }
    if (user.resetCode !== Number(resetCode)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Reset code is invalid');
    }
    await User.findByIdAndUpdate(
        user._id,
        { isResetVerified: true },
        { new: true, runValidators: true }
    );
    return null;
};

// reset password
const resetPassword = async (payload: {
    email: string;
    password: string;
    confirmPassword: string;
}) => {
    if (payload.password !== payload.confirmPassword) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Password and confirm password doesn't match"
        );
    }
    const user = await findActiveUserByEmail(payload.email);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
    }
    if (!user.isResetVerified) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'You need to verify reset code before reset password'
        );
    }
    if (!user.codeExpireIn || user.codeExpireIn < new Date(Date.now())) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'Reset code is expired, please request a new one'
        );
    }

    if (user.isBlocked) {
        throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
    }
    const newHashedPassword = await bcrypt.hash(
        payload.password,
        Number(config.bcrypt_salt_rounds)
    );
    await User.findByIdAndUpdate(user._id, {
        password: newHashedPassword,
        passwordChangedAt: new Date(),
        isResetVerified: false,
        resetCode: null,
        codeExpireIn: null,
    });
    const jwtPayload = {
        id: user?._id,
        profileId: user?.profileId?.toString() as string,
        email: user?.email,
        role: user?.role as TUserRole,
    };
    const accessToken = createToken(
        jwtPayload,
        config.jwt_access_secret as string,
        config.jwt_access_expires_in as string
    );
    const refreshToken = createToken(
        jwtPayload,
        config.jwt_refresh_secret as string,
        config.jwt_refresh_expires_in as string
    );

    return { accessToken, refreshToken };
};

const resendResetCode = async (email: string) => {
    const user = await findActiveUserByEmail(email);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'This user does not exist');
    }
    if (user.isBlocked) {
        throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked');
    }

    const resetCode = generateVerifyCode();
    await User.findByIdAndUpdate(user._id, {
        resetCode: resetCode,
        isResetVerified: false,
        codeExpireIn: new Date(Date.now() + 5 * 60000),
    });
    sendEmail({
        email: user.email,
        subject: 'Reset password code',
        html: resetPasswordEmailBody('Dear', resetCode),
    });

    return null;
};

const getAllUserFromDB = async () => {
    const result = await User.find().select('-password -resetCode -verifyCode');
    return result;
};

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

export default authServices;
