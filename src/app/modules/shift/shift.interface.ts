import { Types } from 'mongoose';

export type ShiftStatus =
    | 'upcoming'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export type ShiftTaskStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED';

export interface IShiftPhotoRequirement {
    title: string;
    photo_url: string | null;
    is_uploaded: boolean;
}

// Everything below (rooms, tasks, assigned_workers) is a SNAPSHOT taken at
// materialization time, not a live reference: a Shift is a self-contained
// historical record of one specific day, and must stay accurate even if the
// source Room/Task/Worker is later renamed, edited or deactivated. The
// ObjectId refs are kept alongside purely for traceability (audit lookups
// back to the source document) — nothing here should ever be re-derived by
// populating them. See docs/SHIFT_MANAGEMENT_DESIGN.md.

export interface IShiftRoom {
    room: Types.ObjectId;
    name: string;
    room_type: string;
}

export interface IShiftLocation {
    location: Types.ObjectId;
    name: string;
    // null when the source Location has no GPS point configured — check-in
    // cannot be geofence-validated for such a shift (see shift.services.ts).
    coordinates: {
        type: 'Point';
        coordinates: [number, number];
    } | null;
}

export interface IShiftTask {
    task: Types.ObjectId;
    room: Types.ObjectId;
    name: string;
    duration_minutes: number;
    is_photo_required: boolean;
    // Fresh every occurrence: titles are copied from the Task template, but
    // photo_url/is_uploaded always start unset — a previous day's shift
    // submitting a photo never affects this one.
    photo_requirements: IShiftPhotoRequirement[];
    // Auto-derived: true once every required photo_requirements entry is
    // uploaded (or immediately if no photo is required). No manual
    // complete/approve step — see docs/SHIFT_MANAGEMENT_DESIGN.md.
    is_completed: boolean;
    completed_at?: Date | null;
    // Defaults to UPCOMING at materialization time. Transitions to
    // IN_PROGRESS/COMPLETED are set manually (no automatic logic yet).
    status: ShiftTaskStatus;
}

export interface IShiftAssignedWorker {
    worker: Types.ObjectId;
    name: string;
    role: 'Team leader' | 'Co-leader' | 'Normal worker';
    assigned_with_conflict: boolean;
    // Set only on an already-materialized shift (check-in never creates one —
    // see checkInToShift in shift.services.ts). No time-window restriction:
    // valid any time on the shift's date. Coordinates are kept as evidence of
    // where the worker actually was, in addition to passing the geofence.
    check_in_at?: Date | null;
    check_in_coordinates?: [number, number] | null;
    check_out_at?: Date | null;
    check_out_coordinates?: [number, number] | null;
}

export interface IShift {
    cleaning_plan: Types.ObjectId;
    // Calendar day only (normalized to UTC midnight) — identifies the occurrence.
    date: Date;
    // Actual start timestamp for this occurrence (date + plan's time-of-day).
    date_time: Date;
    location: IShiftLocation;
    rooms: IShiftRoom[];
    tasks: IShiftTask[];
    duration_minutes: number;
    assigned_workers: IShiftAssignedWorker[];
    // true once a manager has edited this shift's workers directly, diverging
    // it from the plan's default assignment.
    is_worker_overridden: boolean;
    status: ShiftStatus;
    last_updated_by?: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}
