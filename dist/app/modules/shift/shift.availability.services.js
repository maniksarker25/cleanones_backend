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
exports.findWorkerConflictOnDate = void 0;
const availability_util_1 = require("../cleaning_plan/availability.util");
const shift_model_1 = require("./shift.model");
/** Does this worker already have another staffed shift the same date with an overlapping time window? */
const findWorkerConflictOnDate = (workerId, date, dateTime, durationMinutes, exclude) => __awaiter(void 0, void 0, void 0, function* () {
    const otherShifts = yield shift_model_1.Shift.find(Object.assign({ date, 'assigned_workers.worker': workerId, status: { $ne: 'cancelled' } }, (exclude.shiftId && { _id: { $ne: exclude.shiftId } })))
        .select('date_time duration_minutes cleaning_plan')
        .lean();
    for (const shift of otherShifts) {
        if ((0, availability_util_1.timeWindowsOverlap)(dateTime, durationMinutes, shift.date_time, shift.duration_minutes)) {
            const reason = 'double_booked';
            return { conflicting_plan_id: shift.cleaning_plan, reason };
        }
    }
    return null;
});
exports.findWorkerConflictOnDate = findWorkerConflictOnDate;
