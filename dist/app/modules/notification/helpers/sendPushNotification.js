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
const axios_1 = __importDefault(require("axios"));
const sendPushNotification = ({ playerIds, message, heading = 'Notification', url, data, collapseId, }) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!(playerIds === null || playerIds === void 0 ? void 0 : playerIds.length))
        return;
    try {
        yield axios_1.default.post('https://onesignal.com/api/v1/notifications', Object.assign({ app_id: process.env.ONESIGNAL_APP_ID, include_player_ids: playerIds, contents: { en: message }, headings: { en: heading }, url,
            data }, (collapseId && {
            collapse_id: collapseId,
            android_group: collapseId,
            // Android needs an explicit summary text when grouping.
            android_group_message: { en: 'You have new messages' },
        })), {
            headers: {
                Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
            },
        });
    }
    catch (error) {
        const responseData = error && typeof error === 'object' && 'response' in error
            ? (_a = error.response) === null || _a === void 0 ? void 0 : _a.data
            : undefined;
        console.error('OneSignal Error:', responseData !== null && responseData !== void 0 ? responseData : (error instanceof Error ? error.message : error));
    }
});
exports.default = sendPushNotification;
