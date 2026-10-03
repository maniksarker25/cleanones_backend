"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Partner = exports.Slider = exports.FAQ = exports.ContactUs = exports.TermsConditions = exports.AboutUs = exports.PrivacyPolicy = void 0;
const mongoose_1 = __importStar(require("mongoose"));
//! Privacy and policy
const privacySchema = new mongoose_1.default.Schema({
    description: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
//! About US
const aboutUsSchema = new mongoose_1.default.Schema({
    description: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
//! Terms Conditions
const termsAndConditionsSchema = new mongoose_1.default.Schema({
    description: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
const partnerSchema = new mongoose_1.default.Schema({
    description: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
//!Contact US
const contactUsSchema = new mongoose_1.default.Schema({
    email: {
        type: String,
        required: true,
    },
    phone_number: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
//!FAQ
const faqSchema = new mongoose_1.default.Schema({
    question: {
        type: String,
        required: true,
    },
    answer: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
//!Slider
const sliderSchema = new mongoose_1.default.Schema({
    title: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
exports.PrivacyPolicy = (0, mongoose_1.model)('PrivacyPolicy', privacySchema);
exports.AboutUs = (0, mongoose_1.model)('AboutUs', aboutUsSchema);
exports.TermsConditions = (0, mongoose_1.model)('TermsConditions', termsAndConditionsSchema);
exports.ContactUs = (0, mongoose_1.model)('ContactUs', contactUsSchema);
exports.FAQ = (0, mongoose_1.model)('FAQ', faqSchema);
exports.Slider = (0, mongoose_1.model)('Slider', sliderSchema);
exports.Partner = (0, mongoose_1.model)('Partner', partnerSchema);
