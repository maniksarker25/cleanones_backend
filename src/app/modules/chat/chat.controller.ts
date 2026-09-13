import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import chatServices from './chat.services';

const getMyGroups = catchAsync(async (req, res) => {
    const result = await chatServices.getMyGroupsFromDB(
        req.user.profileId as string,
        req.user.role as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Chat groups retrieved successfully',
        data: result,
    });
});

const getMyDirectChats = catchAsync(async (req, res) => {
    const result = await chatServices.getMyDirectChatsFromDB(
        req.user.profileId as string,
        req.user.role as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Direct chats retrieved successfully',
        data: result,
    });
});

const getGroupMembers = catchAsync(async (req, res) => {
    const result = await chatServices.getGroupMembersFromDB(
        req.params.id,
        req.user.profileId as string,
        req.user.role as string
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Chat members retrieved successfully',
        data: result,
    });
});

const renameChatGroup = catchAsync(async (req, res) => {
    const result = await chatServices.renameChatIntoDB(
        req.user.profileId as string,
        req.params.id,
        req.body.name
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Chat group renamed successfully',
        data: result,
    });
});

const chatController = {
    getMyGroups,
    getMyDirectChats,
    getGroupMembers,
    renameChatGroup,
};

export default chatController;
