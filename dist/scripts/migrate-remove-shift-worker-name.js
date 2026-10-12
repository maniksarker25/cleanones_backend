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
/**
 * One-off migration: removes the denormalized `assigned_workers[].name` copy
 * from existing Shift documents. The name now lives only on Worker and is
 * resolved at read time (see attachWorkerNames in shift.shared.util.ts), so
 * the stored copy would only go stale. Idempotent: re-running is a no-op.
 *
 * Run with: npx ts-node --transpile-only src/scripts/migrate-remove-shift-worker-name.ts
 */
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../app/config"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(config_1.default.database_url);
        console.log('DB connected');
        // Native collection access: the field is gone from the Mongoose schema,
        // so a schema-bound update would strip the unknown path and do nothing.
        const result = yield mongoose_1.default.connection
            .collection('shifts')
            .updateMany({ 'assigned_workers.name': { $exists: true } }, { $unset: { 'assigned_workers.$[].name': '' } });
        console.log(`Matched ${result.matchedCount} shift(s), modified ${result.modifiedCount}.`);
        yield mongoose_1.default.disconnect();
    });
}
main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
