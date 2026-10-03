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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.photoAiCrons = exports.runPendingRetrySweep = exports.runAutoAcceptSweep = exports.runEscalationSweep = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const shift_model_1 = require("../shift/shift.model");
const photo_ai_config_1 = require("./photo_ai.config");
const photo_ai_service_1 = require("./photo_ai.service");
const HOUR_MS = 60 * 60 * 1000;
const ESCALATE_AFTER_HOURS = Number((_a = process.env.PHOTO_AI_ESCALATE_HOURS) !== null && _a !== void 0 ? _a : 48);
const AUTO_ACCEPT_AFTER_DAYS = Number((_b = process.env.PHOTO_AI_AUTO_ACCEPT_DAYS) !== null && _b !== void 0 ? _b : 7);
const findUnreviewed = (cutoff, test) => __awaiter(void 0, void 0, void 0, function* () {
    var _c, _d;
    const shifts = yield shift_model_1.Shift.find({
        'tasks.photo_requirements.is_uploaded': true,
        'tasks.photo_requirements.ai_evaluated_at': { $lte: cutoff },
    })
        .select('tasks.task tasks.photo_requirements')
        .lean();
    const hits = [];
    for (const shift of shifts) {
        for (const task of (_c = shift.tasks) !== null && _c !== void 0 ? _c : []) {
            for (const requirement of (_d = task.photo_requirements) !== null && _d !== void 0 ? _d : []) {
                if (!requirement.is_uploaded)
                    continue;
                if (requirement.manager_verdict)
                    continue;
                if (requirement.auto_accepted)
                    continue;
                if (!requirement.ai_evaluated_at)
                    continue;
                if (new Date(requirement.ai_evaluated_at) > cutoff)
                    continue;
                if (!test(requirement))
                    continue;
                hits.push({
                    shiftId: shift._id,
                    taskId: task.task,
                    title: requirement.title,
                });
            }
        }
    }
    return hits;
});
const setOnRequirement = (hit, fields) => __awaiter(void 0, void 0, void 0, function* () {
    const update = {};
    for (const [key, value] of Object.entries(fields)) {
        update[`tasks.$[t].photo_requirements.$[p].${key}`] = value;
    }
    yield shift_model_1.Shift.updateOne({ _id: hit.shiftId }, { $set: update }, {
        arrayFilters: [{ 't.task': hit.taskId }, { 'p.title': hit.title }],
    });
});
const runEscalationSweep = () => __awaiter(void 0, void 0, void 0, function* () {
    const cutoff = new Date(Date.now() - ESCALATE_AFTER_HOURS * HOUR_MS);
    const hits = yield findUnreviewed(cutoff, (r) => !r.escalated_at);
    for (const hit of hits) {
        yield setOnRequirement(hit, { escalated_at: new Date() });
    }
    return hits.length;
});
exports.runEscalationSweep = runEscalationSweep;
const runAutoAcceptSweep = () => __awaiter(void 0, void 0, void 0, function* () {
    const cutoff = new Date(Date.now() - AUTO_ACCEPT_AFTER_DAYS * 24 * HOUR_MS);
    const hits = yield findUnreviewed(cutoff, () => true);
    for (const hit of hits) {
        yield setOnRequirement(hit, { auto_accepted: true });
    }
    return hits.length;
});
exports.runAutoAcceptSweep = runAutoAcceptSweep;
const runPendingRetrySweep = () => __awaiter(void 0, void 0, void 0, function* () {
    var _e, _f, _g;
    const ceiling = new Date(Date.now() - photo_ai_config_1.photoAiConfig.retry.ceiling_hours * HOUR_MS);
    const shifts = yield shift_model_1.Shift.find({
        'tasks.photo_requirements.ai_status': 'pending',
    })
        .select('tasks rooms')
        .lean();
    let handled = 0;
    for (const shift of shifts) {
        for (const task of (_e = shift.tasks) !== null && _e !== void 0 ? _e : []) {
            const room = (_f = shift.rooms) === null || _f === void 0 ? void 0 : _f.find((r) => { var _a, _b; return ((_a = r.room) === null || _a === void 0 ? void 0 : _a.toString()) === ((_b = task.room) === null || _b === void 0 ? void 0 : _b.toString()); });
            for (const requirement of (_g = task.photo_requirements) !== null && _g !== void 0 ? _g : []) {
                if (requirement.ai_status !== 'pending')
                    continue;
                if (!requirement.photo_url)
                    continue;
                const hit = {
                    shiftId: shift._id,
                    taskId: task.task,
                    title: requirement.title,
                };
                if (new Date(shift.date) < ceiling) {
                    yield setOnRequirement(hit, {
                        ai_status: 'skipped',
                        ai_error: 'retry ceiling reached',
                    });
                    handled++;
                    continue;
                }
                const result = yield photo_ai_service_1.PhotoAiService.evaluatePhoto({
                    photo_url: requirement.photo_url,
                    requirement: {
                        title: requirement.title,
                        description: requirement.description,
                        reference_image_url: requirement.reference_image_url,
                    },
                    context: {
                        room_name: room === null || room === void 0 ? void 0 : room.name,
                        room_type: room === null || room === void 0 ? void 0 : room.room_type,
                        task_name: task.name,
                    },
                });
                if (result.status === 'pending')
                    continue;
                yield setOnRequirement(hit, photo_ai_service_1.PhotoAiService.aiResultToFields(result));
                handled++;
            }
        }
    }
    return handled;
});
exports.runPendingRetrySweep = runPendingRetrySweep;
const guard = (name, run) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const count = yield run();
        if (count > 0)
            console.log(`[photo_ai] ${name}: ${count} updated`);
    }
    catch (error) {
        console.error(`[photo_ai] ${name} failed`, error);
    }
});
node_cron_1.default.schedule('7 * * * *', () => guard('escalation', exports.runEscalationSweep));
node_cron_1.default.schedule('10 3 * * *', () => guard('auto-accept', exports.runAutoAcceptSweep));
node_cron_1.default.schedule('*/20 * * * *', () => guard('pending-retry', exports.runPendingRetrySweep));
exports.photoAiCrons = {
    runEscalationSweep: exports.runEscalationSweep,
    runAutoAcceptSweep: exports.runAutoAcceptSweep,
    runPendingRetrySweep: exports.runPendingRetrySweep,
};
