import httpStatus from 'http-status';
import { isObjectIdOrHexString } from 'mongoose';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import { managerScope } from '../../utilities/managerScope';
import { Location } from '../location/location.model';
import { Worker } from '../worker/worker.model';
import { IssueReport } from './issue_report.model';
import {
    issueReportBody,
    issueReportUpdateBody,
} from './issue_report.validation';

const validateId = (id: string) => {
    if (!isObjectIdOrHexString(id)) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid issue report ID');
    }
};

// Locations are tenant-scoped: a report can only point at a location of the
// same manager the reporting worker belongs to.
const ensureLocationExists = async (id: string, managerId: string) => {
    const location = await Location.findOne({
        _id: id,
        is_active: true,
        ...managerScope(managerId),
    });
    if (!location) {
        throw new AppError(httpStatus.NOT_FOUND, 'Active location not found');
    }
};

const createIssueReportIntoDB = async (payload: unknown, workerId: string) => {
    const body = issueReportBody.parse(payload);
    const worker = await Worker.findOne({ _id: workerId, isDeleted: { $ne: true } })
        .select('manager')
        .lean();
    if (!worker) throw new AppError(httpStatus.NOT_FOUND, 'Worker not found');
    await ensureLocationExists(body.location, worker.manager.toString());
    const result = await IssueReport.create({
        ...body,
        manager: worker.manager,
        worker: workerId,
        status: 'PENDING',
    });

    emitAppEvent('issue_report.created', {
        issueId: result._id.toString(),
        workerId,
        issueType: result.issueType,
        severity: result.severity,
    });

    return result;
};

const updateIssueReportIntoDB = async (
    managerId: string,
    id: string,
    payload: unknown
) => {
    validateId(id);
    const body = issueReportUpdateBody.parse(payload);
    if (body.location !== undefined)
        await ensureLocationExists(body.location, managerId);

    const existing = await IssueReport.findOne({
        _id: id,
        ...managerScope(managerId),
    }).select('status worker');
    if (!existing)
        throw new AppError(httpStatus.NOT_FOUND, 'Issue report not found');
    const statusChanged =
        body.status !== undefined && body.status !== existing.status;

    const result = await IssueReport.findOneAndUpdate(
        { _id: id, ...managerScope(managerId) },
        { $set: body },
        {
            new: true,
            runValidators: true,
        }
    );
    if (!result)
        throw new AppError(httpStatus.NOT_FOUND, 'Issue report not found');

    if (statusChanged) {
        emitAppEvent('issue_report.status_changed', {
            issueId: result._id.toString(),
            workerId: existing.worker.toString(),
            status: result.status,
            resolutionNote: result.resolution_note ?? null,
        });
    }

    return result;
};

const deleteIssueReportFromDB = async (managerId: string, id: string) => {
    validateId(id);
    const result = await IssueReport.findOneAndDelete({
        _id: id,
        ...managerScope(managerId),
    });
    if (!result)
        throw new AppError(httpStatus.NOT_FOUND, 'Issue report not found');
    return result;
};

const getAllIssueReportsFromDB = async (managerId: string) => {
    return IssueReport.find(managerScope(managerId)).sort('-createdAt');
};

const getMyIssueReportsFromDB = async (workerId: string) => {
    return IssueReport.find({ worker: workerId }).sort({ createdAt: -1, _id: -1 });
};

export default {
    getMyIssueReportsFromDB,
    createIssueReportIntoDB,
    updateIssueReportIntoDB,
    deleteIssueReportFromDB,
    getAllIssueReportsFromDB,
};
