/* eslint-disable no-console */
import { Server as HTTPServer } from 'http';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Server as IOServer, Socket } from 'socket.io';
import config from '../config';
import handleChat from './handleChat';

let io: IOServer;

const onlineUsers = new Set<string>();

const initializeSocket = (server: HTTPServer) => {
    if (!io) {
        io = new IOServer(server, {
            pingTimeout: 60000,
            cors: {
                origin: [
                    'http://localhost:3007',
                    'http://localhost:3008',
                    'http://localhost:3000',
                    'http://localhost:3001',
                    'http://10.10.20.48:3000',
                    'http://localhost:9090',
                    'http://10.10.20.43:9090',
                    "http://10.10.28.195:3001"
                ],
            },
        });

        io.on('connection', async (socket: Socket) => {
            try {
                const token =
                    socket.handshake.auth?.token ||
                    socket.handshake.query?.token;

                if (!token) return socket.disconnect();

                const decode = jwt.verify(
                    token,
                    config.jwt_access_secret as string
                ) as JwtPayload;

                const currentUserId = decode.profileId;
                const currentUserAccountId = decode.id;
                console.log('Current user id', currentUserId);

                if (!currentUserId) return socket.disconnect();

                socket.join(currentUserId);

                if (decode.role === 'manager') {
                    socket.join('role:manager');
                }

                onlineUsers.add(currentUserId);

                io.emit('onlineUser', Array.from(onlineUsers));
                handleChat(
                    io,
                    socket,
                    currentUserAccountId,
                    currentUserId,
                    decode.role
                );

                socket.on('disconnect', () => {
                    onlineUsers.delete(currentUserId);
                    io.emit('onlineUser', Array.from(onlineUsers));
                    console.log('User disconnected:', currentUserId);
                });
            } catch (error) {
                console.error('Socket Auth Error:', error);
                socket.disconnect();
            }
        });
    }

    return io;
};

const isUserOnline = (userId: string) => {
    return onlineUsers.has(userId);
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized.');
    }
    return io;
};

export { getIO, initializeSocket, isUserOnline };
