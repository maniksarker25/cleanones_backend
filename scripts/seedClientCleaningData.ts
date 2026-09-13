import assert from 'assert/strict';
import { createHash } from 'crypto';
import mongoose from 'mongoose';
import config from '../src/app/config';
import { Client } from '../src/app/modules/client/client.model';
import { Location } from '../src/app/modules/location/location.model';
import { Room } from '../src/app/modules/room/room.model';
import { Task } from '../src/app/modules/task/task.model';

const clientId = new mongoose.Types.ObjectId('6aa619b429fe89eafa009e0b');
const batchId = (kind: string, index: number) => new mongoose.Types.ObjectId(
    createHash('sha256').update(`${clientId}:cleaning-3-12-22:v1:${kind}:${index}`).digest('hex').slice(0, 24)
);
const locationNames = ['Demo Central Office', 'Demo Riverside Office', 'Demo Garden Office'];
const roomNames = ['Reception', 'Meeting Room', 'Kitchen', 'Washroom'];

async function seed() {
    await mongoose.connect(config.database_url as string, {
        serverSelectionTimeoutMS: 15000, autoIndex: false,
    });
    try {
        const client = await Client.findOne({
            _id: clientId, email: 'client@yopmail.com', isDeleted: false,
        }).select('_id manager').lean();
        assert(client, 'Client ID/email mismatch or client is deleted; no records created.');
        assert(client.manager, 'Client has no manager; no records created.');

        const locations = locationNames.map((name, i) => ({
            _id: batchId('location', i), client: clientId,
            last_updated_by: client.manager, name,
            address: `${40 + i} Sample Road, Dhaka, Bangladesh`,
            description: 'Sample office location for cleaning workflow testing.',
            type: 'Other', is_active: true,
            location: { type: 'Point', coordinates: [90.4 + i * 0.002, 23.8 + i * 0.002] },
        }));
        const rooms = Array.from({ length: 12 }, (_, i) => ({
            _id: batchId('room', i), location: locations[Math.floor(i / 4)]._id,
            last_updated_by: client.manager, name: roomNames[i % 4],
            room_type: ['reception', 'meeting', 'kitchen', 'washroom'][i % 4],
            cleaning_type: 'Standard', floor: i % 4 < 2 ? 0 : 1, is_active: true,
        }));
        // One daily task per room, plus ten weekly/monthly tasks: 8/8/6 per location.
        const tasks = Array.from({ length: 22 }, (_, i) => {
            const room = rooms[i % 12];
            const daily = i < 12;
            const weekly = !daily && i % 2 === 0;
            return {
                _id: batchId('task', i), client: clientId, location: room.location,
                room: room._id, last_updated_by: client.manager,
                name: `${daily ? 'Clean floors and surfaces' : weekly ? 'Deep clean fixtures' : 'Detail clean vents'} — ${room.name}`,
                frequency_type: daily ? 'daily' : weekly ? 'weekly' : 'monthly',
                ...(weekly ? { days_of_week: ['mon', 'thu'] } : {}),
                ...(!daily && !weekly ? { days_of_month: [1, 15] } : {}),
                duration_minutes: daily ? 15 : weekly ? 30 : 45,
                is_active: true, is_photo_required: true,
                photo_requirements: ['Before cleaning', 'After cleaning'].map((title) => ({
                    title, photo_url: null, is_uploaded: false,
                })),
            };
        });

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const existing = [
                    await Location.countDocuments({ _id: { $in: locations.map((v) => v._id) } }).session(session),
                    await Room.countDocuments({ _id: { $in: rooms.map((v) => v._id) } }).session(session),
                    await Task.countDocuments({ _id: { $in: tasks.map((v) => v._id) } }).session(session),
                ];
                assert(existing.every((n) => n === 0), 'This seed batch already exists; no records changed.');
                await Location.create(locations, { session, ordered: true });
                await Room.create(rooms, { session, ordered: true });
                await Task.create(tasks, { session, ordered: true });

                const savedLocations = await Location.find({ _id: { $in: locations.map((v) => v._id) } }).session(session).lean();
                const savedRooms = await Room.find({ _id: { $in: rooms.map((v) => v._id) } }).session(session).lean();
                const savedTasks = await Task.find({ _id: { $in: tasks.map((v) => v._id) } }).session(session).lean();
                assert.equal(savedLocations.length, 3);
                assert.equal(savedRooms.length, 12);
                assert.equal(savedTasks.length, 22);
                assert(savedLocations.every((v) => v.client.equals(clientId)));
                assert(savedRooms.every((v) => locations.some((l) => l._id.equals(v.location))));
                assert(savedTasks.every((v) => v.client.equals(clientId) &&
                    rooms.some((r) => r._id.equals(v.room) && r.location.equals(v.location)) &&
                    v.is_photo_required && v.photo_requirements?.length === 2 &&
                    v.photo_requirements.every((p) => p.photo_url === null && p.is_uploaded === false)));
            });
        } finally { await session.endSession(); }
        console.log(JSON.stringify({
            client: clientId.toString(), email: 'client@yopmail.com',
            createdAndVerified: { locations: 3, rooms: 12, tasks: 22 },
            locations: locations.map((l, i) => ({ id: l._id, name: l.name, rooms: 4, tasks: i === 2 ? 6 : 8 })),
        }, null, 2));
    } finally { await mongoose.disconnect(); }
}

seed().catch((error) => {
    console.error(error instanceof assert.AssertionError
        ? error.message : `Client seed failed (${error?.name || 'Error'}); credentials omitted.`);
    process.exitCode = 1;
});
