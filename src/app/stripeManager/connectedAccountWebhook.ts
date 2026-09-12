/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';

import Stripe from 'stripe';

import config from '../config';

import { Worker } from '../modules/worker/worker.model';

import { TRANSACTION_STATUS } from '../modules/transaction/transaction.enum';

import Transaction from '../modules/transaction/transaction.model';

import { errorLogger, logger } from '../shared/logger';

import updateStripeConnectedAccountStatus from './updateStripeAccountConnectedStatus';

const stripe = new Stripe(config.stripe.stripe_secret_key as string);

const handleConnectedAccountWebhook = async (req: Request, res: Response) => {
    const endpointSecret = config.stripe.connected_account_webhook_secret;
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig as string,
            endpointSecret as string,
            300
        );
    } catch (err: any) {
        errorLogger.error(
            'Connected account webhook signature verification failed',
            {
                message: err.message,
            }
        );
        return res.status(400).send(`Webhook signature error: ${err.message}`);
    }
    console.log('from connected account', event);

    try {
        switch (event.type) {
            case 'account.updated': {
                const account = event.data.object as Stripe.Account;

                if (account.details_submitted) {
                    try {
                        await updateStripeConnectedAccountStatus(account.id);
                        logger.info(
                            'account.updated — connected account status updated',
                            {
                                accountId: account.id,
                            }
                        );
                    } catch (err) {
                        errorLogger.error(
                            'Failed to update connected account status',
                            {
                                accountId: account.id,
                                err,
                            }
                        );
                    }
                }

                break;
            }

            case 'payout.created': {
                const payout = event.data.object as Stripe.Payout;
                const accountId = event.account;

                const worker = await Worker.findOne({
                    stripeAccountId: accountId,
                }).select('_id');

                if (!worker) {
                    errorLogger.error(
                        'Worker not found during payout.created',
                        {
                            accountId,
                            payoutId: payout.id,
                        }
                    );
                    return res.status(200).send('Worker not found');
                }

                try {
                    await Transaction.create({
                        worker: worker._id,
                        type: 'PAYOUT',
                        amount: payout.amount / 100,
                        status: TRANSACTION_STATUS.PENDING,
                        stripePayoutId: payout.id,
                        stripeEventId: event.id,
                    });

                    logger.info('payout.created transaction recorded', {
                        payoutId: payout.id,
                        providerId: worker._id,
                        amount: payout.amount / 100,
                    });
                } catch (err: any) {
                    if (err.code === 11000) {
                        logger.info(
                            'payout.created already processed (duplicate key)',
                            {
                                eventId: event.id,
                            }
                        );
                        return res.status(200).send('Already processed');
                    }
                    throw err;
                }

                break;
            }

            case 'payout.paid': {
                const payout = event.data.object as Stripe.Payout;

                const existing = await Transaction.findOne({
                    stripePayoutId: payout.id,
                });

                if (!existing) {
                    const accountId = event.account;

                    const worker = await Worker.findOne({
                        stripeAccountId: accountId,
                    }).select('_id');

                    if (!worker) {
                        errorLogger.error(
                            'Worker not found during payout.paid (no existing transaction)',
                            {
                                accountId,
                                payoutId: payout.id,
                            }
                        );
                        return res.status(200).send('Worker not found');
                    }

                    await Transaction.create({
                        worker: worker._id,
                        type: 'PAYOUT',
                        amount: payout.amount / 100,
                        status: TRANSACTION_STATUS.COMPLETED,
                        stripePayoutId: payout.id,
                        stripeEventId: event.id,
                    });

                    logger.info(
                        'payout.paid — created missing transaction and marked COMPLETED',
                        {
                            payoutId: payout.id,
                            providerId: worker._id,
                        }
                    );
                } else {
                    existing.status = TRANSACTION_STATUS.COMPLETED;
                    await existing.save();

                    logger.info(
                        'payout.paid — existing transaction marked COMPLETED',
                        {
                            payoutId: payout.id,
                            transactionId: existing._id,
                        }
                    );
                }

                break;
            }

            case 'payout.failed': {
                const payout = event.data.object as Stripe.Payout;

                const updated = await Transaction.findOneAndUpdate(
                    { stripePayoutId: payout.id },
                    { status: TRANSACTION_STATUS.FAILED },
                    { new: true }
                );

                if (!updated) {
                    errorLogger.error(
                        'payout.failed — no matching transaction found',
                        {
                            payoutId: payout.id,
                        }
                    );
                } else {
                    logger.info('payout.failed — transaction marked FAILED', {
                        payoutId: payout.id,
                        transactionId: updated._id,
                    });
                }

                break;
            }

            default:
                logger.info(
                    `Unhandled connected account webhook event: ${event.type}`,
                    {
                        eventId: event.id,
                        account: event.account,
                    }
                );
        }

        return res.status(200).send('Success');
    } catch (err: any) {
        errorLogger.error(
            'Unexpected error processing connected account webhook',
            {
                eventId: event.id,
                eventType: event.type,
                message: err.message,
                stack: err.stack,
            }
        );
        return res.status(500).send('Internal server error');
    }
};

export default handleConnectedAccountWebhook;
