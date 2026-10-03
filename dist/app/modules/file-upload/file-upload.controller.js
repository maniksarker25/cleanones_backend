"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = __importDefault(require("../../error/appError"));
const deleteFromS3_1 = require("../../helper/deleteFromS3");
const multer_s3_uploader_1 = require("../../helper/multer-s3-uploader");
const catchasync_1 = __importDefault(require("../../utilities/catchasync"));
const sendResponse_1 = __importDefault(require("../../utilities/sendResponse"));
const chat_services_1 = __importDefault(require("../chat/chat.services"));
const chat_message_model_1 = require("../chat_message/chat_message.model");
const uploadConversationFiles = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    let images = [];
    let videos = [];
    let pdfs = [];
    if ((_a = req.files) === null || _a === void 0 ? void 0 : _a.conversation_image) {
        images = req.files.conversation_image.map((file) => {
            return (0, multer_s3_uploader_1.getCloudFrontUrl)(file.key);
        });
    }
    if ((_b = req.files) === null || _b === void 0 ? void 0 : _b.conversation_video) {
        videos = req.files.conversation_video.map((file) => {
            return (0, multer_s3_uploader_1.getCloudFrontUrl)(file.key);
        });
    }
    if ((_c = req.files) === null || _c === void 0 ? void 0 : _c.conversation_pdf) {
        pdfs = req.files.conversation_pdf.map((file) => {
            return (0, multer_s3_uploader_1.getCloudFrontUrl)(file.key);
        });
    }
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Files uploaded successfully',
        data: {
            images,
            videos,
            pdfs,
        },
    });
}));
const deleteFiles = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const files = Array.isArray(req.body.files) ? req.body.files : [];
    if (!files.length) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'files must be a non-empty array of URLs');
    }
    // Nothing tracks who uploaded a given S3 URL, so without this check any
    // authenticated worker/client could delete ANY object in the bucket just
    // by knowing/guessing its URL. The one place these URLs are actually
    // used is as chat attachments, so ownership is proven the same way chat
    // access is checked everywhere else: the file must currently be attached
    // to a message in a chat this requester can access.
    const messages = yield chat_message_model_1.ChatMessage.find({ 'attachments.url': { $in: files } })
        .select('chat attachments')
        .lean();
    const foundUrls = new Set();
    const chatIds = new Set();
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
        throw new appError_1.default(http_status_1.default.FORBIDDEN, 'One or more files are not deletable: not found as a chat attachment you have access to');
    }
    const profileId = req.user.profileId;
    const role = req.user.role;
    yield Promise.all([...chatIds].map((chatId) => chat_services_1.default.ensureChatAccessOrThrow(chatId, profileId, role)));
    yield Promise.all(files.map((file) => (0, deleteFromS3_1.deleteFileFromS3)(file)));
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Files deleted successfully',
        data: null,
    });
}));
const fileController = {
    uploadConversationFiles,
    deleteFiles,
};
exports.default = fileController;
