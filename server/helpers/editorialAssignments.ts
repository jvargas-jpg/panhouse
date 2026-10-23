import { pool } from '../db/client.js';
import { editorialInterventions } from './editorialChief.js';
import { diaCaracas } from './atencionEspecialista.js';
import type { EditorialAssignmentFilters, EditorialAssignmentList, EditorialAssignmentTab, EditorialEditorLoad, EditorialIntervention, EditorialLoadSummary, EditorialRecommendation } from '../../shared/editorialChief.js';

export const EDITORIAL_RECOMMENDATION_RULE = 'editorial-descriptive-v1' as const;
// The service complexity weight belongs to Specialist project portfolios, not
// Editor interventions. No capacity, weighted effort or availability is inferred.
const LIMITATIONS = 'Comparación descriptiva: no mide horas, complejidad, capacidad máxima ni disponibilidad. La decisión corresponde al Jefe de Edición.';
export const editorialTypeName = (type: string) => ({default:'Inicio de edición',chapter:'Capítulo',feedback:'Aplicación de feedback'}[type] ?? type.replace(/^step:/,'').replaceAll('_',' '));

function inTab(item: EditorialIntervention, tab: EditorialAssignmentTab) {
  if (tab === 'unassigned') return item.needsAssignment;
  if (tab === 'editing') return item.actionable;
  if (tab === 'waiting') return !!item.waitingOn;
  if (tab === 'overdue') return item.overdue;
  return true;
}

export async function listarAsignacionesEdicion(filters: EditorialAssignmentFilters, now = new Date()): Promise<EditorialAssignmentList> {
  const items = await editorialInterventions(diaCaracas(now));
  const options: EditorialAssignmentList['options'] = { services: [], interventionTypes: [], specialists: [], editors: [], states: [] };
  const services = new Map<string,string>(), types = new Map<string,string>(), specialists = new Map<string,string>(), editors = new Map<string,string>();
  for (const i of items) {
    if (i.serviceId) services.set(i.serviceId, i.service.split(' · ')[0]!);
    if (i.interventionType) types.set(i.interventionType, editorialTypeName(i.interventionType));
    if (i.requestedById && i.requestedBy) specialists.set(i.requestedById, i.requestedBy);
    if (i.editorId && i.editor) editors.set(i.editorId, i.editor);
  }
  const choices = (map: Map<string,string>) => [...map].map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,'es')||a.id.localeCompare(b.id));
  options.services=choices(services); options.interventionTypes=choices(types); options.specialists=choices(specialists); options.editors=choices(editors);
  options.states=[...new Set(items.map(i=>i.state))].sort();
  const search=filters.search.trim().toLocaleLowerCase('es');
  const matching=items.filter(i=> (!search || `${i.title} ${i.authors} ${i.code} ${i.label} ${i.editor??''}`.toLocaleLowerCase('es').includes(search)) &&
    (!filters.service||i.serviceId===filters.service) && (!filters.interventionType||i.interventionType===filters.interventionType) &&
    (!filters.specialist||i.requestedById===filters.specialist) && (!filters.editor||i.editorId===filters.editor) &&
    (!filters.date||i.dueDate===filters.date) && (!filters.status||i.state===filters.status));
  const counts = Object.fromEntries((['unassigned','editing','waiting','overdue','all'] as const).map(tab=>[tab,matching.filter(i=>inTab(i,tab)).length])) as EditorialAssignmentList['counts'];
  const rows=matching.filter(i=>inTab(i,filters.tab)).sort((a,b)=>
    (filters.sort==='project'?a.title.localeCompare(b.title,'es'):filters.sort==='oldest'?(a.requestedAt??'9999').localeCompare(b.requestedAt??'9999'):(a.dueDate??'9999').localeCompare(b.dueDate??'9999')) || a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(rows.length/filters.pageSize)),page=Math.min(filters.page,pages);
  return {items:rows.slice((page-1)*filters.pageSize,page*filters.pageSize),total:rows.length,pages,page,counts,options};
}

export function summarizeEditorLoad(items: EditorialIntervention[], team: {id:string;nombre:string}[], now=new Date()): EditorialLoadSummary {
  const today=diaCaracas(now),weekEnd=new Date(today+'T12:00:00Z');
  weekEnd.setUTCDate(weekEnd.getUTCDate()+(7-weekEnd.getUTCDay())%7);
  const end=weekEnd.toISOString().slice(0,10);
  const loads=new Map<string,EditorialEditorLoad>(team.map(e=>[e.id,{id:e.id,name:e.nombre,activeAssigned:0,actionableNow:0,waitingThirdParty:0,overdue:0,dueThisWeek:0,nextDeliveries:[]}]));
  for (const item of items) {
    const e=item.editorId?loads.get(item.editorId):null;
    if (!e||item.state==='Completadas') continue;
    e.activeAssigned++;
    if(item.waitingOn)e.waitingThirdParty++;
    if(item.actionable){e.actionableNow++;if(item.overdue)e.overdue++;
      if(item.dueDate&&item.dueDate>=today&&item.dueDate<=end)e.dueThisWeek++;
      if(item.dueDate&&!item.overdue)e.nextDeliveries.push({id:item.id,title:item.title,label:item.label,dueDate:item.dueDate,overdue:item.overdue});
    }
  }
  for(const e of loads.values())e.nextDeliveries.sort((a,b)=>a.dueDate!.localeCompare(b.dueDate!)||a.id.localeCompare(b.id));
  for(const e of loads.values())e.nextDeliveries=e.nextDeliveries.slice(0,3);
  return {editors:[...loads.values()].sort((a,b)=>a.name.localeCompare(b.name,'es')||a.id.localeCompare(b.id)),today,updatedAt:now.toISOString()};
}

export async function getEditorLoadSummary(now=new Date()): Promise<EditorialLoadSummary> {
  const [items,team]=await Promise.all([editorialInterventions(diaCaracas(now)),pool.query<{id:string;nombre:string}>("SELECT id,nombre FROM usuarios WHERE rol='editor' AND activo ORDER BY nombre,id")]);
  return summarizeEditorLoad(items,team.rows,now);
}

export function recommendEditorsForIntervention(load: EditorialLoadSummary): EditorialRecommendation {
  const compare=(a:EditorialEditorLoad,b:EditorialEditorLoad)=>a.actionableNow-b.actionableNow||a.overdue-b.overdue||a.dueThisWeek-b.dueThisWeek;
  const ordered=[...load.editors].sort((a,b)=>compare(a,b)||a.name.localeCompare(b.name,'es')||a.id.localeCompare(b.id));
  let rank=0;
  const candidates=ordered.map((e,index)=>{if(index===0||compare(e,ordered[index-1]!)!==0)rank=index+1;return {...e,rank,reasons:[`${e.actionableNow} intervenciones accionables ahora.`,`${e.overdue} entregas vencidas bajo su responsabilidad.`,`${e.dueThisWeek} entregas entre hoy y el domingo.`]};});
  return {rule:EDITORIAL_RECOMMENDATION_RULE,observedAt:load.updatedAt,recommendedIds:candidates.filter(e=>e.rank===1).map(e=>e.id),candidates,
    explanation: candidates.length?'Menor cantidad de intervenciones accionables; después, menos vencidas y menos entregas esta semana. Los empates se conservan.':'No hay una recomendación automática con los datos disponibles.',limitations:LIMITATIONS};
}
