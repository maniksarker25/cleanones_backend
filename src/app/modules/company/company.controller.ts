import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import companyServices from './company.services';

const createCompany = catchAsync(async (req, res) => {
    const result = await companyServices.createCompanyIntoDB(req.body);
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Company admin created successfully',
        data: result,
    });
});

const getAllCompanies = catchAsync(async (req, res) => {
    const result = await companyServices.getAllCompaniesFromDB(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Companies retrieved successfully',
        data: result,
    });
});

const getSingleCompany = catchAsync(async (req, res) => {
    const result = await companyServices.getSingleCompanyFromDB(req.params.id);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Company retrieved successfully',
        data: result,
    });
});

const updateMyCompany = catchAsync(async (req, res) => {
    const result = await companyServices.updateMyCompanyIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Company updated successfully',
        data: result,
    });
});

export default {
    createCompany,
    getAllCompanies,
    getSingleCompany,
    updateMyCompany,
};
