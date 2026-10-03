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
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = __importDefault(require("../../error/appError"));
const deleteFromS3_1 = require("../../helper/deleteFromS3");
const superAdmin_model_1 = __importDefault(require("./superAdmin.model"));
const updateSuperAdminProfile = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    if (payload.email) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'You can not change the email');
    }
    const user = yield superAdmin_model_1.default.findById(id);
    if (!user) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Profile not found');
    }
    const result = yield superAdmin_model_1.default.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    });
    if (payload.profile_image && user.profile_image) {
        (0, deleteFromS3_1.deleteFileFromS3)(user.profile_image);
    }
    return result;
});
function getDateRange(filter) {
    const now = new Date();
    const end = new Date(now);
    let start;
    switch (filter) {
        case 'today': {
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            break;
        }
        case 'last_week': {
            start = new Date(now);
            start.setDate(now.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            break;
        }
        case 'last_month': {
            start = new Date(now);
            start.setMonth(now.getMonth() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        }
        case 'last_year': {
            start = new Date(now);
            start.setFullYear(now.getFullYear() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        }
        default: {
            // fallback to today
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
        }
    }
    return { start, end };
}
/**
 * Returns the equivalent "previous period" range so we can calculate
 * the percentage change shown in the UI (e.g. "5% Higher Than Yesterday").
 */
function getPreviousDateRange(filter) {
    const now = new Date();
    switch (filter) {
        case 'today': {
            const start = new Date(now);
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setDate(now.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        case 'last_week': {
            const start = new Date(now);
            start.setDate(now.getDate() - 14);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setDate(now.getDate() - 7);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        case 'last_month': {
            const start = new Date(now);
            start.setMonth(now.getMonth() - 2);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setMonth(now.getMonth() - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        case 'last_year': {
            const start = new Date(now);
            start.setFullYear(now.getFullYear() - 2);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setFullYear(now.getFullYear() - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
        default: {
            const start = new Date(now);
            start.setDate(now.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(now);
            end.setDate(now.getDate() - 1);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }
    }
}
// ─── Label helpers ────────────────────────────────────────────────────────────
function getLabelForFilter(filter) {
    const labels = {
        today: 'Today',
        last_week: 'Last Week',
        last_month: 'Last Month',
        last_year: 'Last Year',
    };
    return labels[filter];
}
function getComparedToLabel(filter) {
    const labels = {
        today: 'Yesterday',
        last_week: 'Previous Week',
        last_month: 'Previous Month',
        last_year: 'Previous Year',
    };
    return labels[filter];
}
const SuperAdminServices = {
    updateSuperAdminProfile,
};
exports.default = SuperAdminServices;
