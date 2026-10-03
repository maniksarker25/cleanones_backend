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
exports.isUserOnline = exports.initializeSocket = exports.getIO = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const socket_io_1 = require("socket.io");
const config_1 = __importDefault(require("../config"));
const handleChat_1 = __importDefault(require("./handleChat"));
let io;
const onlineUsers = new Set();
const initializeSocket = (server) => {
    if (!io) {
        io = new socket_io_1.Server(server, {
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
                    "http://10.10.28.195:3001",
                    "http://10.10.28.119:3001",
                    "https://cleanones.vercel.app",
                    "https://cleanones-client-portal.vercel.app",
                    "https://cleanones-client-testing.vercel.app",
                    "http://10.10.28.194:3001",
                ],
            },
        });
        io.on('connection', (socket) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            try {
                const token = ((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) ||
                    ((_b = socket.handshake.query) === null || _b === void 0 ? void 0 : _b.token);
                if (!token)
                    return socket.disconnect();
                const decode = jsonwebtoken_1.default.verify(token, config_1.default.jwt_access_secret);
                const currentUserId = decode.profileId;
                const currentUserAccountId = decode.id;
                console.log('Current user id', currentUserId);
                if (!currentUserId)
                    return socket.disconnect();
                socket.join(currentUserId);
                if (decode.role === 'manager') {
                    socket.join('role:manager');
                }
                onlineUsers.add(currentUserId);
                io.emit('onlineUser', Array.from(onlineUsers));
                (0, handleChat_1.default)(io, socket, currentUserAccountId, currentUserId, decode.role);
                socket.on('disconnect', () => {
                    onlineUsers.delete(currentUserId);
                    io.emit('onlineUser', Array.from(onlineUsers));
                    console.log('User disconnected:', currentUserId);
                });
            }
            catch (error) {
                console.error('Socket Auth Error:', error);
                socket.disconnect();
            }
        }));
    }
    return io;
};
exports.initializeSocket = initializeSocket;
const isUserOnline = (userId) => {
    return onlineUsers.has(userId);
};
exports.isUserOnline = isUserOnline;
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized.');
    }
    return io;
};
exports.getIO = getIO;
