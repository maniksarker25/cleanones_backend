require('ts-node/register/transpile-only');
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { Manager } = require('../src/app/modules/manager/manager.model');
const { Worker } = require('../src/app/modules/worker/worker.model');
const services = require('../src/app/modules/worker/worker.services').default;
const validation = require('../src/app/modules/worker/worker.validation').default;
const { workerRoutes } = require('../src/app/modules/worker/worker.routes');

test('worker validation rejects protected fields and unsafe list filters', () => {
    const input = {
        email: 'WORKER@example.com', phone: '123456789',
        worker_type: 'Employee', address: 'Dhaka',
        password: 'secret123', confirmPassword: 'secret123',
    };
    assert.equal(validation.createWorkerBody.parse(input).email, 'worker@example.com');
    assert.equal(validation.createWorkerBody.safeParse({ ...input, role: 'manager' }).success, false);
    assert.equal(validation.createWorkerBody.safeParse({ ...input, confirmPassword: 'wrong' }).success, false);
    for (const body of [{}, { isDeleted: false }, { user: '123' }, { hourly_rate: -1 }]) {
        assert.equal(validation.updateWorkerBody.safeParse(body).success, false);
    }
    for (const query of [{ isDeleted: 'true' }, { page: '-1' }, { limit: '101' }, { $or: [] }]) {
        assert.equal(validation.workerListQuery.safeParse(query).success, false);
    }
});

test('freelancer availability is restricted to the authenticated active freelancer', async () => {
    const update = mock.method(Worker, 'findOneAndUpdate', async (filter, changes) => {
        assert.deepEqual(filter, {
            user: 'self', worker_type: 'Freelancer', isDeleted: { $ne: true },
        });
        assert.deepEqual(changes, { $set: { working_days: ['Monday'] } });
        return { working_days: ['Monday'] };
    });
    try {
        assert.deepEqual(await services.updateMyAvailabilityIntoDB('self', { working_days: ['Monday'] }), { working_days: ['Monday'] });
        await assert.rejects(services.updateMyAvailabilityIntoDB('self', { working_days: [], user: 'other' }));
        update.mock.mockImplementation(async () => null);
        await assert.rejects(services.updateMyAvailabilityIntoDB('self', { working_days: [] }), { statusCode: 403 });
    } finally { update.mock.restore(); }
});

test('managers may set employee days but not freelancer days or bypass with a type change', async () => {
    const mongoose = require('mongoose');
    const session = { withTransaction: async (callback) => callback(), endSession: async () => {} };
    const start = mock.method(mongoose, 'startSession', async () => session);
    let workerType = 'Freelancer';
    const lookup = mock.method(Worker, 'findOne', () => ({
        session: async () => ({ worker_type: workerType }),
    }));
    const update = mock.method(Worker, 'findOneAndUpdate', async () => ({ working_days: ['Monday'] }));
    try {
        const id = '507f1f77bcf86cd799439011';
        await assert.rejects(services.createWorkerIntoDB({
            email: 'freelancer@example.com', phone: '123', address: 'Dhaka',
            password: 'secret123', confirmPassword: 'secret123',
            worker_type: 'Freelancer', working_days: ['Monday'],
        }), { statusCode: 403 });
        await assert.rejects(services.updateWorkerIntoDB(id, { working_days: ['Monday'] }), { statusCode: 403 });
        await assert.rejects(services.updateWorkerIntoDB(id, { worker_type: 'Employee', working_days: ['Monday'] }), { statusCode: 403 });
        workerType = 'Employee';
        await assert.rejects(services.updateWorkerIntoDB(id, { worker_type: 'Freelancer', working_days: ['Monday'] }), { statusCode: 403 });
        await services.updateWorkerIntoDB(id, { working_days: ['Monday'] });
        assert.equal(update.mock.callCount(), 1);
    } finally {
        start.mock.restore();
        lookup.mock.restore();
        update.mock.restore();
    }
});

test('single-worker reads exclude deleted profiles and reject invalid IDs', async () => {
    const find = mock.method(Worker, 'findOne', async (filter) => {
        assert.deepEqual(filter.isDeleted, { $ne: true });
        return null;
    });
    try {
        await assert.rejects(services.getSingleWorkerFromDB('invalid'), { statusCode: 400 });
        assert.equal(find.mock.callCount(), 0);
        await assert.rejects(services.getSingleWorkerFromDB('507f1f77bcf86cd799439011'), { statusCode: 404 });
    } finally { find.mock.restore(); }
});

test('soft delete marks the profile and disables its account in one transaction', async () => {
    const mongoose = require('mongoose');
    const { User } = require('../src/app/modules/user/user.model');
    let ended = false;
    const session = {
        withTransaction: async (callback) => callback(),
        endSession: async () => { ended = true; },
    };
    const start = mock.method(mongoose, 'startSession', async () => session);
    const workerUpdate = mock.method(Worker, 'findOneAndUpdate', async (filter, update, options) => {
        assert.deepEqual(filter.isDeleted, { $ne: true });
        assert.deepEqual(update, { $set: { isDeleted: true } });
        assert.equal(options.session, session);
        return { user: '507f1f77bcf86cd799439012' };
    });
    const userUpdate = mock.method(User, 'findByIdAndUpdate', async (id, update, options) => {
        assert.equal(id, '507f1f77bcf86cd799439012');
        assert.deepEqual(update, { $set: { isDeleted: true, isBlocked: true } });
        assert.equal(options.session, session);
    });
    try {
        assert.equal(await services.deleteWorkerFromDB('507f1f77bcf86cd799439011'), null);
        assert.equal(userUpdate.mock.callCount(), 1);
        assert.equal(ended, true);
    } finally {
        start.mock.restore();
        workerUpdate.mock.restore();
        userUpdate.mock.restore();
    }
});

test('all five worker routes allow managers and reject other roles or missing tokens', async () => {
    let role = 'manager';
    const verify = mock.method(jwt, 'verify', () => ({ id: '507f1f77bcf86cd799439011', role }));
    const profile = mock.method(Manager, 'findOne', () => ({
        select: () => ({
            populate: async () => ({
                _id: '507f1f77bcf86cd799439012',
                user: { isVerified: true, isActive: true, isDeleted: false, isBlocked: false },
            }),
        }),
    }));
    const mocks = Object.keys(services).filter((key) => key !== 'updateMyAvailabilityIntoDB').map((key) => mock.method(services, key, async () => null));
    const app = express();
    app.use(express.json());
    app.use('/worker', workerRoutes);
    app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ message: err.message }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/worker';
    const endpoints = [
        ['POST', '/create-worker', { email: 'worker@example.com', phone: '123', worker_type: 'Employee', address: 'Dhaka', password: 'secret123', confirmPassword: 'secret123' }],
        ['PATCH', '/update-worker/507f1f77bcf86cd799439011', { position: 'Cleaner' }],
        ['DELETE', '/delete-worker/507f1f77bcf86cd799439011'],
        ['GET', '/all-workers'],
        ['GET', '/single-worker/507f1f77bcf86cd799439011'],
    ];
    try {
        for (const [method, path, body] of endpoints) {
            const request = (token) => fetch(base + path, {
                method, headers: { 'content-type': 'application/json', ...(token && { authorization: 'Bearer test' }) },
                ...(body && { body: JSON.stringify(body) }),
            });
            role = 'manager';
            assert.equal((await request(true)).status, 200);
            assert.equal((await request(false)).status, 401);
            // Use the same valid profile stub to isolate the role gate.
            for (role of ['worker', 'client', 'superAdmin']) {
                const model = role === 'worker' ? Worker : role === 'client'
                    ? require('../src/app/modules/client/client.model').Client
                    : require('../src/app/modules/superAdmin/superAdmin.model').default;
                const lookup = mock.method(model, 'findOne', Manager.findOne);
                try { assert.equal((await request(true)).status, 401); }
                finally { lookup.mock.restore(); }
            }
        }
        for (const serviceMock of mocks) assert.equal(serviceMock.mock.callCount(), 1);
    } finally {
        await new Promise((resolve) => server.close(resolve));
        verify.mock.restore();
        profile.mock.restore();
        mocks.forEach((entry) => entry.mock.restore());
    }
});
