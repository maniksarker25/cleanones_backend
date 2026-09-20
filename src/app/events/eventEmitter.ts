import EventEmitter from 'events';

export const appEventEmitter = new EventEmitter();

/**
 * Every domain event this app can emit, and the exact payload each one
 * carries. Adding a new event = add one line here, one interface, and a
 * listener in events/listeners/. Nothing emits these yet (see each service
 * file's own TODO) — this is the structure services will call into next.
 */

// ─── Cleaning plan ──────────────────────────────────────────────────────────

export interface CleaningPlanCreatedPayload {
    planId: string;
    title: string;
    clientId: string;
    managerId: string;
}

export interface CleaningPlanDeletedPayload {
    planId: string;
    title: string;
    clientId: string;
}

// ─── Additional task (client-requested extra work) ─────────────────────────

export interface AdditionalTaskCreatedPayload {
    taskId: string;
    planId: string;
    clientId: string;
    name: string;
}

export interface AdditionalTaskApprovedPayload {
    taskId: string;
    planId: string;
    clientId: string;
    name: string;
}

export interface AdditionalTaskRejectedPayload {
    taskId: string;
    planId: string;
    clientId: string;
    name: string;
    rejectReason?: string;
}

// ─── Shift (attendance) ─────────────────────────────────────────────────────

export interface ShiftCheckedInPayload {
    shiftId: string;
    planId: string;
    workerId: string;
    at: Date;
}

export interface ShiftCheckedOutPayload {
    shiftId: string;
    planId: string;
    workerId: string;
    at: Date;
}

export interface ShiftCompletedPayload {
    shiftId: string;
    planId: string;
    clientId: string;
}

export interface ShiftWorkerAssignedPayload {
    shiftId: string;
    planId: string;
    title: string;
    /** Only the newly-added workers, not the shift's full roster. */
    addedWorkerIds: string[];
    /** The shift's own scheduled start — set by the manager at staffing time. */
    start_date: Date;
}

export interface ShiftWorkerRemovedPayload {
    shiftId: string;
    planId: string;
    title: string;
    /** Only the workers just taken off this shift. */
    removedWorkerIds: string[];
}

// A future, already-staffed shift was cancelled because a room task edit
// (frequency/days changed, or the task was deleted/deactivated) took its
// date out of the plan's recurrence pattern — see
// shift.services.ts's reconcileFutureShiftsForTaskChange. (A whole-plan
// deletion uses the separate cleaning_plan.shifts_cancelled event instead —
// see deleteCleaningPlanFromDB in cleaning_plan.services.ts.)
export interface ShiftCancelledPayload {
    shiftId: string;
    planId: string;
    clientId: string;
    title: string;
    date: Date;
    /** The crew that was assigned before this shift got cancelled. */
    cancelledWorkerIds: string[];
}

// The whole plan was deleted/deactivated, taking every one of its staffed
// future shifts down with it — see cleaning_plan.services.ts's
// deleteCleaningPlanFromDB (which cancels them via shift.services.ts's
// cancelUpcomingShiftsAcrossPlans). One consolidated notice per affected
// worker (not one per shift): from a worker's side, "this plan got
// cancelled" is a single event even if they were staffed on several of its
// future dates. The client is deliberately not part of this payload — they
// already got one plan-level notice from cleaning_plan.deleted.
export interface CleaningPlanShiftsCancelledPayload {
    planId: string;
    title: string;
    /** Every worker who had at least one shift under this plan cancelled. */
    workerIds: string[];
}

// ─── Location ───────────────────────────────────────────────────────────────

// A Location was deleted/deactivated, taking every CleaningPlan at that
// location — and every one of their staffed future shifts — down with it.
// See location.services.ts's deleteLocationFromDB. One consolidated notice
// to the client and one consolidated notice per affected worker, covering
// every plan at the location at once — a worker staffed across 2 of the
// location's 3 plans still gets exactly one notification, not two, and the
// client gets one "this location was deactivated" notice rather than one per
// plan under it.
export interface LocationDeactivatedPayload {
    locationId: string;
    locationName: string;
    clientId: string;
    /** How many active CleaningPlans at this location got deactivated. */
    planCount: number;
    /** Every worker who had at least one shift cancelled across any of those plans. */
    workerIds: string[];
}

// ─── Chat (offline push only — realtime delivery is already handled by ────
// the Socket.IO layer in chat_message.services.ts; this event exists purely
// so an offline recipient still gets a push/notification-center entry) ─────

export interface ChatMessageReceivedPayload {
    chatId: string;
    chatType: 'group' | 'direct' | 'worker' | 'client';
    senderUserId: string;
    /** Every other member's profile id (Client/Worker/Manager _id) — the sender is excluded. */
    recipientProfileIds: string[];
    preview: string;
}

/** Every event name mapped to its payload type — the single source of truth. */
export interface AppEventPayloadMap {
    'cleaning_plan.created': CleaningPlanCreatedPayload;
    'cleaning_plan.deleted': CleaningPlanDeletedPayload;
    'cleaning_plan.shifts_cancelled': CleaningPlanShiftsCancelledPayload;
    'location.deactivated': LocationDeactivatedPayload;
    'additional_task.created': AdditionalTaskCreatedPayload;
    'additional_task.approved': AdditionalTaskApprovedPayload;
    'additional_task.rejected': AdditionalTaskRejectedPayload;
    'shift.checked_in': ShiftCheckedInPayload;
    'shift.checked_out': ShiftCheckedOutPayload;
    'shift.completed': ShiftCompletedPayload;
    'shift.worker_assigned': ShiftWorkerAssignedPayload;
    'shift.worker_removed': ShiftWorkerRemovedPayload;
    'shift.cancelled': ShiftCancelledPayload;
    'chat.message_received': ChatMessageReceivedPayload;
}

export type AppEventName = keyof AppEventPayloadMap;

/** Type-safe emit — payload shape is checked against the event name at compile time. */
export const emitAppEvent = <K extends AppEventName>(
    event: K,
    payload: AppEventPayloadMap[K]
): void => {
    appEventEmitter.emit(event, payload);
};

/** Type-safe subscribe — handler's payload param is inferred from the event name. */
export const onAppEvent = <K extends AppEventName>(
    event: K,
    handler: (payload: AppEventPayloadMap[K]) => void | Promise<void>
): void => {
    appEventEmitter.on(event, handler);
};
