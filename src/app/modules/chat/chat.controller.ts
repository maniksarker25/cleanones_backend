import httpStatus from 'http-status';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import chatServices from './chat.services';

const getMyChats = catchAsync(async (req, res) => {
    const result = await chatServices.getMyChatsFromDB(
        req.user.profileId as string,
        req.user.role as string,
        req.query
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Chats retrieved successfully',
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

const removeGroupMember = catchAsync(async (req, res) => {
    const result = await chatServices.removeGroupMemberFromDB(
        req.user.profileId as string,
        req.params.id,
        req.params.workerId
    );
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Worker removed from chat group successfully',
        data: result,
    });
});

const chatController = {
    getMyChats,
    getGroupMembers,
    renameChatGroup,
    removeGroupMember,
};

export default chatController;
