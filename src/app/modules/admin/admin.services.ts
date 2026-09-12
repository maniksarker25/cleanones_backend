/* eslint-disable @typescript-eslint/no-explicit-any */

import QueryBuilder from '../../builder/QueryBuilder';

import httpStatus from 'http-status';
import mongoose from 'mongoose';
import AppError from '../../error/appError';
import adminCredentialsEmailBody from '../../mailTemplate/adminCredentialsEmailBody';
import sendEmail from '../../utilities/sendEmail';
import { USER_ROLE } from '../user/user.constant';
import { TUser } from '../user/user.interface';
import { User } from '../user/user.model';
import { IAdmin } from './admin.interface';
import Admin from './admin.model';

const generateVerifyCode = (): number => {
    return Math.floor(100000 + Math.random() * 900000);
};
const createAdminIntoDB = async (
    payload: IAdmin & {
        password: string;
        confirmPassword: string;
    }
) => {
    const { password, confirmPassword, ...userData } = payload;

    if (password !== confirmPassword) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Password and confirm password doesn't match"
        );
    }

    const emailExist = await User.findOne({ email: userData.email });
    if (emailExist) {
        throw new AppError(httpStatus.BAD_REQUEST, 'This email already exists');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const verifyCode = generateVerifyCode();

        const userDataPayload: Partial<TUser> = {
            email: userData?.email,
            phone: userData?.phone,
            password,
            role: USER_ROLE.admin,
            roles: [USER_ROLE.admin],
            verifyCode,
            codeExpireIn: new Date(Date.now() + 5 * 60000),
            isVerified: true,
        };

        // Create user
        const [user] = await User.create([userDataPayload], { session });

        const adminPayload = {
            ...userData,
            user: user._id,
        };
        const [profile] = await Admin.create([adminPayload], { session });

        await User.findByIdAndUpdate(
            user._id,
            { profileId: profile._id },
            { session }
        );

        await sendEmail({
            email: userData.email,
            subject: 'Your Admin Dashboard Login Credentials',
            html: adminCredentialsEmailBody(
                userData.name || 'Admin',
                userData.email,
                password
            ),
        });

        // If SMS sent successfully, commit transaction
        await session.commitTransaction();
        session.endSession();

        return profile;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const updateAdminProfile = async (userId: string, payload: Partial<IAdmin>) => {
    const result = await Admin.findOneAndUpdate({ user: userId }, payload, {
        new: true,
        runValidators: true,
    });

    return result;
};

const deleteAdminFromDB = async (id: string) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const admin = await Admin.findById(id).session(session);
        if (!admin) {
            throw new AppError(httpStatus.NOT_FOUND, 'Admin not found');
        }

        // Delete associated User and Admin within the transaction
        await User.findByIdAndDelete(admin.user).session(session);
        await Admin.findByIdAndDelete(id).session(session);

        await session.commitTransaction();
        return null;
    } catch (error) {
        await session.abortTransaction();
        throw error; // re-throw the error for further handling
    } finally {
        session.endSession();
    }
};

// update Admin status
const updateAdminStatus = async (id: string) => {
    const session = await Admin.startSession();
    session.startTransaction();

    try {
        const admin = await Admin.findById(id);
        if (!admin) {
            throw new AppError(httpStatus.NOT_FOUND, 'Admin not found');
        }
        const result = await Admin.findByIdAndUpdate(
            id,
            { isActive: !admin.isActive },
            { runValidators: true, new: true, session: session }
        );

        if (!result) {
            throw new AppError(
                httpStatus.NOT_FOUND,
                'Failed to updated status'
            );
        }

        await User.findOneAndUpdate(
            { _id: result.user },
            { isActive: result.isActive },
            { runValidators: true, new: true, session: session }
        );

        await session.commitTransaction();
        session.endSession();

        return result;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw new AppError(
            httpStatus.SERVICE_UNAVAILABLE,
            'Something went wrong ,try again letter '
        );
    }
};

// get all Admin

const getAllAdminFromDB = async (query: Record<string, any>) => {
    const AdminQuery = new QueryBuilder(Admin.find(), query)
        .search(['storeName'])
        .fields()
        .filter()
        .paginate()
        .sort();
    const meta = await AdminQuery.countTotal();
    const result = await AdminQuery.modelQuery;

    return {
        meta,
        result,
    };
};

const AdminServices = {
    updateAdminProfile,
    updateAdminStatus,
    getAllAdminFromDB,
    deleteAdminFromDB,
    createAdminIntoDB,
};

export default AdminServices;
