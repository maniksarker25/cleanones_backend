/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import AppError from '../../error/appError';
import { deleteFileFromS3 } from '../../helper/deleteFromS3';
import { getCloudFrontUrl } from '../../helper/multer-s3-uploader';
import catchAsync from '../../utilities/catchasync';
import sendResponse from '../../utilities/sendResponse';
import chatServices from '../chat/chat.services';
import { ChatMessage } from '../chat_message/chat_message.model';

const uploadConversationFiles = catchAsync(async (req, res) => {
    let images: string[] = [];
    let videos: string[] = [];
    let pdfs: string[] = [];
    if (req.files?.conversation_image) {
        images = req.files.conversation_image.map((file: any) => {
            return getCloudFrontUrl(file.key);
        });
    }

    if (req.files?.conversation_video) {
        videos = req.files.conversation_video.map((file: any) => {
            return getCloudFrontUrl(file.key);
        });
    }
    if (req.files?.conversation_pdf) {
        pdfs = req.files.conversation_pdf.map((file: any) => {
            return getCloudFrontUrl(file.key);
        });
    }

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Files uploaded successfully',
        data: {
            images,
            videos,
            pdfs,
        },
    });
});

const deleteFiles = catchAsync(async (req, res) => {
    const files: string[] = Array.isArray(req.body.files) ? req.body.files : [];
    if (!files.length) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            'files must be a non-empty array of URLs'
        );
    }

    // Nothing tracks who uploaded a given S3 URL, so without this check any
    // authenticated worker/client could delete ANY object in the bucket just
    // by knowing/guessing its URL. The one place these URLs are actually
    // used is as chat attachments, so ownership is proven the same way chat
    // access is checked everywhere else: the file must currently be attached
    // to a message in a chat this requester can access.
    const messages = await ChatMessage.find({ 'attachments.url': { $in: files } })
        .select('chat attachments')
        .lean();

    const foundUrls = new Set<string>();
    const chatIds = new Set<string>();
    for (const message of messages) {
        for (const attachment of message.attachments) {
            if (files.includes(attachment.url)) {
                foundUrls.add(attachment.url);
                chatIds.add(message.chat.toString());
            }
        }
    }

    const undeletable = files.filter((file) => !foundUrls.has(file));
    if (undeletable.length) {
        throw new AppError(
            httpStatus.FORBIDDEN,
            'One or more files are not deletable: not found as a chat attachment you have access to'
        );
    }

    const profileId = req.user.profileId as string;
    const role = req.user.role as string;
    await Promise.all(
        [...chatIds].map((chatId) =>
            chatServices.ensureChatAccessOrThrow(chatId, profileId, role)
        )
    );

    await Promise.all(files.map((file) => deleteFileFromS3(file)));
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Files deleted successfully',
        data: null,
    });
});

const fileController = {
    uploadConversationFiles,
    deleteFiles,
};
export default fileController;
