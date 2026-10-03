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
exports.deactivateDevice = exports.upsertDevice = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const device_model_1 = require("./device.model");
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const upsertDevice = (userId, playerId, platform) => __awaiter(void 0, void 0, void 0, function* () {
    if (!playerId)
        return;
    return yield device_model_1.Device.findOneAndUpdate({ playerId }, {
        userId,
        playerId,
        platform,
        isActive: true,
        lastActiveAt: new Date(),
    }, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
    });
});
exports.upsertDevice = upsertDevice;
const deactivateDevice = (playerId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!playerId)
        return;
    yield device_model_1.Device.findOneAndUpdate({ playerId }, {
        isActive: false,
        lastActiveAt: new Date(),
    });
});
exports.deactivateDevice = deactivateDevice;
node_cron_1.default.schedule('0 2 * * 0', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('Device cleanup cron started');
        const result = yield device_model_1.Device.deleteMany({
            isActive: false,
            lastActiveAt: {
                $lt: new Date(Date.now() - THIRTY_DAYS),
            },
        });
        console.log(`Device cleanup done. Deleted: ${result.deletedCount}`);
    }
    catch (error) {
        console.error('Device cleanup cron failed:', error);
    }
}));
