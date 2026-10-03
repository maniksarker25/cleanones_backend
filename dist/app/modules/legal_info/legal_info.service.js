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
Object.defineProperty(exports, "__esModule", { value: true });
const legal_info_model_1 = require("./legal_info.model");
const addOrUpdateLegalInfo = (legalInfoData) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield legal_info_model_1.LegalInfo.findOneAndUpdate({}, { $set: legalInfoData }, {
        new: true,
        upsert: true,
        runValidators: true,
    });
    return result;
});
const getLegalInfoByVenueOwnerId = () => __awaiter(void 0, void 0, void 0, function* () {
    const legalInfo = yield legal_info_model_1.LegalInfo.findOne();
    return legalInfo;
});
const LegalInfoService = {
    addOrUpdateLegalInfo,
    getLegalInfoByVenueOwnerId,
};
exports.default = LegalInfoService;
