import httpStatus from 'http-status';
import { isObjectIdOrHexString } from 'mongoose';
import AppError from '../../error/appError';
import { Location } from '../location/location.model';
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

const ensureLocationExists = async (id: string) => {
    const location = await Location.findOne({ _id: id, is_active: true });
    if (!location) {
        throw new AppError(httpStatus.NOT_FOUND, 'Active location not found');
    }
};

const createIssueReportIntoDB = async (payload: unknown, workerId: string) => {
    const body = issueReportBody.parse(payload);
    await ensureLocationExists(body.location);
    return IssueReport.create({ ...body, worker: workerId, status: 'PENDING' });
};

const updateIssueReportIntoDB = async (id: string, payload: unknown) => {
    validateId(id);
    const body = issueReportUpdateBody.parse(payload);
    if (body.location !== undefined) await ensureLocationExists(body.location);
    const result = await IssueReport.findByIdAndUpdate(
        id,
        { $set: body },
        {
            new: true,
            runValidators: true,
        }
    );
    if (!result)
        throw new AppError(httpStatus.NOT_FOUND, 'Issue report not found');
    return result;
};

const deleteIssueReportFromDB = async (id: string) => {
    validateId(id);
    const result = await IssueReport.findByIdAndDelete(id);
    if (!result)
        throw new AppError(httpStatus.NOT_FOUND, 'Issue report not found');
    return result;
};

const getAllIssueReportsFromDB = async () => {
    return IssueReport.find().sort('-createdAt');
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
