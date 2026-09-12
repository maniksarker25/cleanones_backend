// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { Request, Response } from 'express';
// import Stripe from 'stripe';
// import config from '../config';
// import { Worker } from '../modules/worker/worker.model';
// import Transaction from '../modules/transaction/transaction.model';
// import { errorLogger, logger } from '../shared/logger';
// import handlePaymentSuccess from './handlePaymentSuccess';
// import updateStripeConnectedAccountStatus from './updateStripeAccountConnectedStatus';

// const stripe = new Stripe(config.stripe.stripe_secret_key as string);
// const handleWebhook = async (req: Request, res: Response) => {
//     const endpointSecret = config.stripe.webhook_endpoint_secret;
//     const sig = req.headers['stripe-signature'];

//     try {
//         const event = stripe.webhooks.constructEvent(
//             req.body,
//             sig as string,
//             endpointSecret as string
//         );

//         switch (event.type) {
//             case 'checkout.session.completed': {
//                 const session = event.data.object as Stripe.Checkout.Session;
//                 const paymentIntentId = session.payment_intent;
//                 const paymentIntent = await stripe.paymentIntents.retrieve(
//                     paymentIntentId as string
//                 );
//                 const exists = await Transaction.findOne({
//                     stripePaymentIntentId: paymentIntentId,
//                 });

//                 if (exists) return;
//                 await handlePaymentSuccess(
//                     session.metadata,
//                     paymentIntent.id,
//                     paymentIntent.amount / 100
//                 );

//                 break;
//             }
//             case 'transfer.created': {
//                 const transfer = event.data.object as Stripe.Transfer;

//                 const exists = await Transaction.findOne({
//                     stripeEventId: event.id,
//                 });
//                 if (exists) {
//                     logger.info('Already processed that event');
//                     return res.status(200).send('OK');
//                 }

//                 const worker = await Worker.findOne({
//                     stripeAccountId: transfer.destination,
//                 }).select('_id');
//                 if (!worker) {
//                     errorLogger.error(
//                         'Worker not found when transfer happen'
//                     );
//                     return res.status(200).send('Worker not found');
//                 }
//                 await Transaction.create({
//                     worker: worker._id,
//                     type: 'PENDING',
//                     amount: transfer.amount / 100,
//                     status: 'COMPLETED',
//                     stripeTransferId: transfer.id,
//                     stripeEventId: event.id,
//                     metadata: transfer.metadata,
//                 });

//                 break;
//             }

//             case 'account.updated': {
//                 console.log('web hook account update');
//                 const account = event.data.object as Stripe.Account;
//                 if (account.details_submitted) {
//                     try {
//                         await updateStripeConnectedAccountStatus(account.id);
//                     } catch (err) {
//                         console.error(
//                             `Failed to update client status for Stripe account ID: ${account.id}`,
//                             err
//                         );
//                     }
//                 }
//                 break;
//             }
//             case 'payment_intent.payment_failed': {
//                 const paymentIntent = event.data.object as Stripe.PaymentIntent;
//                 const { userId, subscriptionId } = paymentIntent.metadata;

//                 console.log(
//                     `Payment failed for user ${userId}, subscription ${subscriptionId}`
//                 );

//                 break;
//             }
//             default:
//                 console.log(`Unhandled event type ${event.type}`);
//         }

//         res.status(200).send('Success');
//     } catch (err: any) {
//         console.error('Webhook error:', err.message);
//         res.status(400).send(`Webhook Error: ${err.message}`);
//     }
// };

// export default handleWebhook;

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Request, Response } from 'express';

import Stripe from 'stripe';

import config from '../config';

import { Worker } from '../modules/worker/worker.model';

import Transaction from '../modules/transaction/transaction.model';

import { TRANSACTION_STATUS } from '../modules/transaction/transaction.enum';

import { errorLogger, logger } from '../shared/logger';

import handlePaymentSuccess from './handlePaymentSuccess';

import updateStripeConnectedAccountStatus from './updateStripeAccountConnectedStatus';

const stripe = new Stripe(config.stripe.stripe_secret_key as string);

const handleWebhook = async (req: Request, res: Response) => {
    const endpointSecret = config.stripe.webhook_endpoint_secret;
    const sig = req.headers['stripe-signature'];

    let event: Stripe.Event;

    console.log('Weebhok hittttted');

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig as string,
            endpointSecret as string,
            300
        );
    } catch (err: any) {
        errorLogger.error('Stripe webhook signature verification failed', {
            message: err.message,
        });
        return res.status(400).send(`Webhook signature error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const paymentIntentId = session.payment_intent as string;

                const exists = await Transaction.findOne({
                    stripePaymentIntentId: paymentIntentId,
                });

                if (exists) {
                    logger.info(
                        'checkout.session.completed already processed',
                        { paymentIntentId }
                    );
                    return res.status(200).send('Already processed');
                }

                const paymentIntent =
                    await stripe.paymentIntents.retrieve(paymentIntentId);

                await handlePaymentSuccess(
                    session.metadata,
                    paymentIntent.id,
                    paymentIntent.amount / 100
                );

                logger.info('checkout.session.completed processed', {
                    paymentIntentId,
                });
                break;
            }
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                const metadata = paymentIntent.metadata;
                await handlePaymentSuccess(
                    metadata,
                    paymentIntent.id,
                    paymentIntent.amount / 100
                );

                break;
            }

            case 'transfer.created': {
                const transfer = event.data.object as Stripe.Transfer;

                const worker = await Worker.findOne({
                    stripeAccountId: transfer.destination,
                }).select('_id');

                if (!worker) {
                    errorLogger.error(
                        'Worker not found during transfer.created',
                        {
                            destination: transfer.destination,
                            transferId: transfer.id,
                        }
                    );
                    return res.status(200).send('Worker not found');
                }

                try {
                    await Transaction.create({
                        worker: worker._id,
                        type: 'PENDING',
                        amount: transfer.amount / 100,
                        status: 'COMPLETED',
                        stripeTransferId: transfer.id,
                        stripeEventId: event.id,
                        metadata: transfer.metadata,
                    });

                    logger.info('transfer.created transaction recorded', {
                        transferId: transfer.id,
                        providerId: worker._id,
                    });
                } catch (err: any) {
                    if (err.code === 11000) {
                        logger.info(
                            'transfer.created already processed (duplicate key)',
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

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;

                await Transaction.findOneAndUpdate(
                    { stripePaymentIntentId: paymentIntent.id },
                    { status: TRANSACTION_STATUS.FAILED }
                );

                logger.info(
                    'payment_intent.payment_failed — transaction marked FAILED',
                    {
                        paymentIntentId: paymentIntent.id,
                        userId: paymentIntent.metadata?.userId,
                        subscriptionId: paymentIntent.metadata?.subscriptionId,
                    }
                );

                break;
            }

            default:
                logger.info(`Unhandled webhook event type: ${event.type}`, {
                    eventId: event.id,
                });
        }

        return res.status(200).send('Success');
    } catch (err: any) {
        errorLogger.error('Unexpected error processing webhook event', {
            eventId: event.id,
            eventType: event.type,
            message: err.message,
            stack: err.stack,
        });
        return res.status(500).send('Internal server error');
    }
};

export default handleWebhook;
