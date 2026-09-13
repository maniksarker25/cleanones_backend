require('ts-node/register/transpile-only');
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { CleaningPlan } = require('../src/app/modules/cleaning_plan/cleaning_plan.model');
const { Shift } = require('../src/app/modules/shift/shift.model');
const { Task } = require('../src/app/modules/task/task.model');
const services = require('../src/app/modules/shift/shift.services').default;
const validation = require('../src/app/modules/shift/shift.validation').default;
const day = new Date('2026-09-13T00:00:00Z');
const query = (rows) => ({ select: () => query(rows), lean: async () => rows });

test('worker date validation rejects impossible dates and identity overrides', () => {
    for (const date of ['2026-09-13', '2024-02-29']) {
        assert.equal(validation.workerShiftsQuery.safeParse({ date }).success, true);
    }
    for (const input of [{}, { date: '2026-02-29' }, { date: '2026-04-31' },
        { date: '2026-9-13' }, { date: '2026-09-13T12:00:00Z' },
        { date: ['2026-09-13'] }, { date: '2026-09-13', workerId: 'other' }]) {
        assert.equal(validation.workerShiftsQuery.safeParse(input).success, false);
    }
});

test('saved shifts control assignment in both directions and suppress duplicate previews', async () => {
    const plans = ['removed', 'saved', 'virtual', 'not-due'].map((_id) => ({
        _id, rooms: [_id], date_time: new Date('2026-09-01T09:00:00Z'),
        assigned_workers: [{ worker: 'self', role: 'Normal worker' }],
    }));
    const saved = [
        { cleaning_plan: 'removed', assigned_workers: [{ worker: 'other' }], status: 'upcoming' },
        { cleaning_plan: 'saved', assigned_workers: [{ worker: 'self' }], status: 'cancelled' },
        { cleaning_plan: 'added-by-manager', assigned_workers: [{ worker: 'self' }], status: 'completed' },
    ].map((shift, i) => ({ ...shift, date: day, date_time: new Date(`2026-09-13T${11 + i}:00:00Z`) }));
    const mocks = [
        mock.method(CleaningPlan, 'find', (filter) => {
            assert.deepEqual(filter, { 'assigned_workers.worker': 'self', is_active: true, status: { $ne: 'completed' } });
            return query(plans);
        }),
        mock.method(Shift, 'find', (filter) => {
            assert.deepEqual(filter, { date: day, $or: [
                { 'assigned_workers.worker': 'self' },
                { cleaning_plan: { $in: plans.map((p) => p._id) } },
            ] });
            return query(saved);
        }),
        mock.method(Task, 'find', (filter) => {
            assert.equal(filter.is_active, true);
            const room = filter.room.$in[0];
            assert.ok(['virtual', 'not-due'].includes(room));
            return query([{ frequency_type: 'weekly', days_of_week: room === 'virtual' ? ['sun'] : ['mon'], duration_minutes: 25 }]);
        }),
        mock.method(Shift, 'create', () => { throw new Error('GET must not create shifts'); }),
        mock.method(Shift, 'findByIdAndUpdate', () => { throw new Error('GET must not update shifts'); }),
    ];
    try {
        const result = await services.listWorkerShiftsForDate('self', day);
        assert.deepEqual(result.map((s) => s.cleaning_plan), ['virtual', 'saved', 'added-by-manager']);
        assert.deepEqual(result.map((s) => s.is_virtual), [true, false, false]);
        assert.deepEqual(result.map((s) => s.status), ['upcoming', 'cancelled', 'completed']);
        assert.equal(result[0].duration_minutes, 25);
        assert.equal(result[0].date_time.toISOString(), '2026-09-13T09:00:00.000Z');
    } finally { mocks.forEach((m) => m.mock.restore()); }
});

test('virtual recurrence respects start/end dates and monthly schedules; empty assignments return []', async () => {
    let plans = [];
    const mocks = [
        mock.method(CleaningPlan, 'find', () => query(plans)),
        mock.method(Shift, 'find', () => query([])),
        mock.method(Task, 'find', () => query([{ frequency_type: 'monthly', days_of_month: [13], duration_minutes: 10 }])),
    ];
    try {
        assert.deepEqual(await services.listWorkerShiftsForDate('self', day), []);
        plans = [
            { _id: 'future', date_time: new Date('2026-09-14T09:00:00Z') },
            { _id: 'expired', date_time: new Date('2026-09-01T09:00:00Z'), end_date: new Date('2026-09-12') },
            { _id: 'boundary', date_time: new Date('2026-09-13T09:00:00Z'), end_date: day },
        ].map((p) => ({ ...p, rooms: ['room'], assigned_workers: [{ worker: 'self' }] }));
        assert.deepEqual((await services.listWorkerShiftsForDate('self', day)).map((s) => s.cleaning_plan), ['boundary']);
    } finally { mocks.forEach((m) => m.mock.restore()); }
});

test('worker endpoint uses authenticated profile, validates dates, and enforces worker role', async () => {
    const express = require('express');
    const jwt = require('jsonwebtoken');
    const { Worker } = require('../src/app/modules/worker/worker.model');
    const { Manager } = require('../src/app/modules/manager/manager.model');
    const { shiftRoutes } = require('../src/app/modules/shift/shift.routes');
    let role = 'worker';
    const profile = () => ({ select: () => ({ populate: async () => ({
        _id: 'verified-profile', user: { isVerified: true, isActive: true },
    }) }) });
    const mocks = [
        mock.method(jwt, 'verify', () => ({ id: '507f1f77bcf86cd799439011', profileId: 'stale-profile', role })),
        mock.method(Worker, 'findOne', profile),
        mock.method(Manager, 'findOne', profile),
        mock.method(services, 'listWorkerShiftsForDate', async (worker, date) => {
            assert.equal(worker, 'verified-profile');
            assert.deepEqual(date, day);
            return [];
        }),
    ];
    const app = express();
    app.use('/shift', shiftRoutes);
    app.use((err, req, res, next) => res.status(err.name === 'ZodError' ? 400 : err.statusCode || 500).json({ message: err.message }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/shift/my-shifts`;
    const headers = { authorization: 'Bearer test' };
    try {
        const response = await fetch(base + '?date=2026-09-13', { headers });
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).data, []);
        for (const suffix of ['', '?date=2026-02-30', '?date=2026-09-13&workerId=other']) {
            assert.equal((await fetch(base + suffix, { headers })).status, 400);
        }
        assert.equal((await fetch(base + '?date=2026-09-13')).status, 401);
        role = 'manager';
        assert.equal((await fetch(base + '?date=2026-09-13', { headers })).status, 401);
        assert.equal(mocks[3].mock.callCount(), 1);
    } finally {
        await new Promise((resolve) => server.close(resolve));
        mocks.forEach((m) => m.mock.restore());
    }
});
