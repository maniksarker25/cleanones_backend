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
exports.getPhotoReviewListFromDB = exports.setPhotoVerdict = void 0;
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = require("mongoose");
const appError_1 = __importDefault(require("../../error/appError"));
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const location_model_1 = require("../location/location.model");
const task_model_1 = require("../task/task.model");
const shift_model_1 = require("./shift.model");
const shift_shared_util_1 = require("./shift.shared.util");
/** Makes an approved photo the reference for future shifts — writes to the source Task, not this shift's snapshot. */
const promoteApprovedPhotoToReference = (taskId, title, photoUrl) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield task_model_1.Task.updateOne({ _id: new mongoose_1.Types.ObjectId(taskId) }, { $set: { 'photo_requirements.$[p].reference_image_url': photoUrl } }, { arrayFilters: [{ 'p.title': title }] });
    }
    catch (_a) {
        // A verdict must still be recorded if this fails.
    }
});
/** Records a manager's decision on one photo — a quality record, doesn't reopen the task or touch is_completed. */
const setPhotoVerdict = (managerId, planId, date, taskId, title, verdict, note) => __awaiter(void 0, void 0, void 0, function* () {
    const shift = yield (0, shift_shared_util_1.getShiftOrThrow)(planId, date);
    const task = shift.tasks.find((t) => t.task.toString() === taskId);
    if (!task) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Task not found on this shift');
    }
    const requirement = task.photo_requirements.find((p) => p.title === title);
    if (!requirement) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Unknown photo requirement "${title}" for this task`);
    }
    if (!requirement.is_uploaded) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'No photo has been uploaded for this requirement yet');
    }
    yield shift_model_1.Shift.updateOne({ _id: shift._id }, {
        $set: {
            'tasks.$[t].photo_requirements.$[p].manager_verdict': verdict,
            'tasks.$[t].photo_requirements.$[p].manager_verdict_by': new mongoose_1.Types.ObjectId(managerId),
            'tasks.$[t].photo_requirements.$[p].manager_verdict_at': new Date(),
            'tasks.$[t].photo_requirements.$[p].manager_note': note !== null && note !== void 0 ? note : null,
            // Leaves the queue — must not be picked up by the auto-accept sweep later.
            'tasks.$[t].photo_requirements.$[p].auto_accepted': false,
        },
    }, {
        arrayFilters: [
            { 't.task': new mongoose_1.Types.ObjectId(taskId) },
            { 'p.title': title },
        ],
    });
    if (verdict === 'approved' && requirement.photo_url) {
        yield promoteApprovedPhotoToReference(taskId, title, requirement.photo_url);
    }
    return shift_model_1.Shift.findById(shift._id);
});
exports.setPhotoVerdict = setPhotoVerdict;
/** Queue position for one photo — forced-accepts and wrong-subject photos rank above borderline scores. */
const photoReviewPriority = (photo) => {
    if (photo.manager_verdict)
        return 90;
    if (photo.auto_decided)
        return 85;
    // A clean AI pass settles it regardless of how many retries it took.
    if (photo.ai_status === 'passed')
        return 80;
    if (photo.forced_accept)
        return 1;
    if (photo.ai_subject_matches === false)
        return 2;
    if (photo.ai_status === 'failed')
        return 3;
    if (photo.ai_status === 'review')
        return 4;
    if (photo.audit_sampled)
        return 5;
    if (photo.ai_status === 'error' || photo.ai_status === 'pending')
        return 6;
    if (!photo.ai_status)
        return 7;
    return 8;
};
/** Whether a photo still needs a human eye — a clean AI verdict settles it unless the audit sampler pulled it. */
const photoNeedsReview = (photo) => {
    if (photo.manager_verdict)
        return false;
    if (photo.auto_decided)
        return photo.audit_sampled;
    if (photo.auto_accepted)
        return false;
    if (photo.ai_status === 'passed')
        return photo.audit_sampled;
    return true;
};
/**
 * Manager-facing photo review list: one row per shift task instance that has
 * at least one uploaded photo, across shifts in the given date range
 * (default: the last 30 days through today), optionally narrowed to one
 * cleaning plan or location.
 */
const getPhotoReviewListFromDB = (params) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e, _f;
    const to = (_b = params.to) !== null && _b !== void 0 ? _b : new Date();
    const from = (_c = params.from) !== null && _c !== void 0 ? _c : (() => {
        const d = new Date(to);
        d.setUTCDate(d.getUTCDate() - 30);
        return d;
    })();
    const filter = { date: { $gte: from, $lte: to } };
    if (params.planId)
        filter.cleaning_plan = new mongoose_1.Types.ObjectId(params.planId);
    if (params.locationId)
        filter['location.location'] = new mongoose_1.Types.ObjectId(params.locationId);
    const shifts = yield shift_model_1.Shift.find(filter)
        .select('cleaning_plan date location rooms tasks')
        .sort({ date: -1 })
        .lean();
    if (!shifts.length)
        return [];
    const planIds = [...new Set(shifts.map((s) => s.cleaning_plan.toString()))];
    const locationIds = [
        ...new Set(shifts.map((s) => s.location.location.toString())),
    ];
    const [plans, locations] = yield Promise.all([
        cleaning_plan_model_1.CleaningPlan.find({ _id: { $in: planIds } }).select('title').lean(),
        location_model_1.Location.find({ _id: { $in: locationIds } }).select('address').lean(),
    ]);
    const planTitleById = new Map(plans.map((p) => [p._id.toString(), p.title]));
    const addressById = new Map(locations.map((l) => [l._id.toString(), l.address]));
    const rows = [];
    for (const shift of shifts) {
        const roomNameByRoomId = new Map(shift.rooms.map((r) => [r.room.toString(), r.name]));
        const cleaningName = (_d = planTitleById.get(shift.cleaning_plan.toString())) !== null && _d !== void 0 ? _d : '';
        const address = (_e = addressById.get(shift.location.location.toString())) !== null && _e !== void 0 ? _e : null;
        for (const task of shift.tasks) {
            if (!task.is_photo_required)
                continue;
            const uploadedPhotos = task.photo_requirements
                .filter((p) => p.is_uploaded)
                .map((p) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
                return ({
                    title: p.title,
                    photo_url: p.photo_url,
                    description: (_a = p.description) !== null && _a !== void 0 ? _a : null,
                    reference_image_url: (_b = p.reference_image_url) !== null && _b !== void 0 ? _b : null,
                    ai_status: (_c = p.ai_status) !== null && _c !== void 0 ? _c : null,
                    ai_score: (_d = p.ai_score) !== null && _d !== void 0 ? _d : null,
                    ai_confidence: (_e = p.ai_confidence) !== null && _e !== void 0 ? _e : null,
                    ai_reason: (_f = p.ai_reason) !== null && _f !== void 0 ? _f : null,
                    ai_checks: (_g = p.ai_checks) !== null && _g !== void 0 ? _g : [],
                    ai_subject_matches: (_h = p.ai_subject_matches) !== null && _h !== void 0 ? _h : null,
                    ai_requirement_met: (_j = p.ai_requirement_met) !== null && _j !== void 0 ? _j : null,
                    ai_evaluated_at: (_k = p.ai_evaluated_at) !== null && _k !== void 0 ? _k : null,
                    gate_status: (_l = p.gate_status) !== null && _l !== void 0 ? _l : null,
                    gate_reason: (_m = p.gate_reason) !== null && _m !== void 0 ? _m : null,
                    attempt_count: (_o = p.attempt_count) !== null && _o !== void 0 ? _o : 0,
                    forced_accept: (_p = p.forced_accept) !== null && _p !== void 0 ? _p : false,
                    audit_sampled: (_q = p.audit_sampled) !== null && _q !== void 0 ? _q : false,
                    manager_verdict: (_r = p.manager_verdict) !== null && _r !== void 0 ? _r : null,
                    manager_verdict_at: (_s = p.manager_verdict_at) !== null && _s !== void 0 ? _s : null,
                    manager_note: (_t = p.manager_note) !== null && _t !== void 0 ? _t : null,
                    auto_decided: (_u = p.auto_decided) !== null && _u !== void 0 ? _u : false,
                    auto_decision: (_v = p.auto_decision) !== null && _v !== void 0 ? _v : null,
                    escalated_at: (_w = p.escalated_at) !== null && _w !== void 0 ? _w : null,
                    auto_accepted: (_x = p.auto_accepted) !== null && _x !== void 0 ? _x : false,
                });
            });
            if (!uploadedPhotos.length)
                continue;
            const priority = Math.min(...uploadedPhotos.map((p) => photoReviewPriority(p)));
            const needsReview = uploadedPhotos.some(photoNeedsReview);
            if (params.status === 'pending' && !needsReview)
                continue;
            if (params.status === 'decided' && needsReview)
                continue;
            rows.push({
                shift_id: shift._id.toString(),
                plan_id: shift.cleaning_plan.toString(),
                task_id: task.task.toString(),
                shift_date: shift.date,
                cleaning_name: cleaningName,
                room_name: task.room ? (_f = roomNameByRoomId.get(task.room.toString())) !== null && _f !== void 0 ? _f : '' : '',
                task_name: task.name,
                duration_minutes: task.duration_minutes,
                location_name: shift.location.name,
                address,
                review_priority: priority,
                needs_review: needsReview,
                uploaded_photos: uploadedPhotos,
            });
        }
    }
    // Most urgent first, then newest.
    rows.sort((a, b) => a.review_priority - b.review_priority ||
        b.shift_date.getTime() - a.shift_date.getTime());
    return rows;
});
exports.getPhotoReviewListFromDB = getPhotoReviewListFromDB;
