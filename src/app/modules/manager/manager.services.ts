import httpStatus from 'http-status';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import { Company } from '../company/company.model';
import { USER_ROLE } from '../user/user.constant';
import { User } from '../user/user.model';
import { TManager } from './manager.interface';
import { Manager } from './manager.model';

type CreateManagerPayload = Omit<TManager, 'user' | 'company'> & {
    password: string;
    confirmPassword: string;
};

const createManagerIntoDB = async (
    companyId: string,
    payload: CreateManagerPayload
) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const { password, confirmPassword, ...managerData } = payload;
    managerData.email = managerData.email.trim().toLowerCase();

    if (!mongoose.isObjectIdOrHexString(companyId)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid company ID');
    }
    const company = await Company.exists({ _id: companyId, isActive: true });
    if (!company) throw new AppError(httpStatus.NOT_FOUND, 'Company not found');

    const existing = await User.findOne({
        isDeleted: { $ne: true },
        $or: [{ email: managerData.email }, { phone: managerData.phone }],
    });
    if (existing) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'Email or phone already exists'
        );
    }

    const session = await mongoose.startSession();
    try {
        return await session.withTransaction(async () => {
            const [user] = await User.create(
                [
                    {
                        email: managerData.email,
                        phone: managerData.phone,
                        password,
                        role: USER_ROLE.manager,
                        roles: [USER_ROLE.manager],
                        profileModel: 'Manager',
                        isVerified: true,
                    },
                ],
                { session }
            );
            const [manager] = await Manager.create(
                [{ ...managerData, company: companyId, user: user._id }],
                { session }
            );
            await User.findByIdAndUpdate(
                user._id,
                { profileId: manager._id },
                { session }
            );
            return manager;
        });
    } finally {
        await session.endSession();
    }
};

const getAllManagersFromDB = async (
    companyId: string | null,
    query: Record<string, unknown>
) => {
    const managerQuery = new QueryBuilder(
        Manager.find(companyId ? { company: companyId } : {}).populate({ path: 'user', select: 'email phone isBlocked' }),
        query
    )
        .search(['name', 'email', 'phone'])
        .filter()
        .paginate()
        .sort();

    const meta = await managerQuery.countTotal();
    const result = await managerQuery.modelQuery;
    return { meta, result };
};

const findOwnManagerOrThrow = async (companyId: string, id: string) => {
    if (!mongoose.isObjectIdOrHexString(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid manager ID');
    }
    const manager = await Manager.findOne({ _id: id, company: companyId });
    if (!manager) throw new AppError(httpStatus.NOT_FOUND, 'Manager not found');
    return manager;
};

const getSingleManagerFromDB = async (companyId: string, id: string) => {
    await findOwnManagerOrThrow(companyId, id);
    return Manager.findById(id).populate({
        path: 'user',
        select: 'email phone isBlocked isActive',
    });
};

const updateManagerIntoDB = async (
    companyId: string,
    id: string,
    payload: Partial<Pick<TManager, 'name' | 'phone' | 'address'>>
) => {
    const manager = await findOwnManagerOrThrow(companyId, id);

    if (payload.phone !== undefined && payload.phone !== manager.phone) {
        const taken = await User.exists({
            _id: { $ne: manager.user },
            isDeleted: { $ne: true },
            phone: payload.phone,
        });
        if (taken) {
            throw new AppError(httpStatus.BAD_REQUEST, 'Phone already exists');
        }
    }

    const session = await mongoose.startSession();
    try {
        return await session.withTransaction(async () => {
            if (payload.phone !== undefined) {
                await User.findByIdAndUpdate(
                    manager.user,
                    { phone: payload.phone },
                    { session }
                );
            }
            return Manager.findByIdAndUpdate(
                id,
                { $set: payload },
                { new: true, runValidators: true, session }
            );
        });
    } finally {
        await session.endSession();
    }
};

const setManagerBlockedInDB = async (
    companyId: string,
    id: string,
    blocked: boolean
) => {
    const manager = await findOwnManagerOrThrow(companyId, id);
    await User.findByIdAndUpdate(manager.user, { isBlocked: blocked });
    return Manager.findById(id).populate({
        path: 'user',
        select: 'email phone isBlocked isActive',
    });
};

export default {
    createManagerIntoDB,
    getAllManagersFromDB,
    getSingleManagerFromDB,
    updateManagerIntoDB,
    setManagerBlockedInDB,
};
