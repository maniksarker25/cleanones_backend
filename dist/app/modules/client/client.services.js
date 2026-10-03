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
const http_status_1 = __importDefault(require("http-status"));
const mongoose_1 = __importDefault(require("mongoose"));
const QueryBuilder_1 = __importDefault(require("../../builder/QueryBuilder"));
const appError_1 = __importDefault(require("../../error/appError"));
const eventEmitter_1 = require("../../events/eventEmitter");
const chat_services_1 = __importDefault(require("../chat/chat.services"));
const clientCredentialsEmailBody_1 = __importDefault(require("../../mailTemplate/clientCredentialsEmailBody"));
const sendEmail_1 = __importDefault(require("../../utilities/sendEmail"));
const user_constant_1 = require("../user/user.constant");
const user_model_1 = require("../user/user.model");
const client_model_1 = require("./client.model");
const shift_model_1 = require("../shift/shift.model");
const cleaning_plan_model_1 = require("../cleaning_plan/cleaning_plan.model");
const location_model_1 = require("../location/location.model");
const location_services_1 = require("../location/location.services");
const room_model_1 = require("../room/room.model");
const task_model_1 = require("../task/task.model");
const additional_task_model_1 = require("../additional_task/additional_task.model");
require("../worker/worker.model");
const shift_services_1 = require("../shift/shift.services");
const createClientIntoDB = (managerId, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { password, confirmPassword } = payload, clientData = __rest(payload, ["password", "confirmPassword"]);
    if (password !== confirmPassword) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, "Password and confirm password doesn't match");
    }
    // Normalize once, up front — the duplicate check, User.create and the
    // Client profile record itself all read clientData.email below.
    clientData.email = clientData.email.trim().toLowerCase();
    const emailExist = yield user_model_1.User.findOne({
        email: clientData.email,
        isDeleted: { $ne: true },
    });
    if (emailExist) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This email already exists');
    }
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const userDataPayload = {
            email: clientData.email,
            phone: clientData.phone,
            password,
            role: user_constant_1.USER_ROLE.client,
            roles: [user_constant_1.USER_ROLE.client],
            isVerified: true,
        };
        const [user] = yield user_model_1.User.create([userDataPayload], { session });
        const clientPayload = Object.assign(Object.assign({}, clientData), { user: user._id, manager: managerId });
        const [profile] = yield client_model_1.Client.create([clientPayload], { session });
        yield user_model_1.User.findByIdAndUpdate(user._id, { profileId: profile._id }, { session });
        yield (0, sendEmail_1.default)({
            email: clientData.email,
            subject: 'Your Cleanones Account Login Credentials',
            html: (0, clientCredentialsEmailBody_1.default)(clientData.name || 'Client', clientData.email, password),
        });
        yield session.commitTransaction();
        session.endSession();
        // Best-effort, outside the transaction — same pattern as
        // createChatGroupForPlan/createWorkerManagersChat. Idempotent (unique
        // index on the chat side), so a retry here can never create a
        // duplicate.
        yield chat_services_1.default.createClientManagersChat(profile._id);
        return profile;
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        throw error;
    }
});
const updateClientIntoDB = (managerId, id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield client_model_1.Client.findOne({ _id: id, isDeleted: false });
    if (!client) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    }
    if (payload.email) {
        payload.email = payload.email.trim().toLowerCase();
    }
    if (payload.email && payload.email !== client.email) {
        const emailExist = yield user_model_1.User.findOne({
            email: payload.email,
            isDeleted: { $ne: true },
        });
        if (emailExist) {
            throw new appError_1.default(http_status_1.default.BAD_REQUEST, 'This email already exists');
        }
    }
    const result = yield client_model_1.Client.findByIdAndUpdate(id, Object.assign(Object.assign({}, payload), { last_updated_by: managerId }), {
        new: true,
        runValidators: true,
    });
    if (payload.email || payload.phone) {
        yield user_model_1.User.findByIdAndUpdate(client.user, Object.assign(Object.assign({}, (payload.email && { email: payload.email })), (payload.phone && { phone: payload.phone })));
    }
    return result;
});
const deleteClientFromDB = (managerId, id) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield client_model_1.Client.findOne({ _id: id, isDeleted: false });
    if (!client) {
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    }
    // Deleting a client cascades exactly like deleting each of their
    // Locations would (see deleteLocationFromDB in location.services.ts) —
    // every active Location under them, every CleaningPlan at those
    // locations, those plans' chat groups, and their upcoming shifts, all in
    // one transaction so a crash mid-cascade can never leave a "deleted"
    // client with a location/plan/shift still live and staffable.
    const session = yield mongoose_1.default.startSession();
    let locationCount;
    let planCount;
    let workerIds;
    try {
        const output = yield session.withTransaction(() => __awaiter(void 0, void 0, void 0, function* () {
            yield client_model_1.Client.findByIdAndUpdate(id, { isDeleted: true, last_updated_by: managerId }, { session });
            yield user_model_1.User.findByIdAndUpdate(client.user, { isDeleted: true, isBlocked: true }, { session });
            const affectedLocations = yield location_model_1.Location.find({
                client: id,
                is_active: true,
            })
                .select('_id')
                .session(session)
                .lean();
            const locationIds = affectedLocations.map((l) => l._id);
            if (locationIds.length) {
                yield location_model_1.Location.updateMany({ _id: { $in: locationIds } }, { is_active: false, last_updated_by: managerId }, { session });
            }
            const { planCount, cancelledWorkerIds } = yield (0, location_services_1.cascadeCancelPlansForLocations)(locationIds, managerId, session);
            yield chat_services_1.default.deactivateClientManagersChat(id, session);
            return {
                locationCount: locationIds.length,
                planCount,
                cancelledWorkerIds,
            };
        }));
        locationCount = output.locationCount;
        planCount = output.planCount;
        workerIds = output.cancelledWorkerIds;
    }
    finally {
        yield session.endSession();
    }
    (0, eventEmitter_1.emitAppEvent)('client.deleted', {
        clientId: id,
        clientName: client.name,
        locationCount,
        planCount,
        workerIds,
    });
    return null;
});
const getAllClientsFromDB = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const clientQuery = new QueryBuilder_1.default(client_model_1.Client.find({ isDeleted: false })
        .populate({
        path: 'manager',
        populate: {
            path: 'user',
            select: 'email phone',
        },
    })
        .populate({
        path: 'last_updated_by',
        populate: {
            path: 'user',
            select: 'email phone',
        },
    }), query)
        .search(['name', 'email', 'phone', 'company_name'])
        .filter()
        .fields()
        .paginate()
        .sort();
    const meta = yield clientQuery.countTotal();
    const result = yield clientQuery.modelQuery;
    return {
        meta,
        result,
    };
});
const getClientOverviewFromDB = (clientId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    const client = yield client_model_1.Client.findById(clientId);
    if (!client)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    const [clientPlans, clientLocations, total_cleaning_plans, total_locations, total_global_tasks] = yield Promise.all([
        cleaning_plan_model_1.CleaningPlan.find({ client: clientId }).select('_id rooms tasks'),
        location_model_1.Location.find({ client: clientId }).select('_id'),
        cleaning_plan_model_1.CleaningPlan.countDocuments({ client: clientId, isDeleted: { $ne: true } }),
        location_model_1.Location.countDocuments({ client: clientId }),
        task_model_1.Task.countDocuments({ client: clientId })
    ]);
    const clientPlanIds = clientPlans.map(p => p._id);
    // Each plan's OWN selected tasks — not every task under its rooms, since
    // two plans can cover the same room with different task subsets.
    const planTaskIds = clientPlans.flatMap(p => p.tasks || []);
    const locationIds = clientLocations.map(l => l._id);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const dayOfWeekStr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][todayStart.getDay()];
    const dayOfMonthNum = todayStart.getDate();
    const [total_global_rooms, todaysShifts, [todayMetrics], [historicalStats], [trueTodayTasks], [trueTodayAdditionalTasks]] = yield Promise.all([
        room_model_1.Room.countDocuments({ location: { $in: locationIds } }),
        shift_model_1.Shift.find({
            date: { $gte: todayStart, $lte: todayEnd },
            cleaning_plan: { $in: clientPlanIds }
        }).populate('location.location'),
        shift_model_1.Shift.aggregate([
            {
                $match: {
                    cleaning_plan: { $in: clientPlanIds },
                    date: { $gte: todayStart, $lte: todayEnd }
                }
            },
            {
                $project: {
                    status: 1,
                    duration_minutes: 1,
                    tasks: 1,
                    location: 1
                }
            },
            {
                $unwind: { path: "$tasks", preserveNullAndEmptyArrays: true }
            },
            {
                $group: {
                    _id: { shiftId: "$_id", room: "$tasks.room" },
                    shift_status: { $first: "$status" },
                    duration_minutes: { $first: "$duration_minutes" },
                    location_name: { $first: "$location.name" },
                    is_room_completed: {
                        $min: { $cond: [{ $eq: ["$tasks.is_completed", true] }, 1, 0] }
                    },
                    total_tasks_in_room: { $sum: { $cond: [{ $ne: ["$tasks.room", null] }, 1, 0] } },
                    completed_tasks_in_room: { $sum: { $cond: [{ $eq: ["$tasks.is_completed", true] }, 1, 0] } }
                }
            },
            {
                $group: {
                    _id: "$_id.shiftId",
                    status: { $first: "$shift_status" },
                    duration_minutes: { $first: "$duration_minutes" },
                    location_name: { $first: "$location_name" },
                    active_rooms: { $sum: { $cond: [{ $ne: ["$_id.room", null] }, 1, 0] } },
                    completed_rooms: { $sum: "$is_room_completed" },
                    total_tasks_in_shift: { $sum: "$total_tasks_in_room" },
                    completed_tasks_in_shift: { $sum: "$completed_tasks_in_room" }
                }
            },
            {
                $group: {
                    _id: null,
                    total_hours: {
                        $sum: { $divide: [{ $ifNull: ["$duration_minutes", 0] }, 60] }
                    },
                    total_rooms: {
                        $sum: "$active_rooms"
                    },
                    hours_completed: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "completed"] },
                                { $divide: [{ $ifNull: ["$duration_minutes", 0] }, 60] },
                                {
                                    $cond: [
                                        { $eq: ["$status", "in_progress"] },
                                        {
                                            $multiply: [
                                                { $divide: [{ $ifNull: ["$duration_minutes", 0] }, 60] },
                                                {
                                                    $cond: [
                                                        { $gt: ["$total_tasks_in_shift", 0] },
                                                        { $divide: ["$completed_tasks_in_shift", "$total_tasks_in_shift"] },
                                                        0
                                                    ]
                                                }
                                            ]
                                        },
                                        0
                                    ]
                                }
                            ]
                        }
                    },
                    rooms_completed: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "completed"] },
                                "$active_rooms",
                                {
                                    $cond: [
                                        { $eq: ["$status", "in_progress"] },
                                        "$completed_rooms",
                                        0
                                    ]
                                }
                            ]
                        }
                    },
                    location_names: { $addToSet: "$location_name" }
                }
            }
        ]),
        shift_model_1.Shift.aggregate([
            {
                $match: {
                    cleaning_plan: { $in: clientPlanIds },
                    status: 'completed'
                }
            },
            {
                $project: {
                    duration_minutes: 1,
                    tasks: 1,
                }
            },
            {
                $group: {
                    _id: null,
                    total_completed_hours: { $sum: { $divide: ["$duration_minutes", 60] } },
                    total_completed_rooms: {
                        $sum: {
                            $size: {
                                $setUnion: [
                                    {
                                        $map: {
                                            input: { $filter: { input: "$tasks", as: "t", cond: { $ne: ["$$t.room", null] } } },
                                            as: "task",
                                            in: "$$task.room"
                                        }
                                    },
                                    []
                                ]
                            }
                        }
                    },
                    total_completed_tasks: {
                        $sum: {
                            $size: {
                                $filter: {
                                    input: "$tasks",
                                    as: "task",
                                    cond: { $eq: ["$$task.is_completed", true] }
                                }
                            }
                        }
                    }
                }
            }
        ]),
        task_model_1.Task.aggregate([
            {
                $match: {
                    _id: { $in: planTaskIds },
                    is_active: true,
                    $or: [
                        { frequency_type: 'daily' },
                        { frequency_type: 'weekly', days_of_week: dayOfWeekStr },
                        { frequency_type: 'monthly', days_of_month: dayOfMonthNum }
                    ]
                }
            },
            {
                $group: {
                    _id: null,
                    total_hours: { $sum: { $divide: ["$duration_minutes", 60] } },
                    unique_rooms: { $addToSet: "$room" },
                    task_count: { $sum: 1 }
                }
            }
        ]),
        additional_task_model_1.AdditionalTask.aggregate([
            {
                $match: {
                    cleaning_plan_id: { $in: clientPlanIds },
                    date_time: { $gte: todayStart, $lte: todayEnd }
                }
            },
            {
                $group: {
                    _id: null,
                    total_hours: { $sum: { $divide: ["$duration_minutes", 60] } },
                    task_count: { $sum: 1 }
                }
            }
        ])
    ]);
    const inProgressShifts = todaysShifts.filter(s => s.status === 'in_progress');
    const completedShifts = todaysShifts.filter(s => s.status === 'completed');
    const activeCount = inProgressShifts.length;
    const base_total_hours = (trueTodayTasks === null || trueTodayTasks === void 0 ? void 0 : trueTodayTasks.total_hours) || 0;
    const additional_total_hours = (trueTodayAdditionalTasks === null || trueTodayAdditionalTasks === void 0 ? void 0 : trueTodayAdditionalTasks.total_hours) || 0;
    let total_hours = base_total_hours + additional_total_hours;
    // Synchronize total_hours with Daily Schedule Roster
    try {
        const rosterData = yield getClientScheduleRosterFromDB(clientId);
        if (((_a = rosterData === null || rosterData === void 0 ? void 0 : rosterData.stats) === null || _a === void 0 ? void 0 : _a.totalHours) && rosterData.stats.totalHours > 0) {
            total_hours = rosterData.stats.totalHours;
        }
    }
    catch (error) {
        // Fall back to base task hours if roster computation fails
    }
    const hours_completed = (todayMetrics === null || todayMetrics === void 0 ? void 0 : todayMetrics.hours_completed) || 0;
    const total_rooms = ((_b = trueTodayTasks === null || trueTodayTasks === void 0 ? void 0 : trueTodayTasks.unique_rooms) === null || _b === void 0 ? void 0 : _b.length) || 0;
    const rooms_completed = (todayMetrics === null || todayMetrics === void 0 ? void 0 : todayMetrics.rooms_completed) || 0;
    const location_name = ((_c = todayMetrics === null || todayMetrics === void 0 ? void 0 : todayMetrics.location_names) === null || _c === void 0 ? void 0 : _c[0]) || '';
    const base_task_count = (trueTodayTasks === null || trueTodayTasks === void 0 ? void 0 : trueTodayTasks.task_count) || 0;
    const additional_task_count = (trueTodayAdditionalTasks === null || trueTodayAdditionalTasks === void 0 ? void 0 : trueTodayAdditionalTasks.task_count) || 0;
    const total_tasks_today = base_task_count + additional_task_count;
    const completed_tasks_today = (todayMetrics === null || todayMetrics === void 0 ? void 0 : todayMetrics.completed_tasks_in_shift) || 0;
    const total_completed_tasks = (historicalStats === null || historicalStats === void 0 ? void 0 : historicalStats.total_completed_tasks) || 0;
    const total_completed_hours = (historicalStats === null || historicalStats === void 0 ? void 0 : historicalStats.total_completed_hours) || 0;
    const total_completed_rooms = (historicalStats === null || historicalStats === void 0 ? void 0 : historicalStats.total_completed_rooms) || 0;
    const progress_percentage = total_hours > 0 ? Math.min(100, Math.round((hours_completed / total_hours) * 100)) : 0;
    const next_visit = todaysShifts.find(s => s.status === 'upcoming');
    const last_completed = completedShifts[completedShifts.length - 1];
    const remaining_minutes_total = Math.max(0, Math.round((total_hours - hours_completed) * 60));
    const remaining_h = Math.floor(remaining_minutes_total / 60);
    const remaining_m = remaining_minutes_total % 60;
    return {
        global_metrics: {
            total_cleaning_plans,
            total_locations,
            total_rooms: total_global_rooms,
            total_tasks: total_global_tasks,
            total_completed_tasks,
            total_completed_hours: parseFloat(total_completed_hours.toFixed(1)),
            total_completed_rooms
        },
        greeting_name: client.name || 'Client',
        current_date_str: new Date().toLocaleDateString('en-US', { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
        todays_progress: {
            hours_completed: parseFloat(hours_completed.toFixed(1)),
            total_hours: parseFloat(total_hours.toFixed(1)),
            hours_completed_str: `${Math.floor(hours_completed)}h ${Math.round((hours_completed % 1) * 60)}m Completed`,
            hours_remaining_str: `${remaining_h}h ${remaining_m}m Remaining`,
            rooms_completed,
            total_rooms,
            total_tasks: total_tasks_today,
            completed_tasks: completed_tasks_today,
            progress_percentage,
            status_badge: activeCount > 0 ? 'Active Service' : (todaysShifts.length > 0 ? 'Scheduled Today' : 'No Service Today'),
            location_name: location_name || (client.company_name) || 'N/A',
            service_time_slot: '09:00 AM - 05:00 PM',
            tracking_note: 'Room tracking is updated in real-time as cleaners check in/out of rooms.',
        },
        metrics_grid: {
            next_visit: {
                time_str: next_visit ? 'Today' : 'No Upcoming',
                team_name: 'CleanOnes',
                specialists_count: ((_d = next_visit === null || next_visit === void 0 ? void 0 : next_visit.assigned_workers) === null || _d === void 0 ? void 0 : _d.length) || 0,
            },
            on_site_now: {
                specialists_count: inProgressShifts.reduce((acc, s) => { var _a; return acc + (((_a = s.assigned_workers) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0),
                sub_text: activeCount > 0 ? 'Currently Active' : 'No Team On Site',
            },
            last_completed: {
                worked_str: last_completed ? 'Today' : 'No Recent',
                sub_text: 'Completed',
            },
        },
        live_status: {
            active_count: activeCount,
            specialists: [],
        },
        quick_actions: [],
        next_visitors: {
            scheduled_time_str: next_visit ? 'Today' : 'No Schedule',
            team_name: 'CleanOnes',
            specialists_count: ((_e = next_visit === null || next_visit === void 0 ? void 0 : next_visit.assigned_workers) === null || _e === void 0 ? void 0 : _e.length) || 0,
            team_avatars: [],
            description: 'Please contact support for more details.',
        },
    };
});
function getClientScheduleRosterFromDB(clientId, queryDate) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    return __awaiter(this, void 0, void 0, function* () {
        const client = yield client_model_1.Client.findById(clientId);
        if (!client)
            throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
        // 1. Resolve date window
        let targetDate;
        if (queryDate && typeof queryDate === 'string' && !isNaN(new Date(queryDate).getTime())) {
            targetDate = new Date(queryDate);
        }
        else {
            targetDate = new Date();
        }
        const dateStart = new Date(targetDate);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(targetDate);
        dateEnd.setHours(23, 59, 59, 999);
        const dayOfWeekStr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dateStart.getDay()];
        const dayOfMonthNum = dateStart.getDate();
        const dateStr = dateStart.toISOString().split('T')[0];
        // 2. Find client's cleaning plans
        const clientPlans = yield cleaning_plan_model_1.CleaningPlan.find({
            client: clientId,
            is_active: true,
            status: { $ne: 'completed' },
        })
            .populate('location')
            .lean();
        const clientPlanIds = clientPlans.map((p) => p._id);
        // Each plan's OWN selected tasks — not every task under its rooms, since
        // two plans can cover the same room with different task subsets.
        const planTaskIds = clientPlans.flatMap((p) => p.tasks || []);
        // 3. Find materialized shifts for this date window
        const savedShifts = yield shift_model_1.Shift.find({
            cleaning_plan: { $in: clientPlanIds },
            date: { $gte: dateStart, $lte: dateEnd },
        })
            .populate('location.location')
            .populate('cleaning_plan', 'title max_estimated_duration')
            .populate('assigned_workers.worker')
            .lean();
        const savedPlanIds = new Set(savedShifts.map((s) => { var _a, _b, _c; return ((_b = (_a = s.cleaning_plan) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || ((_c = s.cleaning_plan) === null || _c === void 0 ? void 0 : _c.toString()); }));
        // 4. Find active, plan-selected tasks matching frequency for this day
        // (same logic as overview API). Scoped to each plan's OWN `tasks` — not
        // every task under its rooms — so two plans sharing a room with
        // different task subsets don't leak each other's duration/count.
        const matchingTasks = yield task_model_1.Task.find({
            _id: { $in: planTaskIds },
            is_active: true,
            $or: [
                { frequency_type: 'daily' },
                { frequency_type: 'weekly', days_of_week: dayOfWeekStr },
                { frequency_type: 'monthly', days_of_month: dayOfMonthNum },
            ],
        }).select('duration_minutes').lean();
        const taskDurationById = new Map(matchingTasks.map((t) => [t._id.toString(), t.duration_minutes || 0]));
        // Format helper for "HH:mm"
        const formatTime = (d) => {
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            return `${h}:${m}`;
        };
        // Helper to calculate end time given a start Date and duration in minutes
        const calculateEndTime = (startDate, durationMinutes) => {
            const durationMs = (durationMinutes || 60) * 60 * 1000;
            const endDate = new Date(startDate.getTime() + durationMs);
            return formatTime(endDate);
        };
        const rosterShifts = [];
        const teamMembersSet = new Set();
        // 5. Process materialized shifts first
        for (const shift of savedShifts) {
            const locationName = ((_a = shift.location) === null || _a === void 0 ? void 0 : _a.name) ||
                ((_c = (_b = shift.location) === null || _b === void 0 ? void 0 : _b.location) === null || _c === void 0 ? void 0 : _c.name) ||
                'CleanOnes HQ';
            const locationAddress = ((_e = (_d = shift.location) === null || _d === void 0 ? void 0 : _d.location) === null || _e === void 0 ? void 0 : _e.address) || '';
            const planId = ((_g = (_f = shift.cleaning_plan) === null || _f === void 0 ? void 0 : _f._id) === null || _g === void 0 ? void 0 : _g.toString()) ||
                ((_h = shift.cleaning_plan) === null || _h === void 0 ? void 0 : _h.toString()) ||
                '';
            const planTitle = ((_j = shift.cleaning_plan) === null || _j === void 0 ? void 0 : _j.title) || 'Cleaning Plan';
            // A materialized Shift always carries a real date_time/end_time —
            // both are set together, required, at staffing time.
            const durationMinutes = shift.duration_minutes || 480;
            const startTime = formatTime(new Date(shift.date_time));
            const endTime = calculateEndTime(new Date(shift.date_time), durationMinutes);
            const workers = shift.assigned_workers || [];
            const isStaffed = workers.length > 0;
            const assignedWorkers = workers.map((w) => {
                var _a;
                return ({
                    name: w.name || ((_a = w.worker) === null || _a === void 0 ? void 0 : _a.name) || 'Specialist',
                    role: w.role || 'Specialist',
                });
            });
            if (!isStaffed) {
                // Edge case: a manager staffed this date with an empty crew.
                // The Shift document exists, but nobody is actually assigned.
                rosterShifts.push({
                    id: `${shift._id}_unassigned`,
                    shiftId: shift._id.toString(),
                    planId,
                    planTitle,
                    workerName: 'Unassigned Specialist',
                    workerId: '',
                    workerRole: 'Specialist',
                    location: locationName,
                    locationAddress,
                    date: dateStr,
                    startTime,
                    endTime,
                    durationMinutes,
                    status: 'unstaffed',
                    isStaffed,
                    roomsCount: ((_k = shift.rooms) === null || _k === void 0 ? void 0 : _k.length) || 0,
                    tasksCount: ((_l = shift.tasks) === null || _l === void 0 ? void 0 : _l.length) || 0,
                    assignedWorkers,
                });
                teamMembersSet.add('Unassigned Specialist');
            }
            else {
                for (const aw of workers) {
                    const workerName = aw.name ||
                        ((_m = aw.worker) === null || _m === void 0 ? void 0 : _m.name) ||
                        'Specialist';
                    teamMembersSet.add(workerName);
                    rosterShifts.push({
                        id: `${shift._id}_${((_o = aw.worker) === null || _o === void 0 ? void 0 : _o._id) || aw.name}`,
                        shiftId: shift._id.toString(),
                        planId,
                        planTitle,
                        workerName,
                        workerId: ((_q = (_p = aw.worker) === null || _p === void 0 ? void 0 : _p._id) === null || _q === void 0 ? void 0 : _q.toString()) || '',
                        workerRole: aw.role || 'Specialist',
                        location: locationName,
                        locationAddress,
                        date: dateStr,
                        startTime,
                        endTime,
                        durationMinutes,
                        status: shift.status,
                        isStaffed,
                        roomsCount: ((_r = shift.rooms) === null || _r === void 0 ? void 0 : _r.length) || 0,
                        tasksCount: ((_s = shift.tasks) === null || _s === void 0 ? void 0 : _s.length) || 0,
                        assignedWorkers,
                    });
                }
            }
        }
        // 6. Process plans that occur on this date but are not yet materialized
        for (const plan of clientPlans) {
            if (savedPlanIds.has(plan._id.toString()))
                continue;
            const planRooms = (plan.rooms || []).map((r) => r.toString());
            const planTaskIdsForThisPlan = (plan.tasks || []).map((t) => t.toString());
            const hasMatchingTask = planTaskIdsForThisPlan.some((id) => taskDurationById.has(id));
            if (!hasMatchingTask && planTaskIdsForThisPlan.length > 0) {
                continue;
            }
            const locationName = ((_t = plan.location) === null || _t === void 0 ? void 0 : _t.name) || 'CleanOnes HQ';
            const locationAddress = ((_u = plan.location) === null || _u === void 0 ? void 0 : _u.address) || '';
            const planId = plan._id.toString();
            const planTitle = plan.title || 'Cleaning Plan';
            let planTasksDuration = 0;
            let planTasksCount = 0;
            for (const taskId of planTaskIdsForThisPlan) {
                const duration = taskDurationById.get(taskId);
                if (duration !== undefined) {
                    planTasksDuration += duration;
                    planTasksCount++;
                }
            }
            const durationMinutes = planTasksDuration > 0
                ? planTasksDuration
                : plan.max_estimated_duration || 480;
            // A Cleaning Plan carries no schedule or crew of its own — this due
            // date hasn't been staffed yet (see assignWorkersToShift), so there
            // is no real shift, start/end time, or assigned worker to show.
            rosterShifts.push({
                id: `${plan._id}_unassigned`,
                shiftId: null,
                planId,
                planTitle,
                workerName: 'Unassigned Specialist',
                workerId: '',
                workerRole: 'Specialist',
                location: locationName,
                locationAddress,
                date: dateStr,
                startTime: null,
                endTime: null,
                durationMinutes,
                status: 'unstaffed',
                isStaffed: false,
                roomsCount: planRooms.length,
                tasksCount: planTasksCount,
                assignedWorkers: [],
            });
            teamMembersSet.add('Unassigned Specialist');
        }
        const teamMembers = Array.from(teamMembersSet);
        // Unstaffed rows have shiftId: null (no Shift document exists yet) but
        // are still exactly one row per due occurrence — fall back to planId so
        // they aren't all collapsed into a single "null" entry here.
        const distinctShiftIds = new Set(rosterShifts.map((s) => { var _a; return (_a = s.shiftId) !== null && _a !== void 0 ? _a : `plan:${s.planId}`; }));
        const totalShifts = distinctShiftIds.size;
        const totalHours = Number((rosterShifts.reduce((acc, s) => acc + s.durationMinutes / 60, 0)).toFixed(1));
        const totalMembers = teamMembers.length;
        return {
            date: dateStr,
            stats: {
                totalShifts,
                totalHours,
                totalMembers,
            },
            teamMembers,
            shifts: rosterShifts,
        };
    });
}
;
// Client-facing display rule: actual worked time is rounded UP to the
// nearest 30-minute increment (2h10m -> 2h30m, 2h40m -> 3h, 2h30m stays
// 2h30m) — worker/manager views keep the raw, unrounded duration; only what
// the client sees goes through this. Payment is unaffected by this — see
// checkOutFromShift's use of shift.duration_minutes (workable hours), not
// worked_hours, for pay.
const roundUpToHalfHour = (hours) => Math.ceil(hours * 2) / 2;
// Today's live progress: room/task completion + real worked hours derived
// from worker check-in/check-out timestamps on today's shifts only.
const getClientActiveProgressFromDB = (clientId) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield client_model_1.Client.findById(clientId);
    if (!client)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    const clientPlans = yield cleaning_plan_model_1.CleaningPlan.find({ client: clientId }).select('_id');
    const clientPlanIds = clientPlans.map(p => p._id);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todaysShifts = yield shift_model_1.Shift.find({
        cleaning_plan: { $in: clientPlanIds },
        date: { $gte: todayStart, $lte: todayEnd },
    }).lean();
    const now = new Date();
    let total_estimated_hours = 0;
    let total_worked_hours = 0;
    let total_rooms = 0;
    let completed_rooms = 0;
    let total_tasks = 0;
    let completed_tasks = 0;
    const shifts = todaysShifts.map(shift => {
        var _a;
        const estimated_hours = (shift.duration_minutes || 0) / 60;
        total_estimated_hours += estimated_hours;
        const planTasks = (shift.tasks || []).filter(t => t.source === 'plan_task' && t.room);
        const roomIds = (shift.rooms || []).map(r => r.room.toString());
        let shiftCompletedRooms = 0;
        for (const roomId of roomIds) {
            const tasksInRoom = planTasks.filter(t => { var _a; return ((_a = t.room) === null || _a === void 0 ? void 0 : _a.toString()) === roomId; });
            if (tasksInRoom.length > 0 && tasksInRoom.every(t => t.is_completed)) {
                shiftCompletedRooms += 1;
            }
        }
        const shiftTotalRooms = roomIds.length;
        const shiftTotalTasks = (shift.tasks || []).length;
        const shiftCompletedTasks = (shift.tasks || []).filter(t => t.is_completed).length;
        total_rooms += shiftTotalRooms;
        completed_rooms += shiftCompletedRooms;
        total_tasks += shiftTotalTasks;
        completed_tasks += shiftCompletedTasks;
        const workers = (shift.assigned_workers || []).map(w => {
            var _a;
            let worked_hours = 0;
            if (w.check_in_at) {
                const end = w.check_out_at
                    ? new Date(w.check_out_at)
                    : shift.status === 'in_progress'
                        ? now
                        : new Date(w.check_in_at);
                worked_hours = Math.max(0, (end.getTime() - new Date(w.check_in_at).getTime()) / 3600000);
            }
            // Client sees the rounded-up figure — see roundUpToHalfHour above.
            const rounded_worked_hours = roundUpToHalfHour(worked_hours);
            total_worked_hours += rounded_worked_hours;
            return {
                worker_id: ((_a = w.worker) === null || _a === void 0 ? void 0 : _a.toString()) || '',
                name: w.name,
                role: w.role,
                is_checked_in: !!w.check_in_at && !w.check_out_at,
                check_in_at: w.check_in_at || null,
                check_out_at: w.check_out_at || null,
                worked_hours: rounded_worked_hours,
            };
        });
        return {
            shift_id: shift._id.toString(),
            location_name: ((_a = shift.location) === null || _a === void 0 ? void 0 : _a.name) || '',
            status: shift.status,
            start_time: shift.date_time,
            estimated_hours: parseFloat(estimated_hours.toFixed(2)),
            rooms: { total: shiftTotalRooms, completed: shiftCompletedRooms },
            tasks: { total: shiftTotalTasks, completed: shiftCompletedTasks },
            workers,
        };
    });
    const hasActive = shifts.some(s => s.status === 'in_progress');
    const allSettled = shifts.length > 0 &&
        shifts.every(s => s.status === 'completed' || s.status === 'cancelled');
    const status = shifts.length === 0 ? 'no_service' : hasActive ? 'active' : allSettled ? 'completed' : 'scheduled';
    const progress_percentage = total_tasks > 0 ? Math.min(100, Math.round((completed_tasks / total_tasks) * 100)) : 0;
    return {
        date: todayStart.toISOString().split('T')[0],
        status,
        summary: {
            total_estimated_hours: parseFloat(total_estimated_hours.toFixed(2)),
            total_worked_hours: parseFloat(total_worked_hours.toFixed(2)),
            total_rooms,
            completed_rooms,
            total_tasks,
            completed_tasks,
            progress_percentage,
        },
        shifts,
    };
});
const SHIFT_STATS_RANGES = ['today', 'this_week', 'this_month'];
// Historical shift counts by status over a fixed window — separate from
// getClientActiveProgressFromDB (today-only, live worker detail) so the
// frontend can poll each at a different rate.
const getClientShiftStatsFromDB = (clientId, range = 'today') => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield client_model_1.Client.findById(clientId);
    if (!client)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    if (!SHIFT_STATS_RANGES.includes(range)) {
        throw new appError_1.default(http_status_1.default.BAD_REQUEST, `Invalid range. Must be one of: ${SHIFT_STATS_RANGES.join(', ')}`);
    }
    const clientPlans = yield cleaning_plan_model_1.CleaningPlan.find({ client: clientId }).select('_id');
    const clientPlanIds = clientPlans.map(p => p._id);
    const now = new Date();
    let dateFrom;
    let dateTo;
    if (range === 'today') {
        dateFrom = new Date(now);
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(now);
        dateTo.setHours(23, 59, 59, 999);
    }
    else if (range === 'this_week') {
        dateFrom = new Date(now);
        dateFrom.setDate(now.getDate() - now.getDay());
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(dateFrom);
        dateTo.setDate(dateFrom.getDate() + 6);
        dateTo.setHours(23, 59, 59, 999);
    }
    else {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    const statusCounts = yield shift_model_1.Shift.aggregate([
        {
            $match: {
                cleaning_plan: { $in: clientPlanIds },
                date: { $gte: dateFrom, $lte: dateTo },
            },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const counts = {
        upcoming: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
    };
    for (const c of statusCounts) {
        if (c._id in counts)
            counts[c._id] = c.count;
    }
    const total_shifts = counts.upcoming + counts.in_progress + counts.completed + counts.cancelled;
    const total_completed_shifts = counts.completed;
    const total_pending_shifts = counts.upcoming + counts.in_progress;
    const total_cancelled_shifts = counts.cancelled;
    const eligibleForRate = total_shifts - total_cancelled_shifts;
    const completion_rate = eligibleForRate > 0 ? Math.round((total_completed_shifts / eligibleForRate) * 100) : 0;
    return {
        range,
        date_from: dateFrom.toISOString(),
        date_to: dateTo.toISOString(),
        total_shifts,
        total_completed_shifts,
        total_pending_shifts,
        total_cancelled_shifts,
        completion_rate,
    };
});
// Static inventory counts — cacheable on the frontend since these change
// far less often than shift/progress data.
const getClientTotalsFromDB = (clientId) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield client_model_1.Client.findById(clientId);
    if (!client)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    const clientLocations = yield location_model_1.Location.find({ client: clientId }).select('_id');
    const locationIds = clientLocations.map(l => l._id);
    const [total_cleaning_plans, total_locations, total_rooms, total_tasks] = yield Promise.all([
        cleaning_plan_model_1.CleaningPlan.countDocuments({ client: clientId, isDeleted: { $ne: true } }),
        location_model_1.Location.countDocuments({ client: clientId }),
        room_model_1.Room.countDocuments({ location: { $in: locationIds } }),
        task_model_1.Task.countDocuments({ client: clientId }),
    ]);
    return {
        total_cleaning_plans,
        total_locations,
        total_rooms,
        total_tasks,
    };
});
// Client-facing counterpart to shift.services' getShiftRosterFromDB, but
// grouped by CLEANING PLAN instead of by worker: for each of the client's
// plans (paginated), every due date in the selected day/week/month window —
// the real, staffed Shift where one exists, otherwise an unstaffed
// placeholder. Thin wrapper around the shared getPlanGroupedRosterFromDB
// (see shift.services.ts), scoped to just this client's plans — the manager-
// facing GET /shift/plan-roster is the system-wide equivalent.
const getClientPlanRosterFromDB = (clientId, params) => __awaiter(void 0, void 0, void 0, function* () {
    const client = yield client_model_1.Client.findById(clientId);
    if (!client)
        throw new appError_1.default(http_status_1.default.NOT_FOUND, 'Client not found');
    return (0, shift_services_1.getPlanGroupedRosterFromDB)({ client: clientId, isDeleted: { $ne: true } }, params);
});
const clientServices = {
    createClientIntoDB,
    updateClientIntoDB,
    deleteClientFromDB,
    getAllClientsFromDB,
    getClientOverviewFromDB,
    getClientScheduleRosterFromDB,
    getClientActiveProgressFromDB,
    getClientShiftStatsFromDB,
    getClientTotalsFromDB,
    getClientPlanRosterFromDB,
};
exports.default = clientServices;
