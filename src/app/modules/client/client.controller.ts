import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import clientServices from './client.services';

const createClient = catchAsync(async (req, res) => {
    const result = await clientServices.createClientIntoDB(
        req.user.profileId as string,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client created successfully',
        data: result,
    });
});

const updateClient = catchAsync(async (req, res) => {
    const result = await clientServices.updateClientIntoDB(
        req.user.profileId as string,
        req.params.id,
        req.body
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client updated successfully',
        data: result,
    });
});

const deleteClient = catchAsync(async (req, res) => {
    const result = await clientServices.deleteClientFromDB(
        req.user.profileId as string,
        req.params.id
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Client deleted successfully',
        data: result,
    });
});

const getAllClients = catchAsync(async (req, res) => {
    const result = await clientServices.getAllClientsFromDB(req.query);
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Clients retrieved successfully',
        data: result,
    });
});

const clientController = {
    createClient,
    updateClient,
    deleteClient,
    getAllClients,
};

export default clientController;
