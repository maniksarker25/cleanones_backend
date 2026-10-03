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
exports.ManageController = void 0;
const manage_service_1 = require("./manage.service");
const catchasync_1 = __importDefault(require("../../utilities/catchasync"));
const sendResponse_1 = __importDefault(require("../../utilities/sendResponse"));
const addAboutUs = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.addAboutUs(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'About us create successfully',
        data: result,
    });
}));
const addPrivacyPolicy = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.addPrivacyPolicy(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Privacy Policy added successfully ',
        data: result,
    });
}));
const addPartner = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.addPartner(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Partner added successfully ',
        data: result,
    });
}));
const addTermsConditions = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.addTermsConditions(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Terms and condition added successfully',
        data: result,
    });
}));
const addContactUs = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.addContactUs(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Contact Us added successfully',
        data: result,
    });
}));
const addFAQ = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.addFAQ(req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'FAQ added successfully',
        data: result,
    });
}));
const getPrivacyPolicy = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.getPrivacyPolicy();
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Privacy Policy retrieved successfully',
        data: result,
    });
}));
const getPartner = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.getPartner();
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Partner retrieved successfully',
        data: result,
    });
}));
const getAboutUs = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.getAboutUs();
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'About Us retrieved successfully',
        data: result,
    });
}));
const getTermsConditions = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.getTermsConditions();
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Terms and Condition retrieved successfully',
        data: result,
    });
}));
const getContactUs = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.getContactUs();
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Contact Us retrieved successfully',
        data: result,
    });
}));
const getFAQ = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.getFAQ();
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'FAQ retrieved successfully',
        data: result,
    });
}));
const editPrivacyPolicy = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.editPrivacyPolicy(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Privacy policy updated successfully',
        data: result,
    });
}));
const editPartner = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.editPartner(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Partner updated successfully',
        data: result,
    });
}));
const editAboutUs = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.editAboutUs(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'About Us updated successfully',
        data: result,
    });
}));
const editTermsConditions = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.editTermsConditions(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Terms and Condition updated successfully',
        data: result,
    });
}));
const editContactUs = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.editContactUs(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Contact Us updated successfully',
        data: result,
    });
}));
const editFAQ = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.editFAQ(req.params.id, req.body);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'FAQ updated successfully',
        data: result,
    });
}));
const deleteAboutUs = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.deleteAboutUs(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'About us deleted successfully',
        data: result,
    });
}));
const deleteContactUs = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.deleteContactUs(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Contact Us deleted successfully',
        data: result,
    });
}));
const deletePrivacyPolicy = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.deletePrivacyPolicy(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Privacy Policy deleted successfully',
        data: result,
    });
}));
const deletePartner = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.deletePartner(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Partner deleted successfully',
        data: result,
    });
}));
const deleteFAQ = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.deleteFAQ(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'FAQ deleted successfully',
        data: result,
    });
}));
const deleteSlider = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.deleteSlider(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Slider Deleted Successfully',
        data: result,
    });
}));
const deleteTermsConditions = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.deleteTermsConditions(req.params.id);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Terms and Condition deleted successfully',
        data: result,
    });
}));
const addSlider = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.addSlider(req);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Slider added successfully',
        data: result,
    });
}));
const editSlider = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.editSlider(req);
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Slider updated successfully',
        data: result,
    });
}));
const getSlider = (0, catchasync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield manage_service_1.ManageService.getSlider();
    (0, sendResponse_1.default)(res, {
        statusCode: 200,
        success: true,
        message: 'Slider retrieved successfully',
        data: result,
    });
}));
exports.ManageController = {
    addSlider,
    getSlider,
    deleteSlider,
    editSlider,
    addPrivacyPolicy,
    addAboutUs,
    addTermsConditions,
    addContactUs,
    getPrivacyPolicy,
    getAboutUs,
    getTermsConditions,
    getContactUs,
    editPrivacyPolicy,
    editAboutUs,
    editTermsConditions,
    editContactUs,
    deleteAboutUs,
    deleteContactUs,
    deletePrivacyPolicy,
    deleteTermsConditions,
    addFAQ,
    getFAQ,
    deleteFAQ,
    editFAQ,
    addPartner,
    getPartner,
    editPartner,
    deletePartner
};
