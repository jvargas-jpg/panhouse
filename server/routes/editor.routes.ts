import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db, pool } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { proyectos } from '../db/schema/index.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';
import { getEditorDashboard } from '../helpers/editorDashboard.js';
import { listarMiTrabajo, obtenerDetalleMiTrabajo } from '../helpers/editorWork.js';
import { iniciarTrabajoEditorial, registrarEntregaEditorial, registrarAvanceEditorial } from '../helpers/editorialDeliveries.js';
import { listEditorialDriveFiles, uploadEditorialDriveFile } from '../helpers/editorDrive.js';
import { reportarBloqueoEditorial, resolverBloqueoEditorial } from '../helpers/editorialBlockers.js';
import { cancelarRequestEditor, crearRequestEditor, listarRequestsEditor, obtenerRequestEditorDetalle, responderRequestEditor, decidirRequestEditor, listarAclaracionesRecibidas } from '../helpers/editorOwnRequests.js';
import { listarProyectosEdicion, obtenerProyectoEdicionDetalle } from '../helpers/editorialProjects.js';
import { EDITOR_REQUEST_TYPES } from '../../shared/editorOwn.js';
const idSchema=z.object({id:z.string().uuid()});
export async function editorRoutes(app: FastifyInstance) {
  const self={preHandler:[requireAuth,requireRole('editor')]};
  const miTrabajoFilters=z.object({tab:z.enum(['all','today','inProgress','feedback','waiting','completed']).default('all'),search:z.string().max(150).default(''),status:z.string().max(80).optional(),risk:z.enum(['dueSoon','overdue']).optional(),service:z.string().uuid().optional(),interventionType:z.string().max(200).optional(),project:z.string().uuid().optional(),date:z.string().date().optional(),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().refine(n=>[10,25,50].includes(n)).default(10)});
  app.get('/mi-inicio',self,async(req)=>getEditorDashboard(req.user!.id));
  app.get('/mi-trabajo',self,async(req,reply)=>{const f=parseOrReply(miTrabajoFilters,req.query,reply);if(!f)return;return listarMiTrabajo(req.user!.id,{...f,tab:f.tab??'all',search:f.search??'',page:f.page??1,pageSize:f.pageSize??10});});
  app.get('/mi-trabajo/:id',self,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply);if(!p)return;
    const detail=await obtenerDetalleMiTrabajo(p.id,req.user!.id);if(!detail)return reply.code(404).send({error:'Trabajo no encontrado'});
    return detail;
  });
  app.post('/mi-trabajo/:id/iniciar',self,async(req,reply)=>{const p=parseOrReply(idSchema,req.params,reply);if(!p)return;await iniciarTrabajoEditorial(p.id,req.user!.id);return {ok:true};});
  app.patch('/mi-trabajo/:id/entrega',self,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({driveUrl:z.string().trim().url().max(2000),observaciones:z.string().trim().max(1000).optional()}),req.body,reply);if(!p||!body)return;
    const delivery=await registrarEntregaEditorial(p.id,body.driveUrl,req.user!.id,body.observaciones);
    return {ok:true,deliveryId:delivery.id};
  });
  app.post('/mi-trabajo/:id/bloqueo',self,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({reason:z.string().trim().min(5).max(1000)}),req.body,reply);if(!p||!body)return;
    const blocker=await reportarBloqueoEditorial(p.id,body.reason,req.user!.id);
    return {ok:true,blockerId:blocker.id};
  });
  app.post('/mi-trabajo/:id/bloqueo/resolver',{preHandler:[requireAuth,requireRole('editor','jefe_edicion')]},async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({resolution:z.string().trim().max(1000).optional()}),req.body,reply);if(!p||!body)return;
    await resolverBloqueoEditorial(p.id,req.user!,body.resolution);
    return {ok:true};
  });
  const misProyectosFilters=z.object({specialist:z.string().uuid().optional(),participation:z.enum(['active','history']).optional(),search:z.string().max(150).default(''),service:z.string().uuid().optional(),state:z.string().max(40).optional(),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().refine(n=>[10,25,50].includes(n)).default(10),sort:z.enum(['activity','delivery','title','state','editor']).default('activity')});
  app.get('/mis-proyectos',self,async(req,reply)=>{const f=parseOrReply(misProyectosFilters,req.query,reply);if(!f)return;return listarProyectosEdicion({...f,search:f.search??'',page:f.page??1,pageSize:f.pageSize??10,sort:f.sort??'activity',editor:req.user!.id});});
  app.get('/mis-proyectos/:projectId',self,async(req,reply)=>{
    const p=parseOrReply(z.object({projectId:z.string().uuid()}),req.params,reply);if(!p)return;
    const [proyecto]=await db.select({editorId:proyectos.editorId}).from(proyectos).where(eq(proyectos.id,p.projectId));
    const participation=await pool.query('SELECT id FROM project_assignments WHERE proyecto_id=$1 AND usuario_id=$2 AND tipo=\'editor\' LIMIT 1',[p.projectId,req.user!.id]);
    if(!proyecto||(proyecto.editorId!==req.user!.id&&!participation.rowCount))return reply.code(404).send({error:'Proyecto no encontrado'});
    const detail=await obtenerProyectoEdicionDetalle(p.projectId,new Date(),req.user!.id);if(!detail)return reply.code(404).send({error:'Proyecto no encontrado'});
    detail.drive.rootUrl=detail.drive.links.find(l=>l.key==='EDITING')?.url??null;
    return detail;
  });
  const misSolicitudesFilters=z.object({search:z.string().max(150).default(''),type:z.enum(EDITOR_REQUEST_TYPES).optional(),project:z.string().uuid().optional(),tab:z.enum(['all','pending','resolved','returned','cancelled']).default('all'),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().refine(n=>[10,25,50].includes(n)).default(10)});
  app.get('/mis-solicitudes',self,async(req,reply)=>{const f=parseOrReply(misSolicitudesFilters,req.query,reply);if(!f)return;return listarRequestsEditor(req.user!.id,f.tab??'all',f.page??1,f.pageSize??10,f);});
  app.post('/mis-solicitudes',self,async(req,reply)=>{
    const body=parseOrReply(z.object({workItemId:z.string().uuid(),type:z.enum(EDITOR_REQUEST_TYPES),motivo:z.string().trim().min(5).max(1000)}),req.body,reply);if(!body)return;
    const row=await crearRequestEditor(req.user!.id,body.workItemId,body.type,body.motivo);
    return {ok:true,id:row.id};
  });
  app.get('/mis-solicitudes/:id',self,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply);if(!p)return;
    const detail=await obtenerRequestEditorDetalle(p.id,req.user!.id);if(!detail)return reply.code(404).send({error:'Solicitud no encontrada'});
    return detail;
  });
  app.post('/mis-solicitudes/:id/cancelar',self,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({expectedVersion:z.number().int().positive()}),req.body,reply);if(!p||!body)return;
    return cancelarRequestEditor(p.id,req.user!.id,body.expectedVersion);
  });
  app.post('/solicitudes-editor/:id/decidir',{preHandler:[requireAuth,requireRole('jefe_edicion','especialista')]},async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({expectedVersion:z.number().int().positive(),action:z.enum(['review','return','resolve']),text:z.string().trim().min(5).max(1000)}),req.body,reply);if(!p||!body)return;
    return decidirRequestEditor(p.id,req.user!,body.expectedVersion,body.action,body.text);
  });
  app.get('/aclaraciones-recibidas',{preHandler:[requireAuth,requireRole('especialista')]},async req=>listarAclaracionesRecibidas(req.user!.id));
  app.post('/mi-trabajo/:id/avance',self,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({note:z.string().trim().min(5).max(1000)}),req.body,reply);if(!p||!body)return;
    await registrarAvanceEditorial(p.id,req.user!.id,body.note);return {ok:true};
  });
  app.get('/mi-trabajo/:id/archivos',self,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),f=parseOrReply(z.object({folderKey:z.string().max(80),pageToken:z.string().max(2000).optional()}),req.query,reply);if(!p||!f)return;
    return listEditorialDriveFiles(p.id,req.user!.id,f.folderKey,f.pageToken);
  });
  app.post('/mi-trabajo/:id/archivos',{...self,bodyLimit:12_100_000},async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({folderKey:z.string().max(80),name:z.string().min(1).max(180),mimeType:z.string().max(150),contentBase64:z.string().max(12_000_000)}),req.body,reply);if(!p||!body)return;
    return uploadEditorialDriveFile(p.id,req.user!.id,body);
  });
  app.post('/mis-solicitudes/:id/responder',self,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({expectedVersion:z.number().int().positive(),text:z.string().trim().min(5).max(1000)}),req.body,reply);if(!p||!body)return;
    return responderRequestEditor(p.id,req.user!.id,body.expectedVersion,body.text);
  });
}
