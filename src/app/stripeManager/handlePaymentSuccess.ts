/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { appEventEmitter } from '../events/eventEmitter';
import BidModel from '../modules/bid/bid.model';
import { LegalInfo } from '../modules/legal_info/legal_info.model';
import { ENUM_TASK_STATUS } from '../modules/task/task.enum';
import TaskModel from '../modules/task/task.model';
import { errorLogger } from '../shared/logger';
import { ENUM_PAYMENT_PURPOSE, ENUM_PAYMENT_STATUS } from '../utilities/enum';

const handlePaymentSuccess = async (
    metaData: any,
    transactionId: string,
    amount: number
) => {
    if (metaData.paymentPurpose == ENUM_PAYMENT_PURPOSE.BID_ACCEPT) {
        await handleBidAcceptPayment(metaData, transactionId, amount);
    }
};

const handleBidAcceptPayment = async (
    metaData: any,
    transactionId: string,
    amount: number
) => {
    const { taskId } = metaData;
    const task = await TaskModel.findById(taskId);
    const bid = await BidModel.findById(metaData.bidId);
    if (!bid) {
        console.error('Bid not found');
        return;
    }
    if (!task) {
        console.error(`Task with ID ${taskId} not found.`);
        return;
    }

    const platform = await LegalInfo.findOne();
    if (!platform) {
        errorLogger.error('Platform change not found');
        return;
    }

    console.log('percentage', platform.platformFeePercentage);

    const platformFeeAmount = (amount * platform.platformFeePercentage) / 100;
    const providerEarningAmount = amount - platformFeeAmount;
    const result = await TaskModel.findByIdAndUpdate(
        taskId,
        {
            status: ENUM_TASK_STATUS.ASSIGNED,
            paymentStatus: ENUM_PAYMENT_STATUS.PAID,
            transactionId,
            worker: bid.worker,
            acceptedBidAmount: amount,
            bidAcceptAt: new Date(),
            customerPayingAmount: amount,
            providerEarningAmount,
            platformFeePercentage: platform.platformFeePercentage,
        },
        { new: true }
    );
    appEventEmitter.emit('bid.accepted', {
        bidId: bid._id.toString(),
        taskId: task._id.toString(),
        worker: bid.worker.toString(),
        client: task.client.toString(),
    });
    console.log('updated tsk', result);
};

export default handlePaymentSuccess;
