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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageService = void 0;
const appError_1 = __importDefault(require("../../error/appError"));
const manage_model_1 = require("./manage.model");
//! Privacy and policy
const addPrivacyPolicy = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const checkIsExist = yield manage_model_1.PrivacyPolicy.findOne();
    if (checkIsExist) {
        yield manage_model_1.PrivacyPolicy.findOneAndUpdate({}, payload, {
            new: true,
            runValidators: true,
        });
    }
    else {
        return yield manage_model_1.PrivacyPolicy.create(payload);
    }
});
const getPrivacyPolicy = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield manage_model_1.PrivacyPolicy.findOne();
});
const editPrivacyPolicy = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.PrivacyPolicy.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'Privacy Policy not found');
    }
    const result = yield manage_model_1.PrivacyPolicy.findOneAndUpdate({ _id: id }, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
const deletePrivacyPolicy = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.PrivacyPolicy.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'Privacy Policy not found');
    }
    return yield manage_model_1.PrivacyPolicy.findByIdAndDelete(id);
});
//! Partner
const addPartner = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const checkIsExist = yield manage_model_1.Partner.findOne();
    if (checkIsExist) {
        yield manage_model_1.Partner.findOneAndUpdate({}, payload, {
            new: true,
            runValidators: true,
        });
    }
    else {
        return yield manage_model_1.Partner.create(payload);
    }
});
const getPartner = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield manage_model_1.Partner.findOne();
});
const editPartner = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.Partner.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'Partner not found');
    }
    const result = yield manage_model_1.Partner.findOneAndUpdate({ _id: id }, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
const deletePartner = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.Partner.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'Partner not found');
    }
    return yield manage_model_1.Partner.findByIdAndDelete(id);
});
//! About us
const addAboutUs = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const checkIsExist = yield manage_model_1.AboutUs.findOne();
    if (checkIsExist) {
        yield manage_model_1.AboutUs.findOneAndUpdate({}, payload, {
            new: true,
            runValidators: true,
        });
    }
    else {
        return yield manage_model_1.AboutUs.create(payload);
    }
});
const getAboutUs = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield manage_model_1.AboutUs.findOne();
});
const editAboutUs = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.AboutUs.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'AboutUs not found');
    }
    const result = yield manage_model_1.AboutUs.findOneAndUpdate({ _id: id }, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
const deleteAboutUs = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.AboutUs.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'AboutUs not found');
    }
    return yield manage_model_1.AboutUs.findByIdAndDelete(id);
});
//! Terms Conditions
const addTermsConditions = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const checkIsExist = yield manage_model_1.TermsConditions.findOne();
    if (checkIsExist) {
        yield manage_model_1.TermsConditions.findOneAndUpdate({}, payload, {
            new: true,
            runValidators: true,
        });
    }
    else {
        return yield manage_model_1.TermsConditions.create(payload);
    }
});
const getTermsConditions = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield manage_model_1.TermsConditions.findOne();
});
const editTermsConditions = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.TermsConditions.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'TermsConditions not found');
    }
    const result = yield manage_model_1.TermsConditions.findOneAndUpdate({ _id: id }, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
const deleteTermsConditions = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.TermsConditions.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'TermsConditions not found');
    }
    return yield manage_model_1.TermsConditions.findByIdAndDelete(id);
});
//! Contact Us
const addContactUs = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    return yield manage_model_1.ContactUs.create(payload);
});
const getContactUs = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield manage_model_1.ContactUs.findOne();
});
const editContactUs = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.ContactUs.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'ContactUs not found');
    }
    const result = yield manage_model_1.ContactUs.findOneAndUpdate({ _id: id }, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
const deleteContactUs = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.ContactUs.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'ContactUs not found');
    }
    return yield manage_model_1.ContactUs.findByIdAndDelete(id);
});
//! FAQ
const addFAQ = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    return yield manage_model_1.FAQ.create(payload);
});
const getFAQ = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield manage_model_1.FAQ.find({}).sort('-createdAt');
});
const editFAQ = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.FAQ.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'Faq not found');
    }
    const result = yield manage_model_1.FAQ.findOneAndUpdate({ _id: id }, payload, {
        new: true,
        runValidators: true,
    });
    return result;
});
const deleteFAQ = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.FAQ.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'Faq not found');
    }
    return yield manage_model_1.FAQ.findByIdAndDelete(id);
});
//! Slider
const addSlider = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const { files, body } = req;
    let image = undefined;
    //@ts-ignore
    if (files && files.image) {
        //@ts-ignore
        image = `/images/image/${files.image[0].filename}`;
    }
    const result = yield manage_model_1.Slider.create(Object.assign({ image }, body));
    return result;
});
const getSlider = () => __awaiter(void 0, void 0, void 0, function* () {
    return yield manage_model_1.Slider.find({}).sort('-createdAt');
});
const editSlider = (req) => __awaiter(void 0, void 0, void 0, function* () {
    const { files, body } = req;
    const { id } = req.params;
    let image = undefined;
    //@ts-ignore
    if (files && files.image) {
        //@ts-ignore
        image = `/images/image/${files.image[0].filename}`;
    }
    const isExist = yield manage_model_1.Slider.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'Slider program not found');
    }
    const updateData = __rest(body, []);
    // console.log(updateData);
    const result = yield manage_model_1.Slider.findOneAndUpdate({ _id: id }, Object.assign({ image }, updateData), {
        new: true,
        runValidators: true,
    });
    return result;
});
const deleteSlider = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const isExist = yield manage_model_1.Slider.findById(id);
    if (!isExist) {
        throw new appError_1.default(404, 'Slider not found');
    }
    return yield manage_model_1.Slider.findByIdAndDelete(id);
});
exports.ManageService = {
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
    editFAQ,
    deleteFAQ,
    addSlider,
    getSlider,
    deleteSlider,
    editSlider,
    addPartner,
    editPartner,
    getPartner,
    deletePartner,
};
