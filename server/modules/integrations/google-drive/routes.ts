import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { env } from '../../../config/env.js';
import { requireAuth, requireRole } from '../../../middleware/auth.middleware.js';
import { DRIVE_UI_PATH, googleDriveConfig } from './config.js';
import { DriveIntegrationError, safeDriveError } from './errors.js';
import { googleDriveService } from './service.js';

export const googleDriveRoutes: FastifyPluginAsync = async app => {
  app.addHook('preHandler',requireAuth);
  app.addHook('preHandler',requireRole('direccion','admin'));
  app.addHook('onSend',async (_request,reply,payload)=>{reply.header('Cache-Control','no-store');reply.header('Referrer-Policy','no-referrer');return payload;});
  app.addHook('preHandler',async (request,reply)=>{
    if (request.method !== 'POST') return;
    if(request.user?.rol==='admin'){await reply.code(403).send({error:'Utiliza las acciones auditadas del centro de Administración'});return;}
    const origin = request.headers.origin;
    // Browsers must originate in our configured frontend; non-browser administration remains possible.
    if (origin && origin !== new URL(env.APP_FRONTEND_URL).origin) { await reply.code(403).send({error:'Origen no autorizado'}); return; }
    if (!z.object({}).strict().safeParse(request.body ?? {}).success) await reply.code(400).send({error:'Solicitud inválida'});
  });
  app.setErrorHandler((error,_request,reply)=>{
    const safe = safeDriveError(error);
    void reply.code(safe.statusCode).send({error:safe.message,code:safe.code});
  });
  app.get('/integrations/google-drive/status',async ()=>googleDriveService.status());
  app.post('/integrations/google-drive/connect',async request=>googleDriveService.connect(request.user!.id,request.cookies[env.SESSION_COOKIE_NAME]!));
  app.post('/integrations/google-drive/disconnect',async request=>googleDriveService.disconnect(request.user!.id));
  app.post('/integrations/google-drive/test',async request=>googleDriveService.test(request.user!.id));
  app.get('/auth/google/callback',async (request,reply)=>{
    const config = googleDriveConfig();
    const destination = new URL(request.user!.rol==='admin'?'/admin/integraciones':DRIVE_UI_PATH,config.frontendUrl);
    try {
      const query = z.object({state:z.string().min(32).max(200),code:z.string().min(1).max(4096).optional(),error:z.string().max(100).optional()}).safeParse(request.query);
      if (!query.success) throw new DriveIntegrationError('INVALID_STATE',400);
      await googleDriveService.callback({userId:request.user!.id,sessionToken:request.cookies[env.SESSION_COOKIE_NAME]!,state:query.data.state,
        code:query.data.code,denied:!!query.data.error});
      destination.searchParams.set('googleDrive','connected');
    } catch(error) { destination.searchParams.set('googleDriveError',safeDriveError(error).code); }
    return reply.redirect(destination.toString());
  });
};
