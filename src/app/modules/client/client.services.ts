import httpStatus from 'http-status';
import mongoose from 'mongoose';
import QueryBuilder from '../../builder/QueryBuilder';
import AppError from '../../error/appError';
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
import { Room } from '../room/room.model';
import { Task } from '../task/task.model';
import { AdditionalTask } from '../additional_task/additional_task.model';

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

    const emailExist = await User.findOne({ email: clientData.email });
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
        const emailExist = await User.findOne({ email: payload.email });
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

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
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

        await session.commitTransaction();
        session.endSession();

        return null;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
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
    const total_hours = base_total_hours + additional_total_hours;
    
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
    const progress_percentage = total_hours > 0 ? Math.round((hours_completed / total_hours) * 100) : 0;
    const next_visit = todaysShifts.find(s => s.status === 'upcoming');
    const last_completed = completedShifts[completedShifts.length - 1];

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
            hours_remaining_str: `${Math.floor(total_hours - hours_completed)}h ${Math.round(((total_hours - hours_completed) % 1) * 60)}m Remaining`,
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

const clientServices = {
    createClientIntoDB,
    updateClientIntoDB,
    deleteClientFromDB,
    getAllClientsFromDB,
    getClientOverviewFromDB,
};

export default clientServices;
