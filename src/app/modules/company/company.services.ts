import httpStatus from 'http-status';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import { PROFILE_MODEL_BY_ROLE, USER_ROLE } from '../user/user.constant';
import { User } from '../user/user.model';
import { ICompany } from './company.interface';
import { Company } from './company.model';

type CreateCompanyPayload = Omit<ICompany, '_id' | 'user' | 'isActive'> & {
    password: string;
    confirmPassword: string;
};

const createCompanyIntoDB = async (payload: CreateCompanyPayload) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    const { password, confirmPassword, ...companyData } = payload;
    companyData.email = companyData.email.trim().toLowerCase();

    const existing = await User.findOne({
        isDeleted: { $ne: true },
        $or: [{ email: companyData.email }, { phone: companyData.phone }],
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
                        email: companyData.email,
                        phone: companyData.phone,
                        password,
                        role: USER_ROLE.company_admin,
                        roles: [USER_ROLE.company_admin],
                        profileModel: PROFILE_MODEL_BY_ROLE.company_admin,
                        isVerified: true,
                        is_admin_created: true,
                    },
                ],
                { session }
            );
            const [company] = await Company.create(
                [{ ...companyData, user: user._id }],
                { session }
            );
            await User.findByIdAndUpdate(
                user._id,
                { profileId: company._id },
                { session }
            );
            return company;
        });
    } finally {
        await session.endSession();
    }
};

const getAllCompaniesFromDB = async (query: Record<string, unknown>) => {
    const companyQuery = new QueryBuilder(
        Company.find().populate({
            path: 'user',
            select: 'email phone isBlocked isActive',
        }),
        query
    )
        .search(['name', 'email', 'phone', 'company_name'])
        .filter()
        .paginate()
        .sort();

    const meta = await companyQuery.countTotal();
    const result = await companyQuery.modelQuery;
    return { meta, result };
};

const getSingleCompanyFromDB = async (id: string) => {
    if (!mongoose.isObjectIdOrHexString(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid company ID');
    }
    const company = await Company.findById(id).populate({
        path: 'user',
        select: 'email phone isBlocked isActive',
    });
    if (!company) throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
    return company;
};

const updateMyCompanyIntoDB = async (
    profileId: string,
    payload: Partial<ICompany>
) => {
    const company = await Company.findByIdAndUpdate(
        profileId,
        { $set: payload },
        { new: true, runValidators: true }
    );
    if (!company) throw new AppError(httpStatus.NOT_FOUND, 'Company not found');
    return company;
};

export default {
    createCompanyIntoDB,
    getAllCompaniesFromDB,
    getSingleCompanyFromDB,
    updateMyCompanyIntoDB,
};
