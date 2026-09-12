/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import { getCloudFrontUrl } from '../../helper/multer-s3-uploader';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import reportServices from './report.service';

const createReport = catchAsync(async (req, res) => {
    if (req.files?.report_evidence) {
        req.body.evidence = req.files.report_evidence.map((file: any) => {
            return getCloudFrontUrl(file.key);
        });
    }
    const result = await reportServices.createReportForTask(req.user, req.body);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Report submitted successfully',
        data: result,
    });
});
const getAll = catchAsync(async (req, res) => {
    const result = await reportServices.getAllReport(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Report retrieved successfully',
        data: result,
    });
});
const getSingle = catchAsync(async (req, res) => {
    const result = await reportServices.getSingleReportFromDB(req.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Report retrieved successfully',
        data: result,
    });
});
const markAsResolved = catchAsync(async (req, res) => {
    const result = await reportServices.resolveTask(
        req.params.id,
        req.body.isRefund,
        req?.body?.resolutionNote || ''
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Report resolved successfully',
        data: result,
    });
});

const ReportController = { createReport, getAll, getSingle, markAsResolved };
export default ReportController;
