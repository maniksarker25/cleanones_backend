"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importDefault(require("mongoose"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const appError_1 = __importDefault(require("../../error/appError"));
const worker_model_1 = require("../worker/worker.model");
const invoice_model_1 = require("./invoice.model");
const ensureWorkerExists = (workerId) => __awaiter(void 0, void 0, void 0, function* () {
    const worker = yield worker_model_1.Worker.findOne({ _id: workerId, isDeleted: false });
    if (!worker) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Worker not found');
    }
    return worker;
});
const createInvoiceIntoDB = (managerId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const worker = yield ensureWorkerExists(payload.worker);
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Conditioned on pending_amount in the filter (not just the read
        // above) so two concurrent invoices for the same worker can't both
        // pass the check and jointly overdraw the pending balance.
        const updatedWorker = yield worker_model_1.Worker.findOneAndUpdate({ _id: payload.worker, pending_amount: { $gte: payload.amount } }, {
            $inc: {
                total_paid: payload.amount,
                pending_amount: -payload.amount,
            },
        }, { new: true, session });
        if (!updatedWorker) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Insufficient pending amount for this worker (pending: ${worker.pending_amount}, requested: ${payload.amount})`);
        }
        const [invoice] = yield invoice_model_1.Invoice.create([Object.assign(Object.assign({}, payload), { manager: managerId })], { session });
        yield session.commitTransaction();
        session.endSession();
        return invoice;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const getAllInvoicesFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const invoiceQuery = new QueryBuilder_1.default(invoice_model_1.Invoice.find()
        .populate({
        path: 'manager',
        populate: { path: 'user', select: 'email phone' },
    })
        .populate('worker', 'name email phone worker_type hourly_rate'), query)
        .search(['payment_method', 'transaction_id', 'notes'])
        .filter()
        .fields()
        .paginate()
        .sort();
    const meta = yield invoiceQuery.countTotal();
    const result = yield invoiceQuery.modelQuery;
    return {
        meta,
        result,
    };
});
const getMyInvoicesFromDB = (workerId, query) => __awaiter(void 0, void 0, void 0, function* () {
    // A worker can never widen their own scope via a `worker` query param.
    const sanitizedQuery = Object.assign({}, query);
    delete sanitizedQuery.worker;
    const invoiceQuery = new QueryBuilder_1.default(invoice_model_1.Invoice.find({ worker: workerId }).populate({
        path: 'manager',
        populate: { path: 'user', select: 'email phone' },
    }), sanitizedQuery)
        .search(['payment_method', 'transaction_id', 'notes'])
        .filter()
        .fields()
        .paginate()
        .sort();
    const meta = yield invoiceQuery.countTotal();
    const result = yield invoiceQuery.modelQuery;
    return {
        meta,
        result,
    };
});
const invoiceServices = {
    createInvoiceIntoDB,
    getAllInvoicesFromDB,
    getMyInvoicesFromDB,
};
exports.default = invoiceServices;
