import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export interface NotificacionJobData {
  telefono: string;
  mensaje: string;
}

export const notificacionesQueue = new Queue<NotificacionJobData>('notificaciones', {
  connection: redisConnection,
});
