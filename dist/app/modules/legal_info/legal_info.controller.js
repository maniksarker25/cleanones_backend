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
const http_status_1 = __importDefault(require("http-status"));
const catchasync_1 = __importDefault(require("../../utilities/catchasync"));
const sendResponse_1 = __importDefault(require("../../utilities/sendResponse"));
const legal_info_service_1 = __importDefault(require("./legal_info.service"));
const addOrUpdateLegalInfo = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const legalInfoData = req.body;
    const result = yield legal_info_service_1.default.addOrUpdateLegalInfo(legalInfoData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Legal info updated successfully',
        data: result,
    });
}));
const getLegalInfoByVenueOwnerId = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield legal_info_service_1.default.getLegalInfoByVenueOwnerId();
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Legal info retrieved successfully',
        data: result,
    });
}));
const LegalInfoController = {
    addOrUpdateLegalInfo,
    getLegalInfoByVenueOwnerId,
};
exports.default = LegalInfoController;
