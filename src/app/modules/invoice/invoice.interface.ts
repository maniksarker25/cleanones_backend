import { Types } from 'mongoose';

export interface TInvoice {
    _id?: string;
    manager: Types.ObjectId;
    worker: Types.ObjectId;
    amount: number;
    // Worker hours this payment settled; absent on invoices created before hours were tracked.
    hours?: number;
    payment_method: string;
    transaction_id?: string;
    notes?: string;
}
