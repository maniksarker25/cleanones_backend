import httpStatus from 'http-status';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import chatServices from '../chat/chat.services';
import adminCredentialsEmailBody from '../../mailTemplate/adminCredentialsEmailBody';
import sendEmail from '../../utilities/sendEmail';
import { USER_ROLE } from '../user/user.constant';
import { TUser } from '../user/user.interface';
import { User } from '../user/user.model';
import { TClient } from './client.interface';
import { Client } from './client.model';

const createClientIntoDB = async (
    managerId: string,
    payload: Omit<TClient, 'manager'> & {
        password: string;
        confirmPassword: string;
    }
) => {
    const { password, confirmPassword, ...clientData } = payload;

    if (password !== confirmPassword) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Password and confirm password doesn't match"
        );
    }

    const emailExist = await User.findOne({ email: clientData.email });
    if (emailExist) {
        throw new AppError(httpStatus.BAD_REQUEST, 'This email already exists');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userDataPayload: Partial<TUser> = {
            email: clientData.email,
            phone: clientData.phone,
            password,
            role: USER_ROLE.client,
            roles: [USER_ROLE.client],
            isVerified: true,
        };

        const [user] = await User.create([userDataPayload], { session });

        const clientPayload = {
            ...clientData,
            user: user._id,
            manager: managerId,
        };
        const [profile] = await Client.create([clientPayload], { session });

        await User.findByIdAndUpdate(
            user._id,
            { profileId: profile._id },
            { session }
        );

        await sendEmail({
            email: clientData.email,
            subject: 'Your Account Login Credentials',
            html: adminCredentialsEmailBody(
                clientData.name || 'Client',
                clientData.email,
                password
            ),
        });

        await session.commitTransaction();
        session.endSession();

        // Best-effort, outside the transaction — same pattern as
        // createChatGroupForPlan/createWorkerManagersChat. Idempotent (unique
        // index on the chat side), so a retry here can never create a
        // duplicate.
        await chatServices.createClientManagersChat(profile._id);

        return profile;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const updateClientIntoDB = async (
    managerId: string,
    id: string,
    payload: Partial<TClient>
) => {
    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    }

    if (payload.email && payload.email !== client.email) {
        const emailExist = await User.findOne({ email: payload.email });
        if (emailExist) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                'This email already exists'
            );
        }
    }

    const result = await Client.findByIdAndUpdate(
        id,
        { ...payload, last_updated_by: managerId },
        {
            new: true,
            runValidators: true,
        }
    );

    if (payload.email || payload.phone) {
        await User.findByIdAndUpdate(client.user, {
            ...(payload.email && { email: payload.email }),
            ...(payload.phone && { phone: payload.phone }),
        });
    }

    return result;
};

const deleteClientFromDB = async (managerId: string, id: string) => {
    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        await Client.findByIdAndUpdate(
            id,
            { isDeleted: true, last_updated_by: managerId },
            { session }
        );
        await User.findByIdAndUpdate(
            client.user,
            { isDeleted: true, isBlocked: true },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        await chatServices.deactivateClientManagersChat(id);

        return null;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const getAllClientsFromDB = async (query: Record<string, unknown>) => {
    const clientQuery = new QueryBuilder(
        Client.find({ isDeleted: false })
            .populate({
                path: 'manager',
                populate: {
                    path: 'user',
                    select: 'email phone',
                },
            })
            .populate({
                path: 'last_updated_by',
                populate: {
                    path: 'user',
                    select: 'email phone',
                },
            }),
        query
    )
        .search(['name', 'email', 'phone', 'company_name'])
        .filter()
        .fields()
        .paginate()
        .sort();

    const meta = await clientQuery.countTotal();
    const result = await clientQuery.modelQuery;

    return {
        meta,
        result,
    };
};

const clientServices = {
    createClientIntoDB,
    updateClientIntoDB,
    deleteClientFromDB,
    getAllClientsFromDB,
};

export default clientServices;
