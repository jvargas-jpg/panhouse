import { obtenerDashboardJefatura } from './jefatura.js';
import { projectGuide, guideProcesses } from './projectGuide.js';
import { projectWorkflowFactsMany } from './finalPackage.js';
import { proyectarPreparacion } from './preparacionInicial.js';
import { contextosActivacion } from './solicitudesArea.js';
import { editorialInterventions } from './editorialChief.js';
import { getProjectFinancialStatuses } from './estadoFinanciero.js';
import { emptyWorkspace, workspaceSummaries } from '../modules/project-workspaces/queries.js';
import { clasificarVencimiento } from './especialistaInicio.js';
import type { Rol } from '../db/schema/index.js';
import type { GuidedProjectSummary } from '../../shared/projectPortfolio.js';
import type { OperationHome, OperationItem } from '../../shared/operationHome.js';

/** All three experiences use this read model. Query count does not grow per project. */
export async function loadProjectExperiences(actor: {id:string;rol:Rol}, now=new Date()) {
 const snapshot=await obtenerDashboardJefatura(now,{historico:true,incluirRetirados:true,...(actor.rol==='especialista'?{especialistaId:actor.id}:{})});
 const ids=snapshot.proyectos.map(p=>p.id);
 const [facts,workspaces,activations,editorial,financial]=await Promise.all([
  projectWorkflowFactsMany(ids),workspaceSummaries(ids),contextosActivacion(ids),
  ids.length?editorialInterventions(undefined,undefined,undefined,undefined,true,undefined,ids):Promise.resolve([]),getProjectFinancialStatuses(ids),
 ]);
 const factMap=new Map(facts.map(f=>[f.p.id,f]));
 const entries=await Promise.all(snapshot.proyectos.map(async p=>{
  const f=factMap.get(p.id)!;
  const assignment=f.assignments.find(a=>a.tipo==='especialista'&&!a.workItemId&&!a.finalizadoEn);
  const prep=f.preparation[0];
  const preparation=proyectarPreparacion(prep,assignment?.asignadoEn??null,actor.rol==='especialista',workspaces.get(p.id)??emptyWorkspace());
  const guide=await projectGuide(p.id,{preparacion:preparation,procesos:guideProcesses(f,activations.get(p.id)??[])},actor,{facts:f,editorial:editorial.filter(i=>i.projectId===p.id),financial:financial.get(p.id)});
  const main=guide.paths.find(path=>path.id===guide.currentPath)??null;
  const started=!!(prep?.recibidoEn||prep?.expedienteRevisadoEn||prep?.primerContactoEn||prep?.reunionOperativaRealizada||prep?.minutaUrl||prep?.cronogramaUrl||prep?.grabacionUrl||prep?.transcripcionUrl)||f.works.some(w=>!['intake_rrpp','asignacion_especialista','preparacion_inicial'].includes(w.tipo));
  const newAssignment=assignment&&!started?{assignedAt:assignment.asignadoEn.toISOString(),nextStep:'Recibir y revisar expediente'}:null;
  const risks:GuidedProjectSummary['risks']=guide.paths.filter(path=>path.dueAt&&clasificarVencimiento(path.dueAt,now).vencido).map(path=>{
   const due=path.dueAt!.length===10?Date.parse(path.dueAt!+'T23:59:59-04:00'):Date.parse(path.dueAt!);
   const days=Math.floor((now.getTime()-due)/86400000);
   return {processId:path.id,message:`${path.label}: ${path.waitingFor??'Especialista'} ${days>0?`lleva ${days} día${days===1?'':'s'} de retraso`:'tiene el plazo vencido'} · ${path.currentStep}`};
  });
  if(p.riesgo.causas.includes('Plazo operativo excedido'))risks.push({processId:null,message:`Plazo operativo excedido tras ${p.riesgo.diasEfectivos} días efectivos. Revisar el cronograma con el Especialista.`});
  if(p.estado==='retrasado'&&!risks.length)risks.push({processId:null,message:'Proyecto marcado como retrasado. Revisar el motivo registrado y acordar el siguiente paso con el Especialista.'});
  for(const work of f.works.filter(w=>w.estado==='bloqueado'&&w.gateBloqueante))if(!risks.some(r=>r.processId===work.tipo))risks.push({processId:work.tipo,message:`${guide.paths.find(p=>p.id===work.tipo)?.label??work.tipo}: ${work.gateBloqueante}`});
  if(!p.riesgo.vencido&&p.riesgo.atencion&&p.riesgo.causas.includes('80% del plazo operativo consumido'))risks.push({processId:null,message:`Se consumió el 80% del plazo operativo; quedan ${p.riesgo.diasRestantes} días. Revisar el cronograma y los procesos pendientes.`});
  const decisions=f.decisions.filter(d=>['pendiente','en_revision'].includes(d.status));
  const chiefAction=guide.supervisionActions.length>0||['posible','pendiente_clasificacion'].includes(p.express.estado);
  const summary:GuidedProjectSummary={id:p.id,title:f.p.tituloDefinitivo??f.p.titulo??p.titulo??'Proyecto editorial',authors:p.autores,code:p.codigo,service:p.servicio.nombre,specialist:p.especialista?.nombre??null,macroState:p.estado,
   alert:risks[0]?.message??decisions[0]?.subject??null,overdue:p.riesgo.causas.includes('Plazo operativo excedido')||guide.paths.some(path=>path.dueAt&&clasificarVencimiento(path.dueAt,now).vencido),dueAt:p.fechaObjetivo??null,actionable:actor.rol==='especialista'?guide.requiresUserAction:chiefAction,
   mainProcess:main,parallelProcesses:guide.paths.filter(path=>path.id!==main?.id&&path.id!=='preparacion_inicial'&&path.state!=='Completado'&&(path.requiresAction||path.waitingFor||f.works.some(w=>w.tipo===path.id&&!['completado','cancelado'].includes(w.estado)))),risks,nextMilestones:guide.nextMilestones,newAssignment};
  return {summary,guide,facts:f,project:p};
 }));
 return {entries,snapshot};
}
export function operationHome(model:Awaited<ReturnType<typeof loadProjectExperiences>>,role:'especialista'|'jefe_area',now=new Date()):OperationHome {
 const active=model.entries.filter(e=>!['culminado','retirado'].includes(e.summary.macroState));
 const actions:OperationItem[]=[], waiting:OperationItem[]=[];
 for(const e of active)for(const path of e.guide.paths){
  const item:OperationItem={project:e.summary,process:path,reason:path.delivery?'Hay una entrega recibida que requiere tu gestión.':path.instruction,overdue:!!path.dueAt&&clasificarVencimiento(path.dueAt,now).vencido,availableElsewhere:e.guide.paths.filter(p=>p.canOperate&&p.id!==path.id).length};
  if(path.canOperate&&!e.summary.newAssignment)actions.push(item);
  if(path.waitingFor)waiting.push(item);
 }
 const byDue=(a:OperationItem,b:OperationItem)=>Number(b.overdue)-Number(a.overdue)||(a.process.dueAt??'z').localeCompare(b.process.dueAt??'z')||a.project.id.localeCompare(b.project.id)||a.process.id.localeCompare(b.process.id);
 const interventions:OperationHome['interventions']=active.flatMap(e=>[
  ...e.guide.supervisionActions.map(a=>({id:a.id,projectId:e.summary.id,title:e.summary.title,reason:a.label,href:a.href,kind:a.kind})),
  ...(['posible','pendiente_clasificacion'].includes(e.project.express.estado)?[{id:e.summary.id+':express',projectId:e.summary.id,title:e.summary.title,reason:'Definir ejecución Express o confirmar el plazo estándar',href:'/?vista=asignaciones&proyecto='+e.summary.id,kind:'decision' as const}]:[]),
 ]);
 return {role,summary:{active:active.length,actionable:active.filter(e=>e.summary.actionable).length,waiting:active.filter(e=>e.guide.waitingOn.length>0).length,overdue:active.filter(e=>e.summary.overdue).length,newAssignments:active.filter(e=>e.summary.newAssignment).length},actions:actions.sort(byDue),waiting:waiting.sort(byDue),newAssignments:active.filter(e=>e.summary.newAssignment).map(e=>e.summary).sort((a,b)=>b.newAssignment!.assignedAt.localeCompare(a.newAssignment!.assignedAt)),risks:active.flatMap(e=>e.summary.risks.map(r=>({projectId:e.summary.id,title:e.summary.title,...r}))),interventions,team:role==='jefe_area'?model.snapshot.teamCapacity:[]};
}
