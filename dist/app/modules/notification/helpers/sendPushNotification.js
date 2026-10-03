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
            // Android also needs an explicit summary text when
            // grouping, otherwise it just shows the latest message
            // with no "N more" indication.
            android_group_message: { en: 'You have new messages' },
        })), {
            headers: {
                Authorization: `Basic ${process.env.ONESIGNAL_API_KEY}`,
            },
        });
    }
    catch (error) {
        console.error('OneSignal Error:', ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
    }
});
exports.default = sendPushNotification;
