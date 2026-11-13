import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { loadProjectExperiences, operationHome } from '../helpers/projectExperiences.js';
import type { GuidedPortfolio } from '../../shared/projectPortfolio.js';
export async function projectGuideRoutes(app:FastifyInstance) {
 const guard={preHandler:[requireAuth,requireRole('especialista','jefe_area')]};
 app.get('/guia-inicio',guard,async req=>operationHome(await loadProjectExperiences(req.user!),req.user!.rol as 'especialista'|'jefe_area'));
 app.get('/guia-portafolio',guard,async(req,reply):Promise<GuidedPortfolio|unknown>=>{
  const parsed=z.object({search:z.string().max(160).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),state:z.enum(['all','risk','closed','waiting','actionable','blocked']).default('all')}).safeParse(req.query);
  if(!parsed.success)return reply.code(400).send({error:'Filtros inválidos'});
  const f=parsed.data,model=await loadProjectExperiences(req.user!);
  const items=model.entries.map(e=>e.summary).filter(p=>{
   if(f.search&&!`${p.authors} ${p.title} ${p.code} ${p.specialist??''} ${p.service}`.toLocaleLowerCase().includes(f.search.toLocaleLowerCase()))return false;
   const closed=['culminado','retirado'].includes(p.macroState);
   if(f.state==='closed')return closed;
   if(closed)return false;
   const paths=[p.mainProcess,...p.parallelProcesses].filter(Boolean);
   return f.state==='risk'?p.risks.length>0:f.state==='waiting'?paths.some(p=>p!.waitingFor):f.state==='actionable'?p.actionable:f.state==='blocked'?paths.some(p=>p!.state==='Bloqueado'):true;
  }).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||(req.user!.rol==='especialista'?Number(b.actionable)-Number(a.actionable):0)||(a.dueAt??'z').localeCompare(b.dueAt??'z')||a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(items.length/10)),page=Math.min(f.page,pages);
  return {items:items.slice((page-1)*10,page*10),page,pages,total:items.length};
 });
}
