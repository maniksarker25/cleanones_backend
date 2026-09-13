import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
import config from '../src/app/config';
import { Client } from '../src/app/modules/client/client.model';
import { Location } from '../src/app/modules/location/location.model';
import { Manager } from '../src/app/modules/manager/manager.model';
import { Room } from '../src/app/modules/room/room.model';
import { Task } from '../src/app/modules/task/task.model';
import { User } from '../src/app/modules/user/user.model';

// Stable IDs make this batch safe to rerun without duplicating or editing data.
const id = (kind: number, index: number) => new mongoose.Types.ObjectId(
    `5eed20260913${kind.toString(16).padStart(4, '0')}${index.toString(16).padStart(8, '0')}`
);
const companies = ['Demo Aurora Hospitality', 'Demo Maple Academy', 'Demo Cedar Offices'];
const seed = async () => {
    await mongoose.connect(config.database_url as string, { serverSelectionTimeoutMS: 15000, autoIndex: false });
    try {
        const activeUsers = await User.find({
            isActive: true, isVerified: true, isDeleted: false, isBlocked: false,
        }).select('_id').lean();
        const managers = await Manager.find({ user: { $in: activeUsers.map((u) => u._id) } })
            .sort({ _id: 1 }).select('_id').lean();
        if (!managers.length) throw new Error('No active verified manager is available.');
        const counts = { clients: 0, locations: 0, rooms: 0, tasks: 0 };
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                Object.keys(counts).forEach((key) => { counts[key as keyof typeof counts] = 0; });
                for (let c = 0; c < 3; c++) {
                    const clientId = id(2, c);
                    const userId = id(1, c);
                    const manager = managers[c % managers.length]._id;
                    const email = `demo.cleaning.client${c + 1}@example.com`;
                    const phone = `+880199990090${c + 1}`;
                    if (!await Client.exists({ _id: clientId }).session(session)) {
                        if (await User.exists({ $or: [{ email }, { phone }, { _id: userId }] }).session(session)) {
                            throw new Error(`Sample account collision for ${email}; no existing account will be changed.`);
                        }
                        await User.create([{
                            _id: userId, email, phone,
                            password: config.default_pass || randomBytes(24).toString('base64url'),
                            role: 'client', roles: ['client'], isVerified: true,
                            profileId: clientId, profileModel: 'Client',
                        }], { session });
                        await Client.create([{
                            _id: clientId, user: userId, manager,
                            name: `Demo Client ${c + 1}`, company_name: companies[c],
                            email, phone, contract_status: 'Active',
                        }], { session });
                        counts.clients++;
                    }
                    for (let l = 0; l < 2; l++) {
                        const locationIndex = c * 2 + l;
                        const locationId = id(3, locationIndex);
                        if (!await Location.exists({ _id: locationId }).session(session)) {
                            await Location.create([{
                                _id: locationId, client: clientId, last_updated_by: manager,
                                name: `${companies[c]} — ${l === 0 ? 'Main' : 'Annex'} Building`,
                                address: `${20 + locationIndex} Demo Road, Dhaka, Bangladesh`,
                                description: 'Sample location for cleaning workflow testing.',
                                type: ['Hotel', 'School', 'Other'][c],
                                location: { type: 'Point', coordinates: [90.4 + l * 0.001, 23.8 + c * 0.001] },
                            }], { session });
                            counts.locations++;
                        }
                        for (let r = 0; r < 3; r++) {
                            const roomIndex = locationIndex * 3 + r;
                            const roomId = id(4, roomIndex);
                            const roomName = ['Reception', 'Meeting Room', 'Washroom'][r];
                            if (!await Room.exists({ _id: roomId }).session(session)) {
                                await Room.create([{
                                    _id: roomId, location: locationId, last_updated_by: manager,
                                    name: roomName, room_type: ['reception', 'meeting', 'washroom'][r],
                                    cleaning_type: 'Standard', floor: r === 1 ? 1 : 0,
                                }], { session });
                                counts.rooms++;
                            }
                            for (let t = 0; t < 3; t++) {
                                const taskId = id(5, roomIndex * 3 + t);
                                if (await Task.exists({ _id: taskId }).session(session)) continue;
                                await Task.create([{
                                    _id: taskId, client: clientId, location: locationId, room: roomId,
                                    last_updated_by: manager,
                                    name: `${['Clean floors and surfaces', 'Deep clean fixtures', 'Detail clean vents'][t]} — ${roomName}`,
                                    frequency_type: ['daily', 'weekly', 'monthly'][t],
                                    ...(t === 1 ? { days_of_week: ['mon', 'thu'] } : {}),
                                    ...(t === 2 ? { days_of_month: [1, 15] } : {}),
                                    duration_minutes: [15, 30, 45][t],
                                    is_photo_required: true,
                                    photo_requirements: ['Before cleaning', 'After cleaning'].map((title) => ({
                                        title, photo_url: null, is_uploaded: false,
                                    })),
                                }], { session });
                                counts.tasks++;
                            }
                        }
                    }
                }
            });
        } finally { await session.endSession(); }
        const verified = {
            clients: await Client.countDocuments({ _id: { $in: Array.from({ length: 3 }, (_, i) => id(2, i)) } }),
            locations: await Location.countDocuments({ _id: { $in: Array.from({ length: 6 }, (_, i) => id(3, i)) } }),
            rooms: await Room.countDocuments({ _id: { $in: Array.from({ length: 18 }, (_, i) => id(4, i)) } }),
            tasks: await Task.countDocuments({ _id: { $in: Array.from({ length: 54 }, (_, i) => id(5, i)) } }),
        };
        console.log(JSON.stringify({ created: counts, verified, clients: companies }, null, 2));
    } finally { await mongoose.disconnect(); }
};

seed().catch((error) => {
    // Do not print connection strings or account credentials on failure.
    console.error(`Cleaning seed failed (${error?.name || 'Error'}). No credentials logged.`);
    process.exitCode = 1;
});
