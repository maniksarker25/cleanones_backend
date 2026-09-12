/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-unused-vars */

import bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../../config';
import AppError from '../../error/appError';
import { deleteFileFromS3 } from '../../helper/deleteFromS3';
import { registrationSuccessEmail } from '../../mailTemplate/registerSucessEmail';
import sendEmail from '../../utilities/sendEmail';
import Admin from '../admin/admin.model';
import { Client } from '../client/client.model';
import { Worker } from '../worker/worker.model';
import { Manager } from '../manager/manager.model';
import { upsertDevice } from '../device/device.service';
import SuperAdmin from '../superAdmin/superAdmin.model';
import { USER_ROLE } from './user.constant';
import { UpdateUserProfileDTO } from './user.dto';
import { TUserRole } from './user.interface';
import { User } from './user.model';
import { createToken } from './user.utils';
import { updateUserProfileValidationSchema } from './user.validation';

const generateVerifyCode = (): number => {
    return Math.floor(100000 + Math.random() * 900000);
};

export const registerUser = async (
    payload: any & {
        password: string;
        confirmPassword: string;
        role: 'worker' | 'client' | 'manager';
        playerId?: string;
        platform?: 'ios' | 'android' | 'web';
    }
) => {
    const {
        password,
        confirmPassword,
        playerId,
        platform = 'android',
        role,
        ...profileData
    } = payload;

    // validate password
    if (password !== confirmPassword) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Password and confirm password doesn't match"
        );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const session = await mongoose.startSession();

    let user: any;
    let profile: any;
    let verifyCode: number;

    try {
        await session.withTransaction(async () => {
            verifyCode = generateVerifyCode();

            user = await User.findOne({
                email: profileData.email,
            }).session(session);

            if (user?.isVerified) {
                throw new AppError(
                    httpStatus.BAD_REQUEST,
                    'This email already exists'
                );
            }

            if (!user) {
                [user] = await User.create(
                    [
                        {
                            email: profileData.email,
                            phone: profileData.phone,
                            password: hashedPassword,
                            role,
                            roles: [role],
                            verifyCode,
                            codeExpireIn: new Date(Date.now() + 5 * 60 * 1000),
                            isVerified: false,
                        },
                    ],
                    { session }
                );
            } else {
                user.password = hashedPassword;
                user.role = role;
                user.roles = [role];
                user.verifyCode = verifyCode;
                user.codeExpireIn = new Date(Date.now() + 5 * 60 * 1000);

                await user.save({ session });
            }

            const profilePayload = {
                ...profileData,
                user: user._id,
            };

            if (role === 'client') {
                profile = await Client.findOneAndUpdate(
                    { user: user._id },
                    profilePayload,
                    {
                        upsert: true,
                        new: true,
                        session,
                        setDefaultsOnInsert: true,
                    }
                );
            } else if (role === 'worker') {
                profile = await Worker.findOneAndUpdate(
                    { user: user._id },
                    profilePayload,
                    {
                        upsert: true,
                        new: true,
                        session,
                        setDefaultsOnInsert: true,
                    }
                );
            } else if (role === 'manager') {
                profile = await Manager.findOneAndUpdate(
                    { user: user._id },
                    profilePayload,
                    {
                        upsert: true,
                        new: true,
                        session,
                        setDefaultsOnInsert: true,
                    }
                );
            }

            user.profileId = profile._id;

            await user.save({ session });
        });

        if (playerId) {
            await upsertDevice(user.profileId.toString(), playerId, platform);
        }

        await sendEmail({
            email: profileData.email,
            subject: 'Activate Your Account',
            html: registrationSuccessEmail(profileData.name || 'User', verifyCode!),
        });

        return profile;
    } catch (error: any) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            error?.message || 'Service unavailable'
        );
    } finally {
        session.endSession();
    }
};

const verifyCode = async (email: string, verifyCode: number) => {
    const user = await User.findOne({ email: email });
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }
    if (user.codeExpireIn < new Date(Date.now())) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Verify code is expired');
    }
    if (verifyCode !== user.verifyCode) {
        throw new AppError(httpStatus.BAD_REQUEST, "Code doesn't match");
    }
    const result = await User.findOneAndUpdate(
        { email: email },
        { isVerified: true },
        { new: true, runValidators: true }
    );

    if (!result) {
        throw new AppError(
            httpStatus.SERVICE_UNAVAILABLE,
            'Server temporary unable please try again letter'
        );
    }

    // Create JWT tokens
    const jwtPayload = {
        id: result?._id,
        profileId: result?.profileId as string,
        email: result?.email,
        role: result?.role as TUserRole,
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
    if (user.role == USER_ROLE.worker) {
        const worker = await Worker.findById(user.profileId);
        // Add any worker specific checks here
    }

    return {
        accessToken,
        refreshToken,
        ...obj,
        role: user?.role,
    };
};

const resendVerifyCode = async (email: string) => {
    const user = await User.findOne({ email: email });
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }
    const verifyCode = generateVerifyCode();
    const updateUser = await User.findOneAndUpdate(
        { email: email },
        {
            verifyCode: verifyCode,
            codeExpireIn: new Date(Date.now() + 5 * 60000),
        },
        { new: true, runValidators: true }
    );
    if (!updateUser) {
        throw new AppError(
            httpStatus.INTERNAL_SERVER_ERROR,
            'Something went wrong . Please again resend the code after a few second'
        );
    }
    sendEmail({
        email: email,
        subject: 'Activate Your Account',
        html: registrationSuccessEmail('User', parseInt(verifyCode.toString())),
    });

    return null;
};

const getMyProfile = async (userData: JwtPayload) => {
    let result = null;
    if (userData.role === USER_ROLE.client) {
        result = await Client.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive isAdminVerified',
        });
    } else if (userData.role === USER_ROLE.worker) {
        result = await Worker.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive isAdminVerified',
        });
    } else if (userData.role === USER_ROLE.manager) {
        result = await Manager.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive isAdminVerified',
        });
    } else if (userData.role === USER_ROLE.superAdmin) {
        result = await SuperAdmin.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive ',
        });
    } else if (userData.role === USER_ROLE.admin) {
        result = await Admin.findOne({ user: userData.id }).populate({
            path: 'user',
            select: 'isBlocked isActive ',
        });
    }
    return result;
};

const deleteUserAccount = async (user: JwtPayload, password: string) => {
    const userData = await User.findById(user.id);

    if (!userData) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }
    if (!(await User.isPasswordMatched(password, userData?.password))) {
        throw new AppError(httpStatus.FORBIDDEN, 'Password do not match');
    }

    if (userData.role === USER_ROLE.client) {
        await Client.findByIdAndDelete(user.profileId);
    } else if (userData.role === USER_ROLE.worker) {
        await Worker.findByIdAndDelete(user.profileId);
    } else if (userData.role === USER_ROLE.manager) {
        await Manager.findByIdAndDelete(user.profileId);
    }
    await User.findByIdAndDelete(user.id);

    return null;
};

// update user
const updateUserProfile = async (
    userData: JwtPayload,
    payload: UpdateUserProfileDTO
) => {
    if (userData.role == USER_ROLE.client) {
        const user = await Client.findById(userData.profileId);
        if (!user) {
            throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
        }
        const result = await Client.findByIdAndUpdate(
            userData.profileId,
            payload,
            {
                new: true,
                runValidators: true,
            }
        );
        return result;
    } else if (userData.role == USER_ROLE.worker) {
        // Working days must use the dedicated availability endpoint.
        payload = updateUserProfileValidationSchema.shape.body.strict().parse(payload);
        const user = await Worker.findById(userData.profileId);
        if (!user) {
            throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
        }
        const result = await Worker.findByIdAndUpdate(
            userData.profileId,
            payload,
            {
                new: true,
                runValidators: true,
            }
        );
        return result;
    } else if (userData.role == USER_ROLE.manager) {
        const user = await Manager.findById(userData.profileId);
        if (!user) {
            throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
        }
        const result = await Manager.findByIdAndUpdate(
            userData.profileId,
            payload,
            {
                new: true,
                runValidators: true,
            }
        );
        return result;
    } else if (userData.role == USER_ROLE.superAdmin) {
        const admin = await SuperAdmin.findById(userData.profileId);
        if (!admin) {
            throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
        }
        const result = await SuperAdmin.findByIdAndUpdate(
            userData.profileId,
            payload,
            { new: true, runValidators: true }
        );
        if (payload.profile_image && (admin as any).profile_image) {
            deleteFileFromS3((admin as any).profile_image);
        }

        return result;
    } else if (userData.role == USER_ROLE.admin) {
        const admin = await Admin.findById(userData.profileId);
        if (!admin) {
            throw new AppError(httpStatus.NOT_FOUND, 'Profile not found');
        }
        const result = await Admin.findByIdAndUpdate(
            userData.profileId,
            payload,
            { new: true, runValidators: true }
        );
        if (payload.profile_image && admin.profile_image) {
            deleteFileFromS3(admin.profile_image);
        }

        return result;
    }
};

const changeUserStatus = async (id: string) => {
    const user = await User.findById(id);
    if (!user) {
        throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }
    const result = await User.findByIdAndUpdate(
        id,
        { isBlocked: !user.isBlocked },
        { new: true, runValidators: true }
    );
    return result;
};

// upgrade account - simplified without customer/provider logic
const upgradeAccount = async (userData: JwtPayload) => {
    throw new AppError(
        httpStatus.BAD_REQUEST,
        'Upgrading account is not supported yet'
    );
};

const userServices = {
    registerUser,
    verifyCode,
    resendVerifyCode,
    getMyProfile,
    changeUserStatus,
    deleteUserAccount,
    updateUserProfile,
    upgradeAccount,
};

export default userServices;
