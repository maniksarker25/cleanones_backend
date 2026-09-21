import httpStatus from 'http-status';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
import { emitAppEvent } from '../../events/eventEmitter';
import chatServices from '../chat/chat.services';
import adminCredentialsEmailBody from '../../mailTemplate/adminCredentialsEmailBody';
import sendEmail from '../../utilities/sendEmail';
import { USER_ROLE } from '../user/user.constant';
import { TUser } from '../user/user.interface';
import { User } from '../user/user.model';
import { TClient } from './client.interface';
import { Client } from './client.model';
import { Shift } from '../shift/shift.model';
import { CleaningPlan } from '../cleaning_plan/cleaning_plan.model';
import { Location } from '../location/location.model';
import { cascadeCancelPlansForLocations } from '../location/location.services';
import { Room } from '../room/room.model';
import { Task } from '../task/task.model';
import { AdditionalTask } from '../additional_task/additional_task.model';
import '../worker/worker.model';
import { Worker } from '../worker/worker.model';
import { TRosterView, getPlanGroupedRosterFromDB } from '../shift/shift.services';

const createClientIntoDB = async (
    managerId: string,
    payload: Omit<TClient, 'manager'> & {
        password: string;
        confirmPassword: string;
    }
) => {
    const { password, confirmPassword, ...clientData } = payload;

    if (password !== confirmPassword) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Password and confirm password doesn't match"
        );
    }

    const emailExist = await User.findOne({
        email: clientData.email,
        isDeleted: { $ne: true },
    });
    if (emailExist) {
        throw new AppError(httpStatus.BAD_REQUEST, 'This email already exists');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userDataPayload: Partial<TUser> = {
            email: clientData.email,
            phone: clientData.phone,
            password,
            role: USER_ROLE.client,
            roles: [USER_ROLE.client],
            isVerified: true,
        };

        const [user] = await User.create([userDataPayload], { session });

        const clientPayload = {
            ...clientData,
            user: user._id,
            manager: managerId,
        };
        const [profile] = await Client.create([clientPayload], { session });

        await User.findByIdAndUpdate(
            user._id,
            { profileId: profile._id },
            { session }
        );

        await sendEmail({
            email: clientData.email,
            subject: 'Your Account Login Credentials',
            html: adminCredentialsEmailBody(
                clientData.name || 'Client',
                clientData.email,
                password
            ),
        });

        await session.commitTransaction();
        session.endSession();

        // Best-effort, outside the transaction — same pattern as
        // createChatGroupForPlan/createWorkerManagersChat. Idempotent (unique
        // index on the chat side), so a retry here can never create a
        // duplicate.
        await chatServices.createClientManagersChat(profile._id);

        return profile;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const updateClientIntoDB = async (
    managerId: string,
    id: string,
    payload: Partial<TClient>
) => {
    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    }

    if (payload.email && payload.email !== client.email) {
        const emailExist = await User.findOne({
            email: payload.email,
            isDeleted: { $ne: true },
        });
        if (emailExist) {
            throw new AppError(
                httpStatus.BAD_REQUEST,
                'This email already exists'
            );
        }
    }

    const result = await Client.findByIdAndUpdate(
        id,
        { ...payload, last_updated_by: managerId },
        {
            new: true,
            runValidators: true,
        }
    );

    if (payload.email || payload.phone) {
        await User.findByIdAndUpdate(client.user, {
            ...(payload.email && { email: payload.email }),
            ...(payload.phone && { phone: payload.phone }),
        });
    }

    return result;
};

const deleteClientFromDB = async (managerId: string, id: string) => {
    const client = await Client.findOne({ _id: id, isDeleted: false });
    if (!client) {
        throw new AppError(httpStatus.NOT_FOUND, 'Client not found');
    }

    // Deleting a client cascades exactly like deleting each of their
    // Locations would (see deleteLocationFromDB in location.services.ts) —
    // every active Location under them, every CleaningPlan at those
    // locations, those plans' chat groups, and their upcoming shifts, all in
    // one transaction so a crash mid-cascade can never leave a "deleted"
    // client with a location/plan/shift still live and staffable.
    const session = await mongoose.startSession();
    let locationCount: number;
    let planCount: number;
    let workerIds: string[];
    try {
        const output = await session.withTransaction(async () => {
            await Client.findByIdAndUpdate(
                id,
                { isDeleted: true, last_updated_by: managerId },
                { session }
            );
            await User.findByIdAndUpdate(
                client.user,
                { isDeleted: true, isBlocked: true },
                { session }
            );

            const affectedLocations = await Location.find({
                client: id,
                is_active: true,
            })
                .select('_id')
                .session(session)
                .lean();
            const locationIds = affectedLocations.map((l) => l._id);

            if (locationIds.length) {
                await Location.updateMany(
                    { _id: { $in: locationIds } },
                    { is_active: false, last_updated_by: managerId },
                    { session }
                );
            }

            const { planCount, cancelledWorkerIds } =
                await cascadeCancelPlansForLocations(locationIds, managerId, session);

            await chatServices.deactivateClientManagersChat(id, session);

            return {
                locationCount: locationIds.length,
                planCount,
                cancelledWorkerIds,
            };
        });
        locationCount = output.locationCount;
        planCount = output.planCount;
        workerIds = output.cancelledWorkerIds;
    } finally {
        await session.endSession();
    }

    emitAppEvent('client.deleted', {
        clientId: id,
        clientName: client.name,
        locationCount,
        planCount,
        workerIds,
    });

    return null;
};

const getAllClientsFromDB = async (query: Record<string, unknown>) => {
    const clientQuery = new QueryBuilder(
        Client.find({ isDeleted: false })
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
            }),
        query
    )
        .search(['name', 'email', 'phone', 'company_name'])
        .filter()
        .fields()
        .paginate()
        .sort();

    const meta = await clientQuery.countTotal();
    const result = await clientQuery.modelQuery;

    return {
        meta,
        result,
    };
};

const getClientOverviewFromDB = async (clientId: string) => {
    const client = await Client.findById(clientId);
    if (!client) throw new AppError(httpStatus.NOT_FOUND, 'Client not found');

    const [
        clientPlans,
        clientLocations,
        total_cleaning_plans,
        total_locations,
        total_global_tasks
    ] = await Promise.all([
        CleaningPlan.find({ client: clientId }).select('_id rooms'),
        Location.find({ client: clientId }).select('_id'),
        CleaningPlan.countDocuments({ client: clientId, isDeleted: { $ne: true } }),
        Location.countDocuments({ client: clientId }),
        Task.countDocuments({ client: clientId })
    ]);

    const clientPlanIds = clientPlans.map(p => p._id);
    const planRoomIds = clientPlans.flatMap(p => p.rooms || []);
    const locationIds = clientLocations.map(l => l._id);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const dayOfWeekStr = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][todayStart.getDay()];
    const dayOfMonthNum = todayStart.getDate();

    const [
        total_global_rooms,
        todaysShifts,
        [todayMetrics],
        [historicalStats],
        [trueTodayTasks],
        [trueTodayAdditionalTasks]
    ] = await Promise.all([
        Room.countDocuments({ location: { $in: locationIds } }),
        Shift.find({
            date: { $gte: todayStart, $lte: todayEnd },
            cleaning_plan: { $in: clientPlanIds }
        }).populate('location.location'),
        Shift.aggregate([
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
        Shift.aggregate([
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
        Task.aggregate([
            {
                $match: {
                    room: { $in: planRoomIds },
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
        AdditionalTask.aggregate([
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

    const base_total_hours = trueTodayTasks?.total_hours || 0;
    const additional_total_hours = trueTodayAdditionalTasks?.total_hours || 0;
    let total_hours = base_total_hours + additional_total_hours;

    // Synchronize total_hours with Daily Schedule Roster
    try {
        const rosterData = await getClientScheduleRosterFromDB(clientId);
        if (rosterData?.stats?.totalHours && rosterData.stats.totalHours > 0) {
            total_hours = rosterData.stats.totalHours;
        }
    } catch (error) {
        // Fall back to base task hours if roster computation fails
    }
    
    const hours_completed = todayMetrics?.hours_completed || 0;
    const total_rooms = trueTodayTasks?.unique_rooms?.length || 0;
    const rooms_completed = todayMetrics?.rooms_completed || 0;
    const location_name = todayMetrics?.location_names?.[0] || '';

    const base_task_count = trueTodayTasks?.task_count || 0;
    const additional_task_count = trueTodayAdditionalTasks?.task_count || 0;
    const total_tasks_today = base_task_count + additional_task_count;
    const completed_tasks_today = todayMetrics?.completed_tasks_in_shift || 0;

    const total_completed_tasks = historicalStats?.total_completed_tasks || 0;
    const total_completed_hours = historicalStats?.total_completed_hours || 0;
    const total_completed_rooms = historicalStats?.total_completed_rooms || 0;
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
                specialists_count: next_visit?.assigned_workers?.length || 0,
            },
            on_site_now: {
                specialists_count: inProgressShifts.reduce((acc, s) => acc + (s.assigned_workers?.length || 0), 0),
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
            specialists_count: next_visit?.assigned_workers?.length || 0,
            team_avatars: [],
            description: 'Please contact support for more details.',
        },
    };
};

async function getClientScheduleRosterFromDB(
    clientId: string,
    queryDate?: string
) {
    const client = await Client.findById(clientId);
    if (!client) throw new AppError(httpStatus.NOT_FOUND, 'Client not found');

    // 1. Resolve date window
    let targetDate: Date;
    if (queryDate && typeof queryDate === 'string' && !isNaN(new Date(queryDate).getTime())) {
        targetDate = new Date(queryDate);
    } else {
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
    const clientPlans = await CleaningPlan.find({
        client: clientId,
        is_active: true,
        status: { $ne: 'completed' },
    })
        .populate('location')
        .lean();

    const clientPlanIds = clientPlans.map((p) => p._id);
    const planRoomIds = clientPlans.flatMap((p) => p.rooms || []);

    // 3. Find materialized shifts for this date window
    const savedShifts = await Shift.find({
        cleaning_plan: { $in: clientPlanIds },
        date: { $gte: dateStart, $lte: dateEnd },
    })
        .populate('location.location')
        .populate('cleaning_plan', 'title max_estimated_duration')
        .populate('assigned_workers.worker')
        .lean();

    const savedPlanIds = new Set(savedShifts.map((s) => s.cleaning_plan?._id?.toString() || s.cleaning_plan?.toString()));

    // 4. Find active tasks matching frequency for this day (same logic as overview API)
    const matchingTasks = await Task.find({
        room: { $in: planRoomIds },
        is_active: true,
        $or: [
            { frequency_type: 'daily' },
            { frequency_type: 'weekly', days_of_week: dayOfWeekStr },
            { frequency_type: 'monthly', days_of_month: dayOfMonthNum },
        ],
    }).select('room duration_minutes').lean();

    const activeRoomsSet = new Set(matchingTasks.map((t) => t.room.toString()));

    // Map tasks duration per room
    const roomTaskDurations = new Map<string, number>();
    for (const t of matchingTasks) {
        const roomId = t.room.toString();
        roomTaskDurations.set(
            roomId,
            (roomTaskDurations.get(roomId) || 0) + (t.duration_minutes || 0)
        );
    }

    // Format helper for "HH:mm"
    const formatTime = (d: Date): string => {
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    };

    // Helper to calculate end time given a start Date and duration in minutes
    const calculateEndTime = (startDate: Date, durationMinutes: number): string => {
        const durationMs = (durationMinutes || 60) * 60 * 1000;
        const endDate = new Date(startDate.getTime() + durationMs);
        return formatTime(endDate);
    };

    const rosterShifts: Array<{
        id: string;
        shiftId: string | null;
        planId: string;
        planTitle: string;
        workerName: string;
        workerId: string;
        workerRole: string;
        location: string;
        locationAddress: string;
        date: string;
        // null until a manager has staffed this due date (see
        // assignWorkersToShift) — no real time to show before that.
        startTime: string | null;
        endTime: string | null;
        durationMinutes: number;
        // A Shift's real lifecycle status ('upcoming'/'in_progress'/
        // 'completed'/'cancelled'), or 'unstaffed' for a due date nobody
        // has been assigned to yet.
        status: string;
        isStaffed: boolean;
        roomsCount: number;
        tasksCount: number;
        assignedWorkers: Array<{ name: string; role?: string }>;
    }> = [];

    const teamMembersSet = new Set<string>();

    // 5. Process materialized shifts first
    for (const shift of savedShifts) {
        const locationName =
            (shift.location as any)?.name ||
            (shift.location as any)?.location?.name ||
            'CleanOnes HQ';
        const locationAddress =
            (shift.location as any)?.location?.address || '';
        const planId =
            (shift.cleaning_plan as any)?._id?.toString() ||
            shift.cleaning_plan?.toString() ||
            '';
        const planTitle =
            (shift.cleaning_plan as any)?.title || 'Cleaning Plan';

        // A materialized Shift always carries a real date_time/end_time —
        // both are set together, required, at staffing time.
        const durationMinutes = shift.duration_minutes || 480;
        const startTime = formatTime(new Date(shift.date_time));
        const endTime = calculateEndTime(new Date(shift.date_time), durationMinutes);

        const workers = shift.assigned_workers || [];
        const isStaffed = workers.length > 0;
        const assignedWorkers = workers.map((w) => ({
            name: w.name || (w.worker as any)?.name || 'Specialist',
            role: w.role || 'Specialist',
        }));

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
                roomsCount: shift.rooms?.length || 0,
                tasksCount: shift.tasks?.length || 0,
                assignedWorkers,
            });
            teamMembersSet.add('Unassigned Specialist');
        } else {
            for (const aw of workers) {
                const workerName =
                    aw.name ||
                    (aw.worker as any)?.name ||
                    'Specialist';
                teamMembersSet.add(workerName);
                rosterShifts.push({
                    id: `${shift._id}_${(aw.worker as any)?._id || aw.name}`,
                    shiftId: shift._id.toString(),
                    planId,
                    planTitle,
                    workerName,
                    workerId: (aw.worker as any)?._id?.toString() || '',
                    workerRole: aw.role || 'Specialist',
                    location: locationName,
                    locationAddress,
                    date: dateStr,
                    startTime,
                    endTime,
                    durationMinutes,
                    status: shift.status,
                    isStaffed,
                    roomsCount: shift.rooms?.length || 0,
                    tasksCount: shift.tasks?.length || 0,
                    assignedWorkers,
                });
            }
        }
    }

    // 6. Process plans that occur on this date but are not yet materialized
    for (const plan of clientPlans) {
        if (savedPlanIds.has(plan._id.toString())) continue;

        const planRooms = (plan.rooms || []).map((r: any) => r.toString());
        const hasMatchingTask = planRooms.some((r: string) => activeRoomsSet.has(r));

        if (!hasMatchingTask && planRooms.length > 0) {
            continue;
        }

        const locationName = (plan.location as any)?.name || 'CleanOnes HQ';
        const locationAddress = (plan.location as any)?.address || '';
        const planId = plan._id.toString();
        const planTitle = plan.title || 'Cleaning Plan';

        let planTasksDuration = 0;
        let planTasksCount = 0;
        for (const roomId of planRooms) {
            planTasksDuration += roomTaskDurations.get(roomId) || 0;
            if (activeRoomsSet.has(roomId)) {
                planTasksCount++;
            }
        }
        const durationMinutes =
            planTasksDuration > 0
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
    const distinctShiftIds = new Set(
        rosterShifts.map((s) => s.shiftId ?? `plan:${s.planId}`)
    );
    const totalShifts = distinctShiftIds.size;
    const totalHours = Number(
        (
            rosterShifts.reduce((acc, s) => acc + s.durationMinutes / 60, 0)
        ).toFixed(1)
    );
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
};

// Today's live progress: room/task completion + real worked hours derived
// from worker check-in/check-out timestamps on today's shifts only.
const getClientActiveProgressFromDB = async (clientId: string) => {
    const client = await Client.findById(clientId);
    if (!client) throw new AppError(httpStatus.NOT_FOUND, 'Client not found');

    const clientPlans = await CleaningPlan.find({ client: clientId }).select('_id');
    const clientPlanIds = clientPlans.map(p => p._id);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaysShifts = await Shift.find({
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
        const estimated_hours = (shift.duration_minutes || 0) / 60;
        total_estimated_hours += estimated_hours;

        const planTasks = (shift.tasks || []).filter(t => t.source === 'plan_task' && t.room);
        const roomIds = (shift.rooms || []).map(r => r.room.toString());

        let shiftCompletedRooms = 0;
        for (const roomId of roomIds) {
            const tasksInRoom = planTasks.filter(t => t.room?.toString() === roomId);
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
            let worked_hours = 0;
            if (w.check_in_at) {
                const end = w.check_out_at
                    ? new Date(w.check_out_at)
                    : shift.status === 'in_progress'
                        ? now
                        : new Date(w.check_in_at);
                worked_hours = Math.max(
                    0,
                    (end.getTime() - new Date(w.check_in_at).getTime()) / 3600000
                );
            }
            total_worked_hours += worked_hours;

            return {
                worker_id: w.worker?.toString() || '',
                name: w.name,
                role: w.role,
                is_checked_in: !!w.check_in_at && !w.check_out_at,
                check_in_at: w.check_in_at || null,
                check_out_at: w.check_out_at || null,
                worked_hours: parseFloat(worked_hours.toFixed(2)),
            };
        });

        return {
            shift_id: shift._id.toString(),
            location_name: shift.location?.name || '',
            status: shift.status,
            start_time: shift.date_time,
            estimated_hours: parseFloat(estimated_hours.toFixed(2)),
            rooms: { total: shiftTotalRooms, completed: shiftCompletedRooms },
            tasks: { total: shiftTotalTasks, completed: shiftCompletedTasks },
            workers,
        };
    });

    const hasActive = shifts.some(s => s.status === 'in_progress');
    const allSettled =
        shifts.length > 0 &&
        shifts.every(s => s.status === 'completed' || s.status === 'cancelled');

    const status: 'no_service' | 'scheduled' | 'active' | 'completed' =
        shifts.length === 0 ? 'no_service' : hasActive ? 'active' : allSettled ? 'completed' : 'scheduled';

    const progress_percentage =
        total_tasks > 0 ? Math.min(100, Math.round((completed_tasks / total_tasks) * 100)) : 0;

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
};

const SHIFT_STATS_RANGES = ['today', 'this_week', 'this_month'] as const;
type TShiftStatsRange = (typeof SHIFT_STATS_RANGES)[number];

// Historical shift counts by status over a fixed window — separate from
// getClientActiveProgressFromDB (today-only, live worker detail) so the
// frontend can poll each at a different rate.
const getClientShiftStatsFromDB = async (clientId: string, range: string = 'today') => {
    const client = await Client.findById(clientId);
    if (!client) throw new AppError(httpStatus.NOT_FOUND, 'Client not found');

    if (!SHIFT_STATS_RANGES.includes(range as TShiftStatsRange)) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            `Invalid range. Must be one of: ${SHIFT_STATS_RANGES.join(', ')}`
        );
    }

    const clientPlans = await CleaningPlan.find({ client: clientId }).select('_id');
    const clientPlanIds = clientPlans.map(p => p._id);

    const now = new Date();
    let dateFrom: Date;
    let dateTo: Date;

    if (range === 'today') {
        dateFrom = new Date(now);
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(now);
        dateTo.setHours(23, 59, 59, 999);
    } else if (range === 'this_week') {
        dateFrom = new Date(now);
        dateFrom.setDate(now.getDate() - now.getDay());
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(dateFrom);
        dateTo.setDate(dateFrom.getDate() + 6);
        dateTo.setHours(23, 59, 59, 999);
    } else {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const statusCounts = await Shift.aggregate([
        {
            $match: {
                cleaning_plan: { $in: clientPlanIds },
                date: { $gte: dateFrom, $lte: dateTo },
            },
        },
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const counts: Record<string, number> = {
        upcoming: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
    };
    for (const c of statusCounts) {
        if (c._id in counts) counts[c._id as string] = c.count;
    }

    const total_shifts = counts.upcoming + counts.in_progress + counts.completed + counts.cancelled;
    const total_completed_shifts = counts.completed;
    const total_pending_shifts = counts.upcoming + counts.in_progress;
    const total_cancelled_shifts = counts.cancelled;
    const eligibleForRate = total_shifts - total_cancelled_shifts;
    const completion_rate =
        eligibleForRate > 0 ? Math.round((total_completed_shifts / eligibleForRate) * 100) : 0;

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
};

// Static inventory counts — cacheable on the frontend since these change
// far less often than shift/progress data.
const getClientTotalsFromDB = async (clientId: string) => {
    const client = await Client.findById(clientId);
    if (!client) throw new AppError(httpStatus.NOT_FOUND, 'Client not found');

    const clientLocations = await Location.find({ client: clientId }).select('_id');
    const locationIds = clientLocations.map(l => l._id);

    const [total_cleaning_plans, total_locations, total_rooms, total_tasks] = await Promise.all([
        CleaningPlan.countDocuments({ client: clientId, isDeleted: { $ne: true } }),
        Location.countDocuments({ client: clientId }),
        Room.countDocuments({ location: { $in: locationIds } }),
        Task.countDocuments({ client: clientId }),
    ]);

    return {
        total_cleaning_plans,
        total_locations,
        total_rooms,
        total_tasks,
    };
};

interface ClientRosterParams {
    view: TRosterView;
    date?: string;
    year?: number;
    month?: number;
    page?: number;
    limit?: number;
}

// Client-facing counterpart to shift.services' getShiftRosterFromDB, but
// grouped by CLEANING PLAN instead of by worker: for each of the client's
// plans (paginated), every due date in the selected day/week/month window —
// the real, staffed Shift where one exists, otherwise an unstaffed
// placeholder. Thin wrapper around the shared getPlanGroupedRosterFromDB
// (see shift.services.ts), scoped to just this client's plans — the manager-
// facing GET /shift/plan-roster is the system-wide equivalent.
const getClientPlanRosterFromDB = async (clientId: string, params: ClientRosterParams) => {
    const client = await Client.findById(clientId);
    if (!client) throw new AppError(httpStatus.NOT_FOUND, 'Client not found');

    return getPlanGroupedRosterFromDB(
        { client: clientId, isDeleted: { $ne: true } },
        params
    );
};

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

export default clientServices;
