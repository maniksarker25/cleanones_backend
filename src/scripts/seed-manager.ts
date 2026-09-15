/**
 * One-off seed: creates a single Manager (User + Manager profile, linked via
 * profileId/profileModel) for a freshly pointed-at database, mirroring the
 * User -> role-profile -> profileId back-link pattern used by
 * src/app/DB/index.ts's seedSuperAdmin. Idempotent: no-ops if a User with
 * this email already exists.
 *
 * Run with: npx ts-node --transpile-only src/scripts/seed-manager.ts
 */
import mongoose from 'mongoose';
import config from '../app/config';
import { Manager } from '../app/modules/manager/manager.model';
import { USER_ROLE } from '../app/modules/user/user.constant';
import { User } from '../app/modules/user/user.model';

const MANAGER_EMAIL = 'manager@yopmail.com';
const MANAGER_PASSWORD = '12345678';
const MANAGER_NAME = 'Manager';
const MANAGER_PHONE = '0000000001';

async function main() {
    await mongoose.connect(config.database_url as string);
    console.log('DB connected');

    const existing = await User.findOne({ email: MANAGER_EMAIL });
    if (existing) {
        console.log(`User with email ${MANAGER_EMAIL} already exists, skipping seed.`);
        await mongoose.disconnect();
        return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const user = await User.create(
            [
                {
                    email: MANAGER_EMAIL,
                    password: MANAGER_PASSWORD,
                    role: USER_ROLE.manager,
                    roles: [USER_ROLE.manager],
                    phone: MANAGER_PHONE,
                    isVerified: true,
                    profileModel: 'Manager',
                },
            ],
            { session }
        );

        const manager = await Manager.create(
            [
                {
                    user: user[0]._id,
                    name: MANAGER_NAME,
                    email: MANAGER_EMAIL,
                    phone: MANAGER_PHONE,
                },
            ],
            { session }
        );

        await User.findByIdAndUpdate(
            user[0]._id,
            { profileId: manager[0]._id },
            { session }
        );

        await session.commitTransaction();
        session.endSession();
        console.log(`Manager seeded: ${MANAGER_EMAIL} / ${MANAGER_PASSWORD}`);
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
});
