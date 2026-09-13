require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const config = require('../src/app/config').default;
const { Client } = require('../src/app/modules/client/client.model');
const { Manager } = require('../src/app/modules/manager/manager.model');
const { Location } = require('../src/app/modules/location/location.model');
const { Room } = require('../src/app/modules/room/room.model');
const { Task } = require('../src/app/modules/task/task.model');
const { CleaningPlan } = require('../src/app/modules/cleaning_plan/cleaning_plan.model');

const clientId = new mongoose.Types.ObjectId('6aa619b429fe89eafa009e0b');
const planId = (i) => new mongoose.Types.ObjectId(createHash('sha256')
    .update(`${clientId}:four-unassigned-cleaning-plans:v1:${i}`).digest('hex').slice(0, 24));

async function seed() {
    await mongoose.connect(config.database_url, { serverSelectionTimeoutMS: 15000, autoIndex: false });
    try {
        const session = await mongoose.startSession();
        let summary;
        try {
            await session.withTransaction(async () => {
                const client = await Client.findOne({ _id: clientId, email: 'client@yopmail.com', isDeleted: false }).session(session).lean();
                assert(client, 'Client ID/email mismatch; no plans created.');
                assert(await Manager.exists({ _id: client.manager }).session(session), 'Client manager is missing.');
                const names = ['Demo Central Office', 'Demo Riverside Office', 'Demo Garden Office'];
                const locations = await Location.find({ client: clientId, is_active: true, name: { $in: names } }).session(session).lean();
                assert.equal(locations.length, 3, 'Expected the three previously created sample locations.');
                locations.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
                const rooms = await Room.find({ location: { $in: locations.map((l) => l._id) }, is_active: true }).sort({ name: 1, _id: 1 }).session(session).lean();
                const groups = locations.map((l) => rooms.filter((r) => r.location.equals(l._id)));
                assert(groups.every((g) => g.length === 4), 'Expected four active rooms per sample location.');
                const tasks = await Task.find({ room: { $in: rooms.map((r) => r._id) }, is_active: true }).session(session).lean();
                assert(rooms.every((r) => tasks.some((t) => t.room.equals(r._id) && t.client.equals(clientId) && t.location.equals(r.location))), 'Each room must have an active task belonging to this client and location.');
                const specs = [
                    { location: locations[0], rooms: groups[0].filter((r) => ['Reception', 'Meeting Room'].includes(r.name)), title: 'Central Office — Reception and Meeting Room' },
                    { location: locations[0], rooms: groups[0].filter((r) => ['Kitchen', 'Washroom'].includes(r.name)), title: 'Central Office — Kitchen and Washroom' },
                    { location: locations[1], rooms: groups[1], title: 'Riverside Office — Full Cleaning' },
                    { location: locations[2], rooms: groups[2], title: 'Garden Office — Full Cleaning' },
                ];
                assert.equal(new Set(specs.flatMap((s) => s.rooms.map((r) => r._id.toString()))).size, 12);
                const startDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + 86400000));
                const plans = specs.map((spec, i) => ({
                    _id: planId(i), title: spec.title,
                    description: `Recurring cleaning of ${spec.rooms.map((r) => r.name).join(', ')} at ${spec.location.name}. Schedule follows the rooms' active tasks.`,
                    client: clientId, manager: client.manager, last_updated_by: client.manager,
                    location: spec.location._id, rooms: spec.rooms.map((r) => r._id),
                    assigned_workers: [], additional_tasks: [],
                    date_time: new Date(`${startDate}T${String(9 + i * 2).padStart(2, '0')}:00:00+06:00`),
                    end_date: null, status: 'active', is_active: true,
                    note: 'Sample cleaning plan awaiting worker assignment.',
                    max_estimated_duration: tasks.filter((t) => spec.rooms.some((r) => r._id.equals(t.room))).reduce((sum, t) => sum + (t.duration_minutes || 0), 0),
                }));
                assert.equal(await CleaningPlan.countDocuments({ _id: { $in: plans.map((p) => p._id) } }).session(session), 0, 'This batch already exists; no plans changed.');
                await CleaningPlan.create(plans, { session, ordered: true });
                const saved = await CleaningPlan.find({ _id: { $in: plans.map((p) => p._id) } }).session(session).lean();
                assert.equal(saved.length, 4);
                assert(saved.every((p) => p.client.equals(clientId) && p.assigned_workers.length === 0));
                summary = { created: 4, client: 'client@yopmail.com', startDate, timezone: 'Asia/Dhaka', plans: plans.map((p) => ({ id: p._id, title: p.title, rooms: p.rooms.length, date_time: p.date_time, duration_minutes: p.max_estimated_duration, assigned_workers: p.assigned_workers })) };
            });
        } finally { await session.endSession(); }
        console.log(JSON.stringify(summary, null, 2));
    } finally { await mongoose.disconnect(); }
}
seed().catch((error) => {
    console.error(error instanceof assert.AssertionError ? error.message : `Plan seed failed (${error?.name || 'Error'}); credentials omitted.`);
    process.exitCode = 1;
});
