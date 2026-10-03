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
const mongoose_1 = require("mongoose");
const appError_1 = __importDefault(require("../../error/appError"));
const client_model_1 = require("../client/client.model");
const client_contact_model_1 = require("./client_contact.model");
const validateId = (id) => {
    if (!(0, mongoose_1.isObjectIdOrHexString)(id)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid client contact ID');
    }
};
const ensureClientExists = (clientId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(0, mongoose_1.isObjectIdOrHexString)(clientId)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid client ID');
    }
    const client = yield client_model_1.Client.findOne({ _id: clientId, isDeleted: false });
    if (!client) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    }
});
const createClientContactIntoDB = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { client, name, role, phone, email } = payload;
    yield ensureClientExists(client);
    return client_contact_model_1.ClientContact.create({ client, name, role, phone, email });
});
const updateClientContactIntoDB = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    validateId(id);
    const updates = {};
    if (payload.client !== undefined) {
        yield ensureClientExists(payload.client);
        updates.client = payload.client;
    }
    if (payload.name !== undefined)
        updates.name = payload.name;
    if (payload.role !== undefined)
        updates.role = payload.role;
    if (payload.phone !== undefined)
        updates.phone = payload.phone;
    if (payload.email !== undefined)
        updates.email = payload.email;
    const result = yield client_contact_model_1.ClientContact.findByIdAndUpdate(id, { $set: updates }, {
        new: true,
        runValidators: true,
    });
    if (!result) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client contact not found');
    }
    return result;
});
const deleteClientContactFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    validateId(id);
    const result = yield client_contact_model_1.ClientContact.findByIdAndDelete(id);
    if (!result) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client contact not found');
    }
    return result;
});
const getAllClientContactsFromDB = () => __awaiter(void 0, void 0, void 0, function* () {
    return client_contact_model_1.ClientContact.find().sort('-createdAt');
});
const getSingleClientContactFromDB = (id) => __awaiter(void 0, void 0, void 0, function* () {
    validateId(id);
    const result = yield client_contact_model_1.ClientContact.findById(id);
    if (!result) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client contact not found');
    }
    return result;
});
exports.default = {
    createClientContactIntoDB,
    updateClientContactIntoDB,
    deleteClientContactFromDB,
    getAllClientContactsFromDB,
    getSingleClientContactFromDB,
};
