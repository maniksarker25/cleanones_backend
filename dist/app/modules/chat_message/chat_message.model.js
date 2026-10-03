"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessage = void 0;
const mongoose_1 = require("mongoose");
const chat_message_interface_1 = require("./chat_message.interface");
const attachmentSchema = new mongoose_1.Schema({
    url: { type: String, required: true },
    type: { type: String, enum: chat_message_interface_1.ATTACHMENT_TYPES, required: true },
}, { _id: false });
const chatMessageSchema = new mongoose_1.Schema({
    chat: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Chat',
        required: true,
        index: true,
    },
    sender: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    sender_role: {
        type: String,
        enum: chat_message_interface_1.CHAT_MESSAGE_SENDER_ROLES,
        required: true,
    },
    text: {
        type: String,
        default: '',
    },
    attachments: {
        type: [attachmentSchema],
        default: [],
    },
    seen: {
        type: Boolean,
        default: false,
    },
    is_deleted: {
        type: Boolean,
        default: false,
    },
    deleted_at: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
    versionKey: false,
});
chatMessageSchema.index({ chat: 1, createdAt: -1 });
exports.ChatMessage = (0, mongoose_1.model)('ChatMessage', chatMessageSchema);
