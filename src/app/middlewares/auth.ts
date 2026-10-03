import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import jwt, { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../config';
import AppError from '../error/appError';
import Admin from '../modules/admin/admin.model';
import { Client } from '../modules/client/client.model';
import { Manager } from '../modules/manager/manager.model';
import { Worker } from '../modules/worker/worker.model';
import SuperAdmin from '../modules/superAdmin/superAdmin.model';
import { USER_ROLE } from '../modules/user/user.constant';
import { TUserRole } from '../modules/user/user.interface';
import catchAsync from '../utilities/catchasync';

interface AuthProfileData {
    _id: mongoose.Types.ObjectId;
    user: {
        isDeleted?: boolean;
        isBlocked?: boolean;
        isVerified?: boolean;
        isActive?: boolean;
    } | null;
}

const auth = (...requiredRoles: TUserRole[]) => {
    return catchAsync(
        async (req: Request, res: Response, next: NextFunction) => {
            let token = req?.headers?.authorization;

            if (!token) {
                throw new AppError(
                    httpStatus.UNAUTHORIZED,
                    'You are not authorized'
                );
            }

            if (token.startsWith('Bearer ')) {
                token = token.slice(7, token.length);
            }

            let decoded;

            try {
                decoded = jwt.verify(
                    token,
                    config.jwt_access_secret as string
                ) as JwtPayload;
            } catch (err) {
                throw new AppError(httpStatus.UNAUTHORIZED, 'Token is expired');
            }

            const { id, role } = decoded;

            if (!decoded) {
                throw new AppError(httpStatus.UNAUTHORIZED, 'Token is expired');
            }

            let profileData: AuthProfileData | null = null;
            if (role == USER_ROLE.admin) {
                profileData = await Admin.findOne({ user: id })
                    .select('_id user')
                    .populate({
                        path: 'user',
                        select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
                    });
            } else if (role == USER_ROLE.client) {
                profileData = await Client.findOne({ user: id })
                    .select('_id user')
                    .populate({
                        path: 'user',
                        select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
                    });
            } else if (role == USER_ROLE.worker) {
                profileData = await Worker.findOne({
                    user: new mongoose.Types.ObjectId(id),
                })
                    .select('user _id')
                    .populate({
                        path: 'user',
                        select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
                    });
            } else if (role === USER_ROLE.manager) {
                profileData = await Manager.findOne({ user: id })
                    .select('_id user')
                    .populate({
                        path: 'user',
                        select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
                    });
            } else if (role === USER_ROLE.superAdmin) {
                profileData = await SuperAdmin.findOne({ user: id })
                    .select('_id user')
                    .populate({
                        path: 'user',
                        select: '_id isDeleted isBlocked isVerified passwordChangedAt isActive',
                    });
            }
            if (!profileData) {
                throw new AppError(httpStatus.NOT_FOUND, 'Unauthorized access');
            }
            const { user } = profileData;
            if (!user) {
                throw new AppError(
                    httpStatus.UNAUTHORIZED,
                    'Unauthorized access'
                );
            }
            if (user.isDeleted) {
                throw new AppError(
                    httpStatus.UNAUTHORIZED,
                    'Unauthorized access 2'
                );
            }
            if (user.isBlocked) {
                throw new AppError(
                    httpStatus.UNAUTHORIZED,
                    'Your account is blocked'
                );
            }
            if (!user?.isVerified) {
                throw new AppError(
                    httpStatus.BAD_REQUEST,
                    'You are not verified user'
                );
            }
            if (!user.isActive) {
                throw new AppError(
                    httpStatus.FORBIDDEN,
                    'Your account  is inactivated , please contact support'
                );
            }

            if (requiredRoles && !requiredRoles.includes(role)) {
                throw new AppError(
                    httpStatus.UNAUTHORIZED,
                    'Your are not authorized 3'
                );
            }
            // add those properties in req
            req.user = decoded as JwtPayload;
            req.user.profileId = profileData._id.toString();
            next();
        }
    );
};

export default auth;
