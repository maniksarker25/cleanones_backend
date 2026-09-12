/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../config';
import { Client } from '../modules/client/client.model';
import { Worker } from '../modules/worker/worker.model';
import SuperAdmin from '../modules/superAdmin/superAdmin.model';
import { USER_ROLE } from '../modules/user/user.constant';

const simpleAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        let token = req.headers.authorization;

        if (!token) return next(); // No token → optional

        if (token.startsWith('Bearer ')) {
            token = token.slice(7);
        }

        let decoded: JwtPayload | null = null;

        try {
            decoded = jwt.verify(
                token,
                config.jwt_access_secret as string
            ) as JwtPayload;
        } catch (err: any) {
            if (err.name === 'TokenExpiredError') {
                decoded = jwt.decode(token) as JwtPayload | null;
            } else {
                return next(); // ignore invalid token
            }
        }

        if (!decoded) return next(); // nothing to attach

        let profileData: any;
        const { id, role } = decoded;

        if (role === USER_ROLE.client) {
            profileData = await Client.findOne({ user: id })
                .select('_id user')
                .populate({
                    path: 'user',
                    select: '_id isDeleted isBlocked isVerified',
                });
        } else if (role === USER_ROLE.worker) {
            profileData = await Worker.findOne({
                user: new mongoose.Types.ObjectId(id),
            })
                .select('_id user')
                .populate({
                    path: 'user',
                    select: '_id isDeleted isBlocked isVerified',
                });
        } else if (role === USER_ROLE.superAdmin) {
            profileData = await SuperAdmin.findOne({ user: id })
                .select('_id user')
                .populate({
                    path: 'user',
                    select: '_id isDeleted isBlocked isVerified',
                });
        }

        if (profileData && profileData.user) {
            req.user = decoded;
            req.user.profileId = profileData._id.toString();
        }

        next();
    } catch (err) {
        console.error(err);
        next(); // ignore all errors for optional auth
    }
};

export default simpleAuth;
