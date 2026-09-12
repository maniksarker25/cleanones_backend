import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import MetaService from './meta.service';

const getDashboardMetaData = catchAsync(async (req, res) => {
    const result = await MetaService.getDashboardMetaData();
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Dashboard meta data retrieved successfully',
        data: result,
    });
});

const getCustomerChartData = catchAsync(async (req, res) => {
    const result = await MetaService.getCustomerChartData(
        Number(req?.query.year)
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'User chart data retrieved successfully',
        data: result,
    });
});
const getProviderChartData = catchAsync(async (req, res) => {
    const result = await MetaService.getProviderChartData(
        Number(req?.query.year)
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Provider chart data retrieved successfully',
        data: result,
    });
});
const getEarningChartData = catchAsync(async (req, res) => {
    const result = await MetaService.getEarningChartData(
        Number(req?.query.year)
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Earning chart data retrieved successfully',
        data: result,
    });
});
const getActivities = catchAsync(async (req, res) => {
    const result = await MetaService.getActivities(req?.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Activities retrieved successfully',
        data: result,
    });
});

const MetaController = {
    getDashboardMetaData,
    getCustomerChartData,
    getProviderChartData,
    getEarningChartData,
    getActivities,
};

export default MetaController;
