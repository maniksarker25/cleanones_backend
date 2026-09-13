import httpStatus from 'http-status';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import { Worker } from '../worker/worker.model';
import { TInvoice } from './invoice.interface';
import { Invoice } from './invoice.model';

const ensureWorkerExists = async (workerId: TInvoice['worker']) => {
    const worker = await Worker.findOne({ _id: workerId, isDeleted: false });
    if (!worker) {
        throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
    }
    return worker;
};

const createInvoiceIntoDB = async (
    managerId: string,
    payload: Omit<TInvoice, 'manager'>
) => {
    const worker = await ensureWorkerExists(payload.worker);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Conditioned on pending_amount in the filter (not just the read
        // above) so two concurrent invoices for the same worker can't both
        // pass the check and jointly overdraw the pending balance.
        const updatedWorker = await Worker.findOneAndUpdate(
            { _id: payload.worker, pending_amount: { $gte: payload.amount } },
            {
                $inc: {
                    total_paid: payload.amount,
                    pending_amount: -payload.amount,
                },
            },
            { new: true, session }
        );
        if (!updatedWorker) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                `Insufficient pending amount for this worker (pending: ${worker.pending_amount}, requested: ${payload.amount})`
            );
        }

        const [invoice] = await Invoice.create(
            [{ ...payload, manager: managerId }],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return invoice;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const getAllInvoicesFromDB = async (query: Record<string, unknown>) => {
    const invoiceQuery = new QueryBuilder(
        Invoice.find()
            .populate({
                path: 'manager',
                populate: { path: 'user', select: 'email phone' },
            })
            .populate('worker', 'name email phone worker_type hourly_rate'),
        query
    )
        .search(['payment_method', 'transaction_id', 'notes'])
        .filter()
        .fields()
        .paginate()
        .sort();

    const meta = await invoiceQuery.countTotal();
    const result = await invoiceQuery.modelQuery;

    return {
        meta,
        result,
    };
};

const getMyInvoicesFromDB = async (
    workerId: string,
    query: Record<string, unknown>
) => {
    // A worker can never widen their own scope via a `worker` query param.
    const sanitizedQuery = { ...query };
    delete sanitizedQuery.worker;

    const invoiceQuery = new QueryBuilder(
        Invoice.find({ worker: workerId }).populate({
            path: 'manager',
            populate: { path: 'user', select: 'email phone' },
        }),
        sanitizedQuery
    )
        .search(['payment_method', 'transaction_id', 'notes'])
        .filter()
        .fields()
        .paginate()
        .sort();

    const meta = await invoiceQuery.countTotal();
    const result = await invoiceQuery.modelQuery;

    return {
        meta,
        result,
    };
};

const invoiceServices = {
    createInvoiceIntoDB,
    getAllInvoicesFromDB,
    getMyInvoicesFromDB,
};

export default invoiceServices;
