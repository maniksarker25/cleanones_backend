"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onAppEvent = exports.emitAppEvent = exports.appEventEmitter = void 0;
const events_1 = __importDefault(require("events"));
exports.appEventEmitter = new events_1.default();
/** Type-safe emit — payload shape is checked against the event name at compile time. */
const emitAppEvent = (event, payload) => {
    exports.appEventEmitter.emit(event, payload);
};
exports.emitAppEvent = emitAppEvent;
/** Type-safe subscribe — handler's payload param is inferred from the event name. */
const onAppEvent = (event, handler) => {
    exports.appEventEmitter.on(event, handler);
};
exports.onAppEvent = onAppEvent;
