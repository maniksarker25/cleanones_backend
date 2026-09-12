import { ENUM_NOTIFICATION_TYPE } from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';
import { appEventEmitter } from '../eventEmitter';

// ORDER CREATED
appEventEmitter.on('order.created', async (payload) => {
  // bartender
  NotificationService.sendNotification({
    receiver: payload.bartender,
    title: 'New Order',
    message: `New order received (#${payload.orderCode})`,
    type: 'ORDER_CREATED',
    entity: 'ORDER',
    entityId: payload.orderId,
    action: 'LIST',
  });

  // customer
  NotificationService.sendNotification({
    receiver: payload.customer,
    title: 'Order Placed',
    message: `Your order has been placed (#${payload.orderCode})`,
    type: 'ORDER_CREATED',
    entity: 'ORDER',
    entityId: payload.orderId,
    action: 'LIST',
  });
});

// TIP RECEIVED
appEventEmitter.on('order.tip.received', async (payload) => {
  NotificationService.sendNotification({
    receiver: payload.bartender,
    title: 'Tip Received 💰',
    message: `You received a tip of $${payload.amount}`,
    type: '' as any,
    entity: 'ORDER',
    entityId: payload.orderId,
    action: 'VIEW',
  });
});
