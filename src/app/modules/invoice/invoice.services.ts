import httpStatus from 'http-status';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import { roundToTwoDecimals } from '../shift/shift.shared.util';
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
    await ensureWorkerExists(payload.worker);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Optimistic concurrency: the update only applies if the worker's pending
        // balance and unpaid hours are still what we read, so a concurrent invoice or
        // check-out can't make us overdraw pending or settle the wrong share of hours.
        let paidHours = 0;
        let applied = false;
        for (let attempt = 0; attempt < 3 && !applied; attempt++) {
            const current = await Worker.findOne({
                _id: payload.worker,
                isDeleted: false,
            }).session(session);
            if (!current) {
                throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
            }
            if (current.pending_amount < payload.amount) {
                throw new AppError(
                    httpStatus.BAD_REQUEST,
                    `Insufficient pending amount for this worker (pending: ${current.pending_amount}, requested: ${payload.amount})`
                );
            }
            // Paying off the whole balance clears all unpaid hours exactly; otherwise
            // hours are settled in proportion to the share of pending money paid.
            const unpaidHours = current.total_unpaid_hours ?? 0;
            const settlesAll =
                Math.abs(current.pending_amount - payload.amount) < 0.005;
            paidHours = settlesAll
                ? unpaidHours
                : roundToTwoDecimals(
                      unpaidHours * (payload.amount / current.pending_amount)
                  );
            const updated = await Worker.findOneAndUpdate(
                {
                    _id: payload.worker,
                    pending_amount: current.pending_amount,
                    total_unpaid_hours: unpaidHours,
                },
                {
                    $inc: {
                        total_paid: payload.amount,
                        pending_amount: -payload.amount,
                    },
                    $set: {
                        total_paid_hours: roundToTwoDecimals(
                            (current.total_paid_hours ?? 0) + paidHours
                        ),
                        total_unpaid_hours: roundToTwoDecimals(
                            unpaidHours - paidHours
                        ),
                    },
                },
                { new: true, session }
            );
            applied = !!updated;
        }
        if (!applied) {
            throw new AppError(
                httpStatus.CONFLICT,
                'Worker balance changed while recording the payment, please retry'
            );
        }

        const [invoice] = await Invoice.create(
            [{ ...payload, manager: managerId, hours: paidHours }],
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
