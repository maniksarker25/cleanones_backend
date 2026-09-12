import httpStatus from 'http-status';
import AppError from '../error/appError';
import { Worker } from '../modules/worker/worker.model';
import { errorLogger } from '../shared/logger';

const updateStripeConnectedAccountStatus = async (accountId: string) => {
    if (!accountId) {
        throw new AppError(httpStatus.NOT_FOUND, 'Account not found');
    }

    try {
        await Worker.findOneAndUpdate(
            { stripeAccountId: accountId },
            { isStripeConnected: true },
            { new: true, runValidators: true }
        );
    } catch (err) {
        errorLogger.error('Stripe webhook worker update failed', {
            accountId,
            error: err instanceof Error ? err.message : 'Unknown error',
            stack: err instanceof Error ? err.stack : undefined,
        });

        return {
            success: false,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'An error occurred while updating the client status.',
            error: err instanceof Error ? err.message : 'Unknown error',
        };
    }
};

export default updateStripeConnectedAccountStatus;
