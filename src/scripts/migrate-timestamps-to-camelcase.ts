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
import mongoose from 'mongoose';
import config from '../app/config';
import { Task } from '../app/modules/task/task.model';
import { AdditionalTask } from '../app/modules/additional_task/additional_task.model';
import { Chat } from '../app/modules/chat/chat.model';
import { ChatMessage } from '../app/modules/chat_message/chat_message.model';
import { Client } from '../app/modules/client/client.model';
import { Invoice } from '../app/modules/invoice/invoice.model';
import { Manager } from '../app/modules/manager/manager.model';
import { Worker } from '../app/modules/worker/worker.model';
import { User } from '../app/modules/user/user.model';

const MODELS = [Task, AdditionalTask, Chat, ChatMessage, Client, Invoice, Manager, Worker, User];

const DRY_RUN = process.argv.includes('--dry-run');

const migrateField = async (
    collection: mongoose.mongo.Collection,
    oldField: string,
    newField: string
) => {
    const renameFilter = { [oldField]: { $exists: true }, [newField]: { $exists: false } };
    const dropFilter = { [oldField]: { $exists: true }, [newField]: { $exists: true } };

    if (DRY_RUN) {
        return {
            renamed: await collection.countDocuments(renameFilter),
            dropped: await collection.countDocuments(dropFilter),
        };
    }

    // Old field present, new field absent: safe rename.
    const renamed = await collection.updateMany(renameFilter, {
        $rename: { [oldField]: newField },
    });

    // Old field present AND new field already present (e.g. the app wrote
    // updatedAt via a normal update while updated_at sat frozen from
    // creation): the camelCase value is authoritative, just drop the old one.
    const dropped = await collection.updateMany(dropFilter, {
        $unset: { [oldField]: '' },
    });

    return {
        renamed: renamed.modifiedCount,
        dropped: dropped.modifiedCount,
    };
};

async function main() {
    await mongoose.connect(config.database_url as string);
    console.log(`DB connected${DRY_RUN ? ' (dry run — no writes will be made)' : ''}`);

    for (const Model of MODELS) {
        const collection = Model.collection;
        const createdAtResult = await migrateField(collection, 'created_at', 'createdAt');
        const updatedAtResult = await migrateField(collection, 'updated_at', 'updatedAt');

        console.log(
            `${Model.modelName} (${collection.collectionName}): ` +
                `createdAt renamed=${createdAtResult.renamed} dropped=${createdAtResult.dropped}, ` +
                `updatedAt renamed=${updatedAtResult.renamed} dropped=${updatedAtResult.dropped}`
        );

        if (!DRY_RUN) {
            const indexesBefore = await collection.indexes();
            await Model.syncIndexes();
            const indexesAfter = await collection.indexes();
            console.log(
                `${Model.modelName}: indexes ${indexesBefore.length} -> ${indexesAfter.length} after sync`
            );
        }
    }

    console.log(DRY_RUN ? 'Dry run complete — no changes made' : 'Migration complete');
    await mongoose.disconnect();
}

main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
