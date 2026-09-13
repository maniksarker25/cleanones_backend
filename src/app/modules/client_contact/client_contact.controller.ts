import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import clientContactServices from './client_contact.services';

const createClientContact = catchAsync(async (req, res) => {
    const result = await clientContactServices.createClientContactIntoDB(
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: 'Client contact created successfully',
        data: result,
    });
});

const updateClientContact = catchAsync(async (req, res) => {
    const result = await clientContactServices.updateClientContactIntoDB(
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client contact updated successfully',
        data: result,
    });
});

const deleteClientContact = catchAsync(async (req, res) => {
    const result = await clientContactServices.deleteClientContactFromDB(
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client contact deleted successfully',
        data: result,
    });
});

const getAllClientContacts = catchAsync(async (req, res) => {
    const result = await clientContactServices.getAllClientContactsFromDB();
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client contacts retrieved successfully',
        data: result,
    });
});

const getSingleClientContact = catchAsync(async (req, res) => {
    const result = await clientContactServices.getSingleClientContactFromDB(
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client contact retrieved successfully',
        data: result,
    });
});

export default {
    createClientContact,
    updateClientContact,
    deleteClientContact,
    getAllClientContacts,
    getSingleClientContact,
};
