/* eslint-disable no-console */
import mongoose from 'mongoose';
import config from '../src/app/config';
import { Manager } from '../src/app/modules/manager/manager.model';
import { USER_ROLE } from '../src/app/modules/user/user.constant';
import { User } from '../src/app/modules/user/user.model';

const MANAGER_COUNT = 4;
const DEFAULT_PASSWORD = config.default_pass || 'Password123!';

const managersToSeed = Array.from({ length: MANAGER_COUNT }, (_, i) => {
    const n = i + 1;
    return {
        name: `Manager ${n}`,
        email: `manager${n}@yopmail.com`,
        phone: `01000000${String(n).padStart(2, '0')}`,
    };
});

const seedManagers = async () => {
    await mongoose.connect(config.database_url as string);
    console.log('DB connected for manager seeding');

    for (const data of managersToSeed) {
        const existingUser = await User.findOne({ email: data.email });
        if (existingUser) {
            console.log(`Skipped (already exists): ${data.email}`);
            continue;
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const userPayload = {
                email: data.email,
                phone: data.phone,
                password: DEFAULT_PASSWORD,
                role: USER_ROLE.manager,
                roles: [USER_ROLE.manager],
                isVerified: true,
                profileModel: 'Manager',
            };
            const user = await User.create([userPayload], { session });

            const managerPayload = {
                user: user[0]._id,
                name: data.name,
                email: data.email,
                phone: data.phone,
            };
            const manager = await Manager.create([managerPayload], {
                session,
            });

            await User.findByIdAndUpdate(
                user[0]._id,
                { profileId: manager[0]._id },
                { session }
            );

            await session.commitTransaction();
            console.log(`Created manager: ${data.email} / ${DEFAULT_PASSWORD}`);
        } catch (error) {
            await session.abortTransaction();
            console.error(`Failed to create ${data.email}:`, error);
        } finally {
            session.endSession();
        }
    }

    await mongoose.disconnect();
    console.log('Done.');
};

seedManagers().catch((error) => {
    console.error(error);
    process.exit(1);
});
