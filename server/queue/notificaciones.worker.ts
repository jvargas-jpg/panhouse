import { Worker } from 'bullmq';
import { enviarMensaje } from '../services/whatsapp.service.js';
import { redisConnection } from './connection.js';
import type { NotificacionJobData } from './notificaciones.queue.js';

export const notificacionesWorker = new Worker<NotificacionJobData>(
  'notificaciones',
  async (job) => enviarMensaje(job.data.telefono, job.data.mensaje),
  { connection: redisConnection },
);
