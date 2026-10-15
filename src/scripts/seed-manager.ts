import mongoose from 'mongoose';
import config from '../app/config';
import { Company } from '../app/modules/company/company.model';
import { Manager } from '../app/modules/manager/manager.model';
import { USER_ROLE } from '../app/modules/user/user.constant';
import { User } from '../app/modules/user/user.model';

const PASSWORD = '12345678';

const COMPANY = {
    email: 'company@yopmail.com',
    phone: '0000000002',
    name: 'Company Admin',
    company_name: 'Demo Company',
};

const MANAGER = {
    email: 'manager@yopmail.com',
    phone: '0000000001',
    name: 'Manager',
};

async function seedCompany(session: mongoose.ClientSession) {
    const existingUser = await User.findOne({ email: COMPANY.email }).session(
        session
    );
    if (existingUser) {
        const existing = await Company.findOne({ user: existingUser._id }).session(
            session
        );
        if (existing) {
            console.log(`Company admin ${COMPANY.email} already exists, skipping.`);
            return existing;
        }
    }

    const [user] = await User.create(
        [
            {
                email: COMPANY.email,
                password: PASSWORD,
                role: USER_ROLE.company_admin,
                roles: [USER_ROLE.company_admin],
                phone: COMPANY.phone,
                isVerified: true,
                profileModel: 'Company',
            },
        ],
        { session }
    );
    const [company] = await Company.create(
        [
            {
                user: user._id,
                name: COMPANY.name,
                email: COMPANY.email,
                phone: COMPANY.phone,
                company_name: COMPANY.company_name,
            },
        ],
        { session }
    );
    await User.findByIdAndUpdate(
        user._id,
        { profileId: company._id },
        { session }
    );
    console.log(`Company admin seeded: ${COMPANY.email} / ${PASSWORD}`);
    return company;
}

async function seedManager(
    session: mongoose.ClientSession,
    companyId: mongoose.Types.ObjectId | string
) {
    const existingUser = await User.findOne({ email: MANAGER.email }).session(
        session
    );
    if (existingUser) {
        const result = await Manager.updateOne(
            { user: existingUser._id, company: { $exists: false } },
            { $set: { company: companyId } },
            { session }
        );
        console.log(
            result.modifiedCount
                ? `Existing manager ${MANAGER.email} attached to the company.`
                : `Manager ${MANAGER.email} already exists, skipping.`
        );
        return;
    }

    const [user] = await User.create(
        [
            {
                email: MANAGER.email,
                password: PASSWORD,
                role: USER_ROLE.manager,
                roles: [USER_ROLE.manager],
                phone: MANAGER.phone,
                isVerified: true,
                profileModel: 'Manager',
            },
        ],
        { session }
    );
    const [manager] = await Manager.create(
        [
            {
                user: user._id,
                company: companyId,
                name: MANAGER.name,
                email: MANAGER.email,
                phone: MANAGER.phone,
            },
        ],
        { session }
    );
    await User.findByIdAndUpdate(
        user._id,
        { profileId: manager._id },
        { session }
    );
    console.log(`Manager seeded: ${MANAGER.email} / ${PASSWORD}`);
}

async function main() {
    await mongoose.connect(config.database_url as string);
    console.log('DB connected');

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const company = await seedCompany(session);
            await seedManager(session, company._id);
        });
    } finally {
        await session.endSession();
        await mongoose.disconnect();
    }
}

main().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
});
