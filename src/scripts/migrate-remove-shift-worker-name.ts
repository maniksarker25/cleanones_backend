/**
 * One-off migration: removes the denormalized `assigned_workers[].name` copy
 * from existing Shift documents. The name now lives only on Worker and is
 * resolved at read time (see attachWorkerNames in shift.shared.util.ts), so
 * the stored copy would only go stale. Idempotent: re-running is a no-op.
 *
 * Run with: npx ts-node --transpile-only src/scripts/migrate-remove-shift-worker-name.ts
 */
import mongoose from 'mongoose';
import config from '../app/config';

async function main() {
    await mongoose.connect(config.database_url as string);
    console.log('DB connected');

    // Native collection access: the field is gone from the Mongoose schema,
    // so a schema-bound update would strip the unknown path and do nothing.
    const result = await mongoose.connection
        .collection('shifts')
        .updateMany(
            { 'assigned_workers.name': { $exists: true } },
            { $unset: { 'assigned_workers.$[].name': '' } }
        );

    console.log(
        `Matched ${result.matchedCount} shift(s), modified ${result.modifiedCount}.`
    );
    await mongoose.disconnect();
}

main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});
