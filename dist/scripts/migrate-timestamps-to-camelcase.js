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
 * One-off migration: several models used to store their timestamps as
 * created_at/updated_at (snake_case) instead of Mongoose's default
 * createdAt/updatedAt (camelCase). The models now declare `timestamps: true`
 * (default camelCase field names), but documents written before that change
 * still have the old snake_case fields on disk — Mongoose does not rename
 * existing data. This script backfills createdAt/updatedAt on those
 * documents and drops the now-stale snake_case fields/indexes.
 *
 * Idempotent and safe to re-run: only touches documents that still have the
 * old field, and skips renaming into a field that's already been (re)written
 * under the new name — an old field with no camelCase counterpart yet is
 * renamed, otherwise it's simply dropped once the camelCase value exists.
 * `syncIndexes()` cleans up now-unused snake_case indexes (e.g. ChatMessage's
 * old `{ chat: 1, created_at: -1 }`) and creates whatever the current schema
 * declares.
 *
 * NOTE: this has already been run once against the live cleanones_db cluster
 * (2026-09-15) — 596 documents renamed across 9 collections. Re-running is
 * safe (idempotent) but should be a no-op unless new snake_case data appears.
 *
 * Run with: npx ts-node src/scripts/migrate-timestamps-to-camelcase.ts
 * Preview only, no writes: add --dry-run
 */
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../app/config"));
const task_model_1 = require("../app/modules/task/task.model");
const additional_task_model_1 = require("../app/modules/additional_task/additional_task.model");
const chat_model_1 = require("../app/modules/chat/chat.model");
const chat_message_model_1 = require("../app/modules/chat_message/chat_message.model");
const client_model_1 = require("../app/modules/client/client.model");
const invoice_model_1 = require("../app/modules/invoice/invoice.model");
const manager_model_1 = require("../app/modules/manager/manager.model");
const worker_model_1 = require("../app/modules/worker/worker.model");
const user_model_1 = require("../app/modules/user/user.model");
const MODELS = [task_model_1.Task, additional_task_model_1.AdditionalTask, chat_model_1.Chat, chat_message_model_1.ChatMessage, client_model_1.Client, invoice_model_1.Invoice, manager_model_1.Manager, worker_model_1.Worker, user_model_1.User];
const DRY_RUN = process.argv.includes('--dry-run');
const migrateField = (collection, oldField, newField) => __awaiter(void 0, void 0, void 0, function* () {
    const renameFilter = { [oldField]: { $exists: true }, [newField]: { $exists: false } };
    const dropFilter = { [oldField]: { $exists: true }, [newField]: { $exists: true } };
    if (DRY_RUN) {
        return {
            renamed: yield collection.countDocuments(renameFilter),
            dropped: yield collection.countDocuments(dropFilter),
        };
    }
    // Old field present, new field absent: safe rename.
    const renamed = yield collection.updateMany(renameFilter, {
        $rename: { [oldField]: newField },
    });
    // Old field present AND new field already present (e.g. the app wrote
    // updatedAt via a normal update while updated_at sat frozen from
    // creation): the camelCase value is authoritative, just drop the old one.
    const dropped = yield collection.updateMany(dropFilter, {
        $unset: { [oldField]: '' },
    });
    return {
        renamed: renamed.modifiedCount,
        dropped: dropped.modifiedCount,
    };
});
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(config_1.default.database_url);
        console.log(`DB connected${DRY_RUN ? ' (dry run — no writes will be made)' : ''}`);
        for (const Model of MODELS) {
            const collection = Model.collection;
            const createdAtResult = yield migrateField(collection, 'created_at', 'createdAt');
            const updatedAtResult = yield migrateField(collection, 'updated_at', 'updatedAt');
            console.log(`${Model.modelName} (${collection.collectionName}): ` +
                `createdAt renamed=${createdAtResult.renamed} dropped=${createdAtResult.dropped}, ` +
                `updatedAt renamed=${updatedAtResult.renamed} dropped=${updatedAtResult.dropped}`);
            if (!DRY_RUN) {
                const indexesBefore = yield collection.indexes();
                yield Model.syncIndexes();
                const indexesAfter = yield collection.indexes();
                console.log(`${Model.modelName}: indexes ${indexesBefore.length} -> ${indexesAfter.length} after sync`);
            }
        }
        console.log(DRY_RUN ? 'Dry run complete — no changes made' : 'Migration complete');
        yield mongoose_1.default.disconnect();
    });
}
main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
