import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { obtenerDashboardJefatura } from '../helpers/jefatura.js';
import { obtenerCommandCenter } from '../helpers/projectCommandCenter.js';
import type { GuidedPortfolio } from '../../shared/projectPortfolio.js';
export async function projectGuideRoutes(app: FastifyInstance) {
 app.get('/guia-portafolio', { preHandler: [requireAuth,requireRole('especialista','jefe_area')] }, async (req,reply): Promise<GuidedPortfolio | unknown> => {
  const parsed=z.object({search:z.string().max(160).default(''),page:z.coerce.number().int().min(1).default(1),state:z.enum(['all','risk','closed']).default('all')}).safeParse(req.query);
  if(!parsed.success)return reply.code(400).send({error:'Filtros inválidos'});
  const f=parsed.data, actor=req.user!;
  const snapshot=await obtenerDashboardJefatura(new Date(),{historico:true,incluirRetirados:true,...(actor.rol==='especialista'?{especialistaId:actor.id}:{})});
  const projects=snapshot.proyectos.filter(p=>(!f.search || `${p.autores} ${p.titulo} ${p.codigo}`.toLocaleLowerCase().includes(f.search.toLocaleLowerCase())) && (f.state==='risk'?p.riesgo.atencion:f.state==='closed'?['culminado','retirado'].includes(p.estado):!['culminado','retirado'].includes(p.estado)));
  projects.sort((a,b)=>Number(b.riesgo.atencion)-Number(a.riesgo.atencion)||(a.fechaObjetivo??'z').localeCompare(b.fechaObjetivo??'z')||a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(projects.length/10)),page=Math.min(f.page,pages);
  const items=await Promise.all(projects.slice((page-1)*10,page*10).map(async p=>{
   const data=await obtenerCommandCenter(p.id,actor), guide=data.guide!;
   const current=guide.paths.find(path=>path.id===guide.currentPath);
   return {id:p.id,title:data.ficha.project.title,authors:p.autores,code:p.codigo,service:p.servicio.nombre,specialist:p.especialista?.nombre??null,macroState:p.estado,position:guide.position,responsible:current?.responsible??'Especialista',waitingFor:[...new Set(guide.paths.flatMap(path=>path.waitingFor?[path.waitingFor]:[]))],nextMilestone:guide.nextMilestone,alert:data.atencion[0]?.titulo??p.riesgo.causas[0]??null,overdue:p.riesgo.vencido,dueAt:p.fechaObjetivo??null,actionable:guide.paths.some(path=>path.canOperate)};
  }));
  if(actor.rol==='especialista')items.sort((a,b)=>Number(b.actionable)-Number(a.actionable));
  return {items,page,pages,total:projects.length};
 });
}
