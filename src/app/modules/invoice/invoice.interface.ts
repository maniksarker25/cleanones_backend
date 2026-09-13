import { Types } from 'mongoose';

export interface TInvoice {
    _id?: string;
    manager: Types.ObjectId;
    worker: Types.ObjectId;
    amount: number;
    payment_method: string;
    transaction_id?: string;
    notes?: string;
}
