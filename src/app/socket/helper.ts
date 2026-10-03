import { Socket } from 'socket.io';

export type SocketError = {
    code: number;
    message: string;
    type: 'validation' | 'database' | 'auth' | 'general' | 'server';
    details?: unknown;
};

export const emitError = (socket: Socket, error: SocketError) => {
    console.error(`Socket Error [${error.type}]:`, error);
    socket.emit('socket-error', error);
};
