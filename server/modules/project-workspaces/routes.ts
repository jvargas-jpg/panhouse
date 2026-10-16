import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireAuth,requireRole } from '../../middleware/auth.middleware.js';
import { ErrorFichaViva } from '../../helpers/fichaViva.js';
import { safeDriveError } from '../integrations/google-drive/errors.js';
import { workspaceErrorMessage } from './queries.js';
import { WorkspaceError } from './errors.js';
import { getProjectWorkspace,getProjectWorkspaceFolders,projectWorkspaceService } from './service.js';
import { configureDevProjectsRoot } from './root.js';
const params=z.object({projectId:z.string().uuid()});
export const projectWorkspaceRoutes:FastifyPluginAsync=async app=>{
  app.addHook('preHandler',requireAuth);
  app.addHook('onSend',async(_req,reply,payload)=>{reply.header('Cache-Control','no-store');return payload;});
  app.addHook('preHandler',async(req,reply)=>{
    if(req.method!=='POST')return;
    if(req.headers.origin&&req.headers.origin!==new URL(env.APP_FRONTEND_URL).origin){await reply.code(403).send({error:'Origen no autorizado'});return;}
    z.object({}).strict().parse(req.body??{});
  });
  app.setErrorHandler((error,_req,reply)=>{
    if(error instanceof z.ZodError)return reply.code(400).send({error:'Solicitud documental inválida'});
    if(error instanceof WorkspaceError)return reply.code(error.statusCode).send({error:error.message,code:error.code});
    if(error instanceof ErrorFichaViva)return reply.code(error.status).send({error:error.message});
    const safe=safeDriveError(error);return reply.code(safe.statusCode).send({error:workspaceErrorMessage(safe.code),code:safe.code});
  });
  app.get('/proyectos/:projectId/workspace',async req=>getProjectWorkspace(params.parse(req.params).projectId,req.user!));
  app.get('/proyectos/:projectId/workspace/folders',async req=>({folders:await getProjectWorkspaceFolders(params.parse(req.params).projectId,req.user!)}));
  for(const suffix of ['','/retry'])app.post('/proyectos/:projectId/workspace'+suffix,async req=>projectWorkspaceService.create(params.parse(req.params).projectId,req.user!));
  app.post('/integrations/google-drive/projects-root',{preHandler:requireRole('direccion')},async req=>configureDevProjectsRoot(req.user!));
};
