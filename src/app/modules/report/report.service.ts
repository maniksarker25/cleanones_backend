/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { JwtPayload } from 'jsonwebtoken';
import { PipelineStage, Types } from 'mongoose';
import AppError from '../../error/appError';
import { appEventEmitter } from '../../events/eventEmitter';
import { deleteFileFromS3 } from '../../helper/deleteFromS3';
import { ENUM_PAYMENT_STATUS } from '../../utilities/enum';
import stripe from '../../utilities/stripe';
import { ENUM_TASK_STATUS } from '../task/task.enum';
import TaskModel from '../task/task.model';
import { USER_ROLE } from '../user/user.constant';
import { ENUM_REPORT_ROLE } from './report.enum';
import { IReport } from './report.interface';
import Report from './report.model';

const createReportForTask = async (userData: JwtPayload, payload: IReport) => {
    if (!payload?.evidence?.length || payload?.evidence?.length == 0) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Evidence is required');
    }
    const task = await TaskModel.findById(payload.task).select(
        '_id status worker client'
    );
    if (!task) {
        payload.evidence.forEach((evd) => {
            deleteFileFromS3(evd);
        });
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found');
    }

    if (
        task.worker != userData.profileId &&
        task.client != userData.profileId
    ) {
        payload.evidence.forEach((evd) => {
            deleteFileFromS3(evd);
        });
        throw new AppError(httpStatus.BAD_REQUEST, 'This is not your task');
    } else if (
        task.status == ENUM_TASK_STATUS.COMPLETED ||
        task.status == ENUM_TASK_STATUS.CANCELLED
    ) {
        payload.evidence.forEach((evd) => {
            deleteFileFromS3(evd);
        });
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `This task already ${task.status} , you are not able to send report now`
        );
    }

    const reportByRole =
        userData.role == USER_ROLE.client ? 'Client' : 'Worker';

    const result = await Report.create({
        ...payload,
        reportBy: userData.profileId,
        reportByRole: reportByRole,
    });
    appEventEmitter.emit('report.created', {
        reportId: result._id.toString(),
        taskId: payload.task.toString(),
        reportTo: payload.reportTo.toString(),
        reportByRole: reportByRole,
    });
    return result;
};

const getAllReport = async (query: Record<string, unknown>) => {
    const pipeline: PipelineStage[] = [];

    // ─── Match Stage ───────────────────────────────────────────────
    const matchStage: Record<string, unknown> = {};

    if (query.reportByRole) {
        matchStage.reportByRole = query.reportByRole;
    }

    if (query.reportToRole) {
        matchStage.reportToRole = query.reportToRole;
    }

    if (query.isResolved !== undefined) {
        matchStage.isResolved = query.isResolved === 'true';
    }

    if (query.task) {
        matchStage.task = new Types.ObjectId(query.task as string);
    }

    if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
    }

    // ─── Lookup Stages ─────────────────────────────────────────────
    pipeline.push(
        {
            $lookup: {
                from: 'customers',
                let: { id: '$reportBy', role: '$reportByRole' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            '$$role',
                                            ENUM_REPORT_ROLE.CLIENT,
                                        ],
                                    },
                                    { $eq: ['$_id', '$$id'] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            profile_image: 1,
                        },
                    },
                ],
                as: 'reportByCustomer',
            },
        },
        {
            $lookup: {
                from: 'providers',
                let: { id: '$reportBy', role: '$reportByRole' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            '$$role',
                                            ENUM_REPORT_ROLE.WORKER,
                                        ],
                                    },
                                    { $eq: ['$_id', '$$id'] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            profile_image: 1,
                        },
                    },
                ],
                as: 'reportByProvider',
            },
        },
        {
            $lookup: {
                from: 'customers',
                let: { id: '$reportTo', role: '$reportToRole' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            '$$role',
                                            ENUM_REPORT_ROLE.CLIENT,
                                        ],
                                    },
                                    { $eq: ['$_id', '$$id'] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            profile_image: 1,
                        },
                    },
                ],
                as: 'reportToCustomer',
            },
        },
        {
            $lookup: {
                from: 'providers',
                let: { id: '$reportTo', role: '$reportToRole' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            '$$role',
                                            ENUM_REPORT_ROLE.WORKER,
                                        ],
                                    },
                                    { $eq: ['$_id', '$$id'] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            profile_image: 1,
                        },
                    },
                ],
                as: 'reportToProvider',
            },
        },
        {
            $lookup: {
                from: 'tasks',
                localField: 'task',
                foreignField: '_id',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            status: 1,
                            serviceType: 1,
                        },
                    },
                ],
                as: 'task',
            },
        }
    );

    // ─── Reshape reportBy / reportTo ───────────────────────────────
    pipeline.push({
        $addFields: {
            reportBy: {
                $mergeObjects: [
                    { $arrayElemAt: ['$reportByCustomer', 0] },
                    { $arrayElemAt: ['$reportByProvider', 0] },
                ],
            },
            reportTo: {
                $mergeObjects: [
                    { $arrayElemAt: ['$reportToCustomer', 0] },
                    { $arrayElemAt: ['$reportToProvider', 0] },
                ],
            },
            task: { $arrayElemAt: ['$task', 0] },
        },
    });

    pipeline.push({
        $project: {
            reportByCustomer: 0,
            reportByProvider: 0,
            reportToCustomer: 0,
            reportToProvider: 0,
        },
    });

    // ─── searchTerm ────────────────────────────────────────────────────
    if (query.searchTerm) {
        pipeline.push({
            $match: {
                $or: [
                    {
                        'reportBy.name': {
                            $regex: query.searchTerm,
                            $options: 'i',
                        },
                    },
                    {
                        'reportBy.email': {
                            $regex: query.searchTerm,
                            $options: 'i',
                        },
                    },
                    {
                        'reportTo.name': {
                            $regex: query.searchTerm,
                            $options: 'i',
                        },
                    },
                    {
                        'reportTo.email': {
                            $regex: query.searchTerm,
                            $options: 'i',
                        },
                    },
                    { reason: { $regex: query.searchTerm, $options: 'i' } },
                ],
            },
        });
    }

    // ─── Sort ──────────────────────────────────────────────────────
    const sortField = (query.sortBy as string) ?? 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortOrder } });

    // ─── Pagination via $facet ─────────────────────────────────────
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.min(
        100,
        Math.max(1, parseInt(query.limit as string) || 10)
    );
    const skip = (page - 1) * limit;

    pipeline.push({
        $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            meta: [{ $count: 'total' }],
        },
    });

    const [result] = await Report.aggregate(pipeline);

    const total = result.meta[0]?.total ?? 0;

    return {
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        data: result.data,
    };
};

const getSingleReportFromDB = async (id: string) => {
    const pipeline: PipelineStage[] = [];

    // ─── Match Stage ───────────────────────────────────────────────
    pipeline.push({
        $match: {
            _id: new Types.ObjectId(id),
        },
    });

    // ─── Lookup Stages ─────────────────────────────────────────────
    pipeline.push(
        {
            $lookup: {
                from: 'customers',
                let: { id: '$reportBy', role: '$reportByRole' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            '$$role',
                                            ENUM_REPORT_ROLE.CLIENT,
                                        ],
                                    },
                                    { $eq: ['$_id', '$$id'] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            profile_image: 1,
                        },
                    },
                ],
                as: 'reportByCustomer',
            },
        },
        {
            $lookup: {
                from: 'providers',
                let: { id: '$reportBy', role: '$reportByRole' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            '$$role',
                                            ENUM_REPORT_ROLE.WORKER,
                                        ],
                                    },
                                    { $eq: ['$_id', '$$id'] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            profile_image: 1,
                        },
                    },
                ],
                as: 'reportByProvider',
            },
        },
        {
            $lookup: {
                from: 'customers',
                let: { id: '$reportTo', role: '$reportToRole' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            '$$role',
                                            ENUM_REPORT_ROLE.CLIENT,
                                        ],
                                    },
                                    { $eq: ['$_id', '$$id'] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            profile_image: 1,
                        },
                    },
                ],
                as: 'reportToCustomer',
            },
        },
        {
            $lookup: {
                from: 'providers',
                let: { id: '$reportTo', role: '$reportToRole' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    {
                                        $eq: [
                                            '$$role',
                                            ENUM_REPORT_ROLE.WORKER,
                                        ],
                                    },
                                    { $eq: ['$_id', '$$id'] },
                                ],
                            },
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            email: 1,
                            profile_image: 1,
                        },
                    },
                ],
                as: 'reportToProvider',
            },
        },
        {
            $lookup: {
                from: 'tasks',
                localField: 'task',
                foreignField: '_id',
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            serviceType: 1,
                            budget: 1,
                            taskStartDateTime: 1,

                            status: 1,

                            location: 1,
                            address: 1,

                            description: 1,

                            task_attachments: 1,

                            totalBids: 1,

                            distance: 1,
                            beforeImages: 1,
                            afterImages: 1,

                            createdAt: 1,
                            updatedAt: 1,
                            paymentStatus: 1,
                        },
                    },
                ],
                as: 'task',
            },
        }
    );

    // ─── Reshape reportBy / reportTo ───────────────────────────────
    pipeline.push({
        $addFields: {
            reportBy: {
                $mergeObjects: [
                    { $arrayElemAt: ['$reportByCustomer', 0] },
                    { $arrayElemAt: ['$reportByProvider', 0] },
                ],
            },
            reportTo: {
                $mergeObjects: [
                    { $arrayElemAt: ['$reportToCustomer', 0] },
                    { $arrayElemAt: ['$reportToProvider', 0] },
                ],
            },
            task: { $arrayElemAt: ['$task', 0] },
        },
    });

    pipeline.push({
        $project: {
            reportByCustomer: 0,
            reportByProvider: 0,
            reportToCustomer: 0,
            reportToProvider: 0,
        },
    });

    const result = await Report.aggregate(pipeline);

    return result[0] || null;
};

const resolveTask = async (
    id: string,
    isRefund: boolean,
    resolutionNote?: string
) => {
    const report: any = await Report.findById(id).populate({
        path: 'task',
        populate: [
            {
                path: 'client',
                select: '_id name stripeCustomerId',
            },
            {
                path: 'worker',
                select: '_id name stripeAccountId',
            },
        ],
    });

    if (!report) {
        throw new AppError(httpStatus.NOT_FOUND, 'Report not found');
    }
    if (report.isResolved) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'This report already resolved'
        );
    }

    const task = report.task;

    if (!task) {
        throw new AppError(httpStatus.NOT_FOUND, 'Task not found');
    }

    if (task.paymentStatus !== ENUM_PAYMENT_STATUS.PAID) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Task already processed');
    }

    if (!task.transactionId) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Payment intent not found');
    }

    if (isRefund) {
        await stripe.refunds.create({
            payment_intent: task.transactionId,
            metadata: {
                taskId: task._id?.toString() || '',
                refunded_by: 'admin_user',
                reason_note: `${report.reportBy} requested cancellation`,
            },
        });

        const updateTask = await TaskModel.findByIdAndUpdate(
            task._id,
            {
                cancelledAt: new Date(),
                status: ENUM_TASK_STATUS.CANCELLED,
                paymentStatus: ENUM_PAYMENT_STATUS.REFUNDED,
            },
            { new: true }
        );

        if (!updateTask) {
            throw new AppError(
                httpStatus.FAILED_DEPENDENCY,
                'Failed to update task data'
            );
        }

        const result = await Report.findByIdAndUpdate(id, {
            isResolved: true,
            isRefunded: true,
            resolutionNote,
            finalNote:
                'Client has been refunded and the worker has been notified.',
        });
        appEventEmitter.emit('report.resolved.refunded', {
            reportId: id,
            taskId: task._id.toString(),
            client: task.client._id.toString(),
            worker: task.worker._id.toString(),
            resolutionNote,
        });

        return result;
    }

    if (!task.worker?.stripeAccountId) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'Worker stripe account not found'
        );
    }

    await stripe.transfers.create({
        amount: Math.round(task.providerEarningAmount * 100),
        currency: 'usd',
        destination: task.worker.stripeAccountId,
        metadata: {
            taskId: task._id.toString(),
        },
    });

    const updateTask = await TaskModel.findByIdAndUpdate(
        task._id,
        {
            markAsCompleteByAdminAt: new Date(),
            status: ENUM_TASK_STATUS.COMPLETED,
            paymentStatus: ENUM_PAYMENT_STATUS.PAID,
        },
        { new: true }
    );

    if (!updateTask) {
        throw new AppError(
            httpStatus.FAILED_DEPENDENCY,
            'Failed to update task data'
        );
    }

    const result = await Report.findByIdAndUpdate(id, {
        isResolved: true,
        isRefunded: false,
        resolutionNote,
    });
    appEventEmitter.emit('report.resolved.paid', {
        reportId: id,
        taskId: task._id.toString(),
        client: task.client._id.toString(),
        worker: task.worker._id.toString(),
        resolutionNote,
        finalNote:
            'Payment has been released to the worker and the client has been notified.',
    });
    return result;
};

const ReportServices = {
    createReportForTask,
    getAllReport,
    getSingleReportFromDB,
    resolveTask,
};
export default ReportServices;
