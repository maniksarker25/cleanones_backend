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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const clientPlans = await CleaningPlan.find({ client: clientId }).select('_id');
    const clientPlanIds = clientPlans.map(p => p._id);

    const todaysShifts = await Shift.find({
        date: { $gte: todayStart, $lte: todayEnd },
        cleaning_plan: { $in: clientPlanIds }
    }).populate('location.location');

    const inProgressShifts = todaysShifts.filter(s => s.status === 'in_progress');
    const completedShifts = todaysShifts.filter(s => s.status === 'completed');

    const activeCount = inProgressShifts.length;
    let total_hours = 0;
    let hours_completed = 0;
    let total_rooms = 0;
    let rooms_completed = 0;
    let location_name = '';

    todaysShifts.forEach(shift => {
        total_hours += (shift.duration_minutes || 0) / 60;
        total_rooms += (shift.rooms?.length || 0);
        location_name = shift.location?.name || location_name;
        if (shift.status === 'completed') {
            hours_completed += (shift.duration_minutes || 0) / 60;
            rooms_completed += (shift.rooms?.length || 0);
        } else if (shift.status === 'in_progress') {
            // Rough estimate for in_progress
            hours_completed += ((shift.duration_minutes || 0) / 60) * 0.5;
            rooms_completed += Math.floor((shift.rooms?.length || 0) * 0.5);
        }
    });

    const progress_percentage = total_hours > 0 ? Math.round((hours_completed / total_hours) * 100) : 0;
    const next_visit = todaysShifts.find(s => s.status === 'upcoming');
    const last_completed = completedShifts[completedShifts.length - 1];

    return {
        greeting_name: client.name || 'Client',
        current_date_str: new Date().toLocaleDateString('en-US', { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
        todays_progress: {
            hours_completed: parseFloat(hours_completed.toFixed(1)),
            total_hours: parseFloat(total_hours.toFixed(1)),
            hours_completed_str: `${Math.floor(hours_completed)}h ${Math.round((hours_completed % 1) * 60)}m Completed`,
            hours_remaining_str: `${Math.floor(total_hours - hours_completed)}h ${Math.round(((total_hours - hours_completed) % 1) * 60)}m Remaining`,
            rooms_completed,
            total_rooms,
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
