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
exports.filterEligibleWorkers = exports.assertWorkersEligible = exports.activeWorkerFilter = void 0;
const http_status_1 = __importDefault(require("http-status"));
const appError_1 = __importDefault(require("../../error/appError"));
const user_model_1 = require("../user/user.model");
const worker_model_1 = require("../worker/worker.model");
exports.activeWorkerFilter = { isDeleted: { $ne: true } };
const activeUserIdSetFor = (userIds) => __awaiter(void 0, void 0, void 0, function* () {
    const activeUsers = yield user_model_1.User.find({
        _id: { $in: userIds },
        isDeleted: { $ne: true },
        isBlocked: { $ne: true },
        isActive: true,
    })
        .select('_id')
        .lean();
    return new Set(activeUsers.map((u) => u._id.toString()));
});
/**
 * Hard eligibility check: not deleted (Worker profile) and the linked User
 * account is not deleted/blocked/inactive. This is never overridable by
 * `force` — it's a data-integrity fact, not a schedulable judgment call.
 * Throws 400 naming exactly which worker IDs failed and why.
 */
const assertWorkersEligible = (workerIds) => __awaiter(void 0, void 0, void 0, function* () {
    const workers = yield worker_model_1.Worker.find(Object.assign({ _id: { $in: workerIds } }, exports.activeWorkerFilter))
        .select('_id user')
        .lean();
    const foundIds = new Set(workers.map((w) => w._id.toString()));
    const missing = workerIds.filter((id) => !foundIds.has(id.toString()));
    if (missing.length) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Worker(s) not found or deleted: ${missing.join(', ')}`);
    }
    const activeUserIds = yield activeUserIdSetFor(workers.map((w) => w.user));
    const inactiveWorkers = workers.filter((w) => !activeUserIds.has(w.user.toString()));
    if (inactiveWorkers.length) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Worker(s) account is blocked/inactive: ${inactiveWorkers
            .map((w) => w._id)
            .join(', ')}`);
    }
    return workers;
});
exports.assertWorkersEligible = assertWorkersEligible;
/** Filters a list of Worker documents down to those with an active linked User. */
const filterEligibleWorkers = (workers) => __awaiter(void 0, void 0, void 0, function* () {
    const activeUserIds = yield activeUserIdSetFor(workers.map((w) => w.user));
    return workers.filter((w) => activeUserIds.has(w.user.toString()));
});
exports.filterEligibleWorkers = filterEligibleWorkers;
