"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitError = void 0;
//emit error-------------
const emitError = (socket, error) => {
    console.error(`Socket Error [${error.type}]:`, error);
    socket.emit('socket-error', error);
};
exports.emitError = emitError;
