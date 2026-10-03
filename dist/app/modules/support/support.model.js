"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Support = void 0;
const mongoose_1 = require("mongoose");
const support_enum_1 = require("./support.enum");
const supportSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        refPath: 'userModel',
    },
    userModel: {
        type: String,
        required: true,
        enum: ['Customer', 'Provider'],
    },
    contactReason: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: Object.values(support_enum_1.ENUM_SUPPORT_STATUS),
        default: support_enum_1.ENUM_SUPPORT_STATUS.TODO,
    },
}, {
    timestamps: true,
});
exports.Support = (0, mongoose_1.model)('Support', supportSchema);
