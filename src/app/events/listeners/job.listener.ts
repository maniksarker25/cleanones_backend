import {
  ENUM_NOTIFICATION_TYPE,
  NOTIFICATION_ACTION,
  NOTIFICATION_ENTITY,
} from '../../modules/notification/notification.enum';
import NotificationService from '../../modules/notification/notification.services';
import { errorLogger } from '../../shared/logger';
import { appEventEmitter } from '../eventEmitter';

// Job Accepted → bartender

appEventEmitter.on(
  'job.application.accepted',
  async (payload: { jobId: string; bartender: string; customer: string }) => {
    console.log('Hi from emitter');
    await NotificationService.sendNotification({
      receiver: payload.bartender,
      title: 'Application Accepted 🎉',
      message: `You have been selected for a job`,
      type: '' as any,
      entity: NOTIFICATION_ENTITY.JOB,
      entityId: payload.jobId,
      action: NOTIFICATION_ACTION.VIEW,
      meta: {
        jobId: payload.jobId,
        status: 'ASSIGNED',
      },
    }).catch((err) => {
      errorLogger.error('Job accepted notification failed', err);
    });
  },
);
// Job CREATED → customer

appEventEmitter.on(
  'job.created',
  async (payload: { jobId: string; customer: string }) => {
    await NotificationService.sendNotification({
      receiver: payload.customer,
      title: 'Job Created!',
      message: `Your job is created, please wait for applications`,
      type: '' as any,
      entity: NOTIFICATION_ENTITY.JOB,
      entityId: payload.jobId,
      action: NOTIFICATION_ACTION.LIST,
      meta: {
        jobId: payload.jobId,
        status: 'Created',
      },
    }).catch((err) => {
      errorLogger.error('Job accepted notification failed', err);
    });
  },
);
