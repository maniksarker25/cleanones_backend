"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
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
exports.sendSMS = void 0;
// export default sendSMS;
// @ts-ignore
const mocean_sdk_1 = __importDefault(require("mocean-sdk"));
const mocean = new mocean_sdk_1.default.Mocean(new mocean_sdk_1.default.Client({
    apiToken: process.env.MOCEAN_API_TOKEN,
}));
const sendSMS = (phoneNumber, smsMessage) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield mocean.sms().send({
            'mocean-from': 'TASKALLEY',
            'mocean-to': phoneNumber,
            'mocean-text': smsMessage,
        });
        return response;
    }
    catch (error) {
        console.error('Failed to send SMS:', error.message || error);
        throw new Error('Failed to send SMS');
    }
});
exports.sendSMS = sendSMS;
