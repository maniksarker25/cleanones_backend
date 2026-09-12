import cron from 'node-cron';
import { Device } from './device.model';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export const upsertDevice = async (
    userId: string,
    playerId: string,
    platform: 'ios' | 'android' | 'web'
) => {
    if (!playerId) return;

    return await Device.findOneAndUpdate(
        { playerId },
        {
            userId,
            playerId,
            platform,
            isActive: true,
            lastActiveAt: new Date(),
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        }
    );
};

export const deactivateDevice = async (playerId: string) => {
    if (!playerId) return;

    await Device.findOneAndUpdate(
        { playerId },
        {
            isActive: false,
            lastActiveAt: new Date(),
        }
    );
};

cron.schedule('0 2 * * 0', async () => {
    try {
        console.log('Device cleanup cron started');

        const result = await Device.deleteMany({
            isActive: false,
            lastActiveAt: {
                $lt: new Date(Date.now() - THIRTY_DAYS),
            },
        });

        console.log(`Device cleanup done. Deleted: ${result.deletedCount}`);
    } catch (error) {
        console.error('Device cleanup cron failed:', error);
    }
});
