import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { editorialActivity, editorialDashboard, editorialInterventions } from '../helpers/editorialChief.js';
import { parseOrReply } from '../helpers/validate.js';
import { asignarEditor } from '../helpers/proyectos.js';
import { actualizarCapituloEditor } from '../helpers/capitulos.js';
import { getEditorLoadSummary, listarAsignacionesEdicion, recommendEditorsForIntervention } from '../helpers/editorialAssignments.js';
import { csvProyectosEdicion, listarProyectosEdicion, obtenerProyectoEdicionDetalle } from '../helpers/editorialProjects.js';
import { csvSeguimientoEdicion, listarSeguimientoEdicion, obtenerSeguimientoDetalle } from '../helpers/editorialTracking.js';
import { listarSolicitudesEdicion, obtenerSolicitudEdicionDetalle } from '../helpers/editorialRequests.js';
const idSchema=z.object({id:z.string().uuid()});
const filters=z.object({editor:z.string().uuid().optional(),project:z.string().uuid().optional(),filter:z.enum(['all','unassigned','overdue','risk','upcoming','waiting']).default('all'),search:z.string().max(150).default(''),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().min(1).max(50).default(20)});
export async function editorialChiefRoutes(app:FastifyInstance){
  const chief={preHandler:[requireAuth,requireRole('jefe_edicion')]};
  app.get('/inicio',chief,async()=>editorialDashboard());
  app.get('/actividad',chief,async()=>({items:await editorialActivity()}));
  app.get('/asignaciones',chief,async(req,reply)=>{
    const f=parseOrReply(z.object({tab:z.enum(['unassigned','editing','waiting','overdue','all']).default('unassigned'),search:z.string().max(150).default(''),service:z.string().uuid().optional(),interventionType:z.string().max(200).optional(),specialist:z.string().uuid().optional(),editor:z.string().uuid().optional(),date:z.string().date().optional(),status:z.string().max(80).optional(),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().refine(n=>[10,25,50].includes(n)).default(10),sort:z.enum(['due','oldest','project']).default('due')}),req.query,reply);
    if(!f)return;return listarAsignacionesEdicion({...f,tab:f.tab??'unassigned',search:f.search??'',page:f.page??1,pageSize:f.pageSize??10,sort:f.sort??'due'});
  });
  app.get('/equipo',chief,async()=>getEditorLoadSummary());
  const projectFilters=z.object({search:z.string().max(150).default(''),service:z.string().uuid().optional(),state:z.string().max(40).optional(),editor:z.string().uuid().optional(),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().refine(n=>[10,25,50].includes(n)).default(10),sort:z.enum(['activity','delivery','title','state','editor']).default('activity')});
  app.get('/proyectos',chief,async(req,reply)=>{const f=parseOrReply(projectFilters,req.query,reply);if(!f)return;return listarProyectosEdicion({...f,search:f.search??'',page:f.page??1,pageSize:f.pageSize??10,sort:f.sort??'activity'});});
  app.get('/proyectos/export.csv',chief,async(_req,reply)=>reply.type('text/csv; charset=utf-8').header('Content-Disposition',`attachment; filename="proyectos-edicion-${new Date().toISOString().slice(0,10)}.csv"`).send(await csvProyectosEdicion()));
  app.get('/proyectos/:projectId',chief,async(req,reply)=>{
    const p=parseOrReply(z.object({projectId:z.string().uuid()}),req.params,reply);if(!p)return;
    const detail=await obtenerProyectoEdicionDetalle(p.projectId);if(!detail)return reply.code(404).send({error:'Proyecto sin proceso de Edición registrado'});
    return detail;
  });
  const trackingFilters=z.object({tab:z.enum(['priority','overdue','risk','blocked','editing','waiting','all']).default('priority'),search:z.string().max(150).default(''),service:z.string().uuid().optional(),status:z.string().max(40).optional(),editor:z.string().uuid().optional(),responsible:z.enum(['editor','autor','especialista']).optional(),interventionType:z.string().max(200).optional(),from:z.string().date().optional(),to:z.string().date().optional(),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().refine(n=>[10,25,50].includes(n)).default(10),sort:z.enum(['due','status','editor','project']).default('due')});
  app.get('/seguimiento',chief,async(req,reply)=>{const f=parseOrReply(trackingFilters,req.query,reply);if(!f)return;return listarSeguimientoEdicion({...f,search:f.search??'',page:f.page??1,pageSize:f.pageSize??10,sort:f.sort??'due',tab:f.tab??'priority'});});
  app.get('/seguimiento/export.csv',chief,async(req,reply)=>{
    const f=parseOrReply(trackingFilters.omit({page:true,pageSize:true}),req.query,reply);if(!f)return;
    const csv=await csvSeguimientoEdicion({...f,search:f.search??'',sort:f.sort??'due',tab:f.tab??'priority'});
    return reply.type('text/csv; charset=utf-8').header('Content-Disposition',`attachment; filename="seguimiento-edicion-${new Date().toISOString().slice(0,10)}.csv"`).send(csv);
  });
  app.get('/seguimiento/:id',chief,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply);if(!p)return;
    const detail=await obtenerSeguimientoDetalle(p.id);if(!detail)return reply.code(404).send({error:'Intervención de Edición no encontrada'});
    return detail;
  });
  const requestFilters=z.object({tab:z.enum(['pending','resolved','all']).default('pending'),search:z.string().max(150).default(''),service:z.string().uuid().optional(),requester:z.string().uuid().optional(),from:z.string().date().optional(),to:z.string().date().optional(),page:z.coerce.number().int().min(1).max(10000).default(1),pageSize:z.coerce.number().int().refine(n=>[10,25,50].includes(n)).default(10),sort:z.enum(['oldest','newest','project']).default('oldest')});
  app.get('/solicitudes',chief,async(req,reply)=>{const f=parseOrReply(requestFilters,req.query,reply);if(!f)return;return listarSolicitudesEdicion({...f,search:f.search??'',page:f.page??1,pageSize:f.pageSize??10,sort:f.sort??'oldest',tab:f.tab??'pending'});});
  app.get('/solicitudes/:id',chief,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply);if(!p)return;
    const detail=await obtenerSolicitudEdicionDetalle(p.id);if(!detail)return reply.code(404).send({error:'Solicitud no encontrada'});
    return detail;
  });
  app.get('/intervenciones/:id/candidatos',chief,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply);if(!p)return;
    if(!(await editorialInterventions(undefined,undefined,undefined,p.id))[0])return reply.code(404).send({error:'Intervención de Edición no encontrada'});
    return recommendEditorsForIntervention(await getEditorLoadSummary());
  });
  app.get('/intervenciones',chief,async(req,reply)=>{
    const parsed=parseOrReply(filters,req.query,reply);if(!parsed)return;const f=filters.parse(parsed);
    const rows=(await editorialInterventions(undefined,f.project,f.editor)).filter(i=>(`${i.title} ${i.authors} ${i.code} ${i.label}`.toLocaleLowerCase('es').includes(f.search.toLocaleLowerCase('es')))&&
      (f.filter==='all'||f.filter==='unassigned'&&i.needsAssignment||f.filter==='overdue'&&i.overdue||f.filter==='risk'&&i.atRisk||f.filter==='upcoming'&&i.actionable&&i.dueDate&&!i.overdue||f.filter==='waiting'&&i.state.startsWith('Esperando')))
      .sort((a,b)=>(a.dueDate??'9999').localeCompare(b.dueDate??'9999')||a.id.localeCompare(b.id));
    const pages=Math.max(1,Math.ceil(rows.length/f.pageSize)),page=Math.min(f.page,pages);
    return {items:rows.slice((page-1)*f.pageSize,page*f.pageSize),total:rows.length,pages,page};
  });
  app.get('/intervenciones/:id',chief,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply);if(!p)return;
    const item=(await editorialInterventions(undefined,undefined,undefined,p.id))[0];if(!item)return reply.code(404).send({error:'Intervención de Edición no encontrada'});
    return item;
  });
  app.patch('/asignaciones/:id',chief,async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({editorId:z.string().uuid(),reason:z.string().trim().min(5).max(1000).optional(),expectedEditorId:z.string().uuid().nullable().optional(),expectedAssignmentId:z.string().uuid().nullable().optional()}),req.body,reply);if(!p||!body)return;
    const item=(await editorialInterventions(undefined,undefined,undefined,p.id))[0];if(!item)return reply.code(404).send({error:'Intervención de Edición no encontrada'});
    if(!item.needsAssignment&&!item.editorId)return reply.code(409).send({error:'No hay solicitud de Editor lista para asignar'});
    const expectedEditorId=body.expectedEditorId===undefined?item.editorId:body.expectedEditorId;
    if(expectedEditorId&&expectedEditorId!==body.editorId&&!body.reason)return reply.code(400).send({error:'Indica el motivo de reasignación'});
    const recommendation=recommendEditorsForIntervention(await getEditorLoadSummary());
    const selected=recommendation.candidates.find(e=>e.id===body.editorId);
    await asignarEditor(item.projectId,body.editorId,req.user!.id,body.reason,expectedEditorId,{interventionId:item.id,workItemId:item.workItemId,expectedAssignmentId:body.expectedAssignmentId,
      recommendation:{rule:recommendation.rule,observedAt:recommendation.observedAt,recommendedIds:recommendation.recommendedIds,manualOverride:!recommendation.recommendedIds.includes(body.editorId),selectedFacts:selected?{actionableNow:selected.actionableNow,overdue:selected.overdue,dueThisWeek:selected.dueThisWeek,waitingThirdParty:selected.waitingThirdParty}:{}}});
    return {ok:true};
  });
  app.get('/mi-trabajo',{preHandler:[requireAuth,requireRole('editor')]},async(req)=>({items:await editorialInterventions(undefined,undefined,req.user!.id)}));
  app.patch('/mi-trabajo/:id/entrega',{preHandler:[requireAuth,requireRole('editor')]},async(req,reply)=>{
    const p=parseOrReply(idSchema,req.params,reply),body=parseOrReply(z.object({date:z.string().date()}),req.body,reply);if(!p||!body)return;
    const item=(await editorialInterventions(undefined,undefined,req.user!.id,p.id))[0];
    if(!item)return reply.code(404).send({error:'Trabajo no encontrado'});
    if(!item.chapter||!item.actionable)return reply.code(409).send({error:'Esta intervención no admite entrega de capítulo'});
    await actualizarCapituloEditor(item.projectId,item.chapter,{fechaEntregaEditor:body.date},req.user!.id);
    return {ok:true};
  });
}
