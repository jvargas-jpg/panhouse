import { pool } from '../db/client.js';
import type { EditorialDashboard, EditorialIntervention, EditorialActivity, EditorialLoad, EditorialState } from '../../shared/editorialChief.js';
import { diaCaracas } from './atencionEspecialista.js';
import { ajustarPlazoEdicionPorPausas, evaluarPlazoEdicion, plazoCapituloEditor } from './edicionSla.js';

// Read model over canonical sources. Fixed query count, no Drive calls.
// Legacy chapters are read directly until their next normal domain write
// materializes the corresponding work item. No second matrix/database.
const SOURCE = `WITH assignments AS (
 SELECT proyecto_id, (array_agg(usuario_id ORDER BY asignado_en DESC,id DESC) FILTER(WHERE finalizado_en IS NULL))[1] editor_id,
 (array_agg(id ORDER BY asignado_en DESC,id DESC) FILTER(WHERE finalizado_en IS NULL))[1] assignment_id
 FROM project_assignments WHERE tipo='editor' AND work_item_id IS NULL GROUP BY proyecto_id
), pedidos AS (
 SELECT entity_id,min(created_at) requested_at,(array_agg(actor_id ORDER BY created_at,id))[1] actor_id
 FROM audit_logs WHERE accion='EDITOR_SOLICITADO' GROUP BY entity_id
), pause_summary AS (
 SELECT proyecto_id,bool_or(fecha_inicio<=now() AND (fecha_fin IS NULL OR fecha_fin>now())) paused,
 jsonb_agg(jsonb_build_object('start',(fecha_inicio AT TIME ZONE 'America/Caracas')::date::text,'end',(fecha_fin AT TIME ZONE 'America/Caracas')::date::text)) pauses
 FROM pausas GROUP BY proyecto_id
), authors AS (
 SELECT pa.proyecto_id,string_agg(a.nombre,', ' ORDER BY a.nombre) names FROM proyectos_autores pa JOIN autores a ON a.id=pa.autor_id GROUP BY pa.proyecto_id
), scope AS (
 SELECT p.id project_id,p.codigo,coalesce(nullif(trim(p.titulo_definitivo),''),nullif(trim(p.titulo),''),'Proyecto editorial') title,
 coalesce(au.names,a.nombre) authors,s.nombre service,s.id service_id,s.codigo service_code,f.ingreso_servicio_subtipo_crudo subtype,
 x.assignment_id,p.estado project_state,
 coalesce(ps.pauses,'[]'::jsonb) pauses,x.proyecto_id IS NOT NULL assigned_before,coalesce(ps.paused,false) paused,
 CASE WHEN x.proyecto_id IS NOT NULL THEN x.editor_id ELSE p.editor_id END editor_id
 FROM proyectos p JOIN autores a ON a.id=p.autor_id JOIN servicios s ON s.id=p.servicio_id
 LEFT JOIN fichas_trazabilidad f ON f.proyecto_id=p.id LEFT JOIN assignments x ON x.proyecto_id=p.id LEFT JOIN authors au ON au.proyecto_id=p.id LEFT JOIN pause_summary ps ON ps.proyecto_id=p.id
 WHERE p.estado IN ('en_proceso','retrasado','stand_by','pausado')
 AND ($1::uuid IS NULL OR p.id=$1)
), interventions AS (
 SELECT coalesce(w.id,c.id) id,w.id work_item_id,p.*,c.numero chapter,c.fecha_inicio_editor start_date,c.fecha_entrega_editor delivered_at,c.fecha_envio_autor sent_at,c.fecha_respuesta_real feedback_at,
 coalesce(w.estado::text,CASE WHEN c.fecha_respuesta_real IS NOT NULL AND (c.fecha_entrega_editor IS NULL OR c.fecha_respuesta_real>=c.fecha_entrega_editor) THEN 'en_progreso' WHEN c.fecha_entrega_editor IS NOT NULL THEN 'completado' ELSE 'pendiente' END) work_state,
 w.fecha_fin_pautada due_date,w.gate_bloqueante block,r.requested_at,u.nombre requester,u.id requester_id,u.rol::text requester_role,w.observaciones notes,step.nombre step_name,
 coalesce(w.fecha_inicio_real=c.fecha_respuesta_real,false) feedback_cycle,'capitulo' business_key
 FROM scope p JOIN capitulos c ON c.proyecto_id=p.project_id
 LEFT JOIN work_items w ON w.proyecto_id=p.project_id AND w.tipo='edicion' AND w.business_key='capitulo:'||c.id::text
 LEFT JOIN work_items container ON container.proyecto_id=p.project_id AND container.tipo='edicion' AND container.business_key='default'
 LEFT JOIN pedidos r ON r.entity_id=container.id LEFT JOIN usuarios u ON u.id=r.actor_id
 LEFT JOIN pasos step ON step.id=w.paso_id
 UNION ALL
 SELECT w.id,w.id,p.*,null::int,w.fecha_inicio_real,w.fecha_fin_real,null::date,null::date,w.estado::text,w.fecha_fin_pautada,w.gate_bloqueante,r.requested_at,u.nombre,u.id,u.rol::text,w.observaciones,step.nombre,false,w.business_key
 FROM scope p JOIN work_items w ON w.proyecto_id=p.project_id AND w.tipo='edicion'
 LEFT JOIN pedidos r ON r.entity_id=w.id LEFT JOIN usuarios u ON u.id=r.actor_id
 LEFT JOIN pasos step ON step.id=w.paso_id
 WHERE w.business_key NOT LIKE 'capitulo:%' AND (w.business_key<>'default' OR (NOT EXISTS(SELECT 1 FROM capitulos c WHERE c.proyecto_id=p.project_id) AND NOT EXISTS(SELECT 1 FROM work_items detail WHERE detail.proyecto_id=p.project_id AND detail.tipo='edicion' AND detail.business_key<>'default')) OR (p.editor_id IS NULL AND r.requested_at IS NOT NULL))
)
SELECT i.*,i.start_date::text start_date,i.delivered_at::text delivered_at,i.sent_at::text sent_at,i.feedback_at::text feedback_at,i.due_date::text due_date,e.nombre editor FROM interventions i LEFT JOIN usuarios e ON e.id=i.editor_id WHERE work_state<>'cancelado' AND ($2::uuid IS NULL OR i.editor_id=$2) AND ($3::uuid IS NULL OR i.id=$3)`;
type Raw = { id:string; project_id:string; work_item_id:string|null; codigo:string; title:string; authors:string; service:string; service_id:string; service_code:string; subtype:string|null; editor_id:string|null; editor:string|null; chapter:number|null; start_date:string|null; delivered_at:string|null; sent_at:string|null; feedback_at:string|null; work_state:string; due_date:string|null; block:string|null; requested_at:Date|null; requester:string|null; requester_id:string|null; requester_role:string|null; notes:string|null; step_name:string|null; feedback_cycle:boolean; business_key:string; assignment_id:string|null; assigned_before:boolean; project_state:string; paused:boolean; pauses:{start:string;end:string|null}[] };

function intervention(r:Raw,today:string): EditorialIntervention {
  const waiting = !!(r.sent_at && !r.feedback_at);
  const feedback = !!r.feedback_at && r.work_state!=='completado';
  const delivered=r.work_state==='completado'||!!r.delivered_at&&!r.feedback_at;
  const paused=r.paused||['pausado','stand_by'].includes(r.project_state);
  const state = waiting ? 'Esperando autor' : paused&&!delivered ? 'En pausa' : r.work_state==='bloqueado' ? 'Bloqueadas' : delivered ? (r.chapter && !r.sent_at ? 'Esperando Especialista' : 'Completadas') : feedback ? 'Requiere ajustes' : r.work_state==='en_progreso' ? 'En edición' : 'Pendiente';
  const actionable=!!r.editor_id && ['En edición','Pendiente','Requiere ajustes','Bloqueadas'].includes(state);
  const dueDate = ajustarPlazoEdicionPorPausas(r.start_date,r.due_date ?? (!feedback && r.chapter && r.start_date ? plazoCapituloEditor(r.start_date) : null),r.pauses,today);
  const plazo=evaluarPlazoEdicion(dueDate,actionable,today);
  const needsAssignment = !r.editor_id && !r.assigned_before && !!r.requested_at && !r.chapter && !paused && !r.block && ['pendiente','en_progreso'].includes(r.work_state);
  const situation=needsAssignment?'Por asignar':state==='Bloqueadas'?'Bloqueada':plazo.overdue?'Vencida':plazo.atRisk?'En riesgo':state==='Requiere ajustes'?'Requiere ajustes':null;
  return {id:r.id,workItemId:r.work_item_id,projectId:r.project_id,
    title:r.title,authors:r.authors,code:r.codigo,service:r.service+(r.subtype?' · '+r.subtype:''),coverUrl:null,
    label:r.chapter?`${feedback?'Aplicar feedback · ':''}Capítulo ${r.chapter}`:r.step_name??(r.business_key==='default'?'Inicio de edición':r.business_key.replaceAll('_',' ')),
    editorId:r.editor_id,editor:r.editor,state,dueDate:actionable||needsAssignment?dueDate:null,...plazo,actionable,needsAssignment,
    requestedAt:r.requested_at?.toISOString()??null,requestedBy:r.requester??undefined,situation,cta:needsAssignment?'Asignar':state==='Bloqueadas'?'Ver bloqueo':plazo.overdue?'Ver seguimiento':state==='Requiere ajustes'?'Ver ajustes':'Revisar entrega',chapter:r.chapter,deliveredAt:r.delivered_at,block:r.block,
    serviceId:r.service_id,serviceCode:r.service_code,subtype:r.subtype,
    interventionType:feedback?'feedback':r.chapter?'chapter':r.step_name?'step:'+r.step_name:r.business_key,
    volume:r.chapter?'1 capítulo':null,notes:r.notes,requestedById:r.requester_id,requestedByRole:r.requester_role,
    waitingOn:waiting?'author':state==='Esperando Especialista'?'specialist':state==='En pausa'?'project_pause':null,
    assignmentId:r.assignment_id,plannedDueDate:dueDate};
}

export async function editorialInterventions(today=diaCaracas(new Date()),projectId?:string,editorId?:string,id?:string) {
  const {rows}=await pool.query<Raw>(SOURCE,[projectId??null,editorId??null,id??null]);
  return rows.map(r=>intervention(r,today));
}
export async function editorialDashboard(now=new Date()):Promise<EditorialDashboard> {
  const today=diaCaracas(now);
  const [items,editors]=await Promise.all([
    editorialInterventions(today),
    pool.query<{id:string;nombre:string}>(`SELECT id,nombre FROM usuarios WHERE rol='editor' AND activo ORDER BY nombre,id`),
  ]);
  const requests=items.filter(i=>i.needsAssignment).sort((a,b)=>a.requestedAt!.localeCompare(b.requestedAt!)||a.id.localeCompare(b.id));
  const loads=new Map<string,EditorialLoad>(editors.rows.map(e=>[e.id,{id:e.id,name:e.nombre,active:0,upcoming:0,overdue:0,waiting:0}]));
  const weekEnd=new Date(today+'T12:00:00Z');weekEnd.setUTCDate(weekEnd.getUTCDate()+(7-weekEnd.getUTCDay())%7);
  const end=weekEnd.toISOString().slice(0,10);
  const distribution=new Map<EditorialIntervention['state'],number>();
  for(const i of items){
    distribution.set(i.state,(distribution.get(i.state)??0)+1);
    const e=i.editorId?loads.get(i.editorId):null;if(!e)continue;
    if(i.actionable){e.active++;if(i.overdue)e.overdue++;if(i.dueDate&&i.dueDate>=today&&i.dueDate<=end)e.upcoming++;}
    if(i.waitingOn)e.waiting++;
  }
  const order=(a:EditorialIntervention,b:EditorialIntervention)=>Number(b.needsAssignment)-Number(a.needsAssignment)||Number(b.overdue)-Number(a.overdue)||(a.dueDate??'9999').localeCompare(b.dueDate??'9999')||a.id.localeCompare(b.id);
  const attention=items.filter(i=>i.situation).sort(order);
  return {updatedAt:now.toISOString(),today,summary:{unassigned:requests.length,overdue:items.filter(i=>i.overdue).length,atRisk:items.filter(i=>i.atRisk).length,pendingRequests:requests.length},
    editorLoads:[...loads.values()].sort((a,b)=>b.active-a.active||a.name.localeCompare(b.name)),
    interventionDistribution:[...distribution].map(([state,count])=>({state,count})),attentionItems:attention.slice(0,6),attentionTotal:attention.length,
    upcomingDeliveries:items.filter(i=>i.actionable&&i.dueDate&&!i.overdue).sort((a,b)=>a.dueDate!.localeCompare(b.dueDate!)||a.id.localeCompare(b.id)).slice(0,6),
    pendingRequests:requests.slice(0,4).map(r=>({id:r.id,projectId:r.projectId,title:r.title,authors:r.authors,requestedBy:r.requestedBy??'Especialista',requestedAt:r.requestedAt!,label:'Asignación de Editor',state:'Pendiente'}))};
}
export const EDITORIAL_EVENTS:Record<string,string>={EDITOR_SOLICITADO:'Solicitud de Editor recibida',EDITOR_ASIGNADO:'Editor asignado',EDITOR_REASIGNADO:'Editor reasignado',CAPITULO_EDITOR_ENTREGADO:'Capítulo entregado por Editor',CAPITULO_ENVIADO_AUTOR:'Capítulo enviado al autor',CAPITULO_FEEDBACK_REGISTRADO:'Feedback del autor registrado',CAPITULO_FEEDBACK_APLICADO:'Feedback aplicado por Editor',FEEDBACK_TRIPA_REGISTRADO:'Edición de tripa completada'};
// Responsabilidad actual != Editor asignado: una intervención puede seguir asignada a un Editor
// mientras la pelota está en otra cancha (autor/Especialista). Compartido por Proyectos de edición
// y Seguimiento — una sola fuente de verdad para no divergir entre pantallas.
export const EDITORIAL_RESPONSIBLE:Partial<Record<EditorialState,'editor'|'especialista'|'autor'>>={
  'Bloqueadas':'editor','Requiere ajustes':'editor','En edición':'editor','Pendiente':'editor',
  'Esperando autor':'autor','Esperando Especialista':'especialista',
};
const EVENTS=EDITORIAL_EVENTS;
export async function editorialActivity():Promise<EditorialActivity[]> {
  const {rows}=await pool.query<{id:string;accion:string;title:string;actor:string;at:Date}>(`SELECT a.id,a.accion,coalesce(p.titulo_definitivo,p.titulo,'Proyecto editorial') title,coalesce(u.nombre,'Sistema') actor,a.created_at at FROM audit_logs a JOIN proyectos p ON p.id=a.proyecto_id LEFT JOIN usuarios u ON u.id=a.actor_id WHERE a.accion=ANY($1::text[]) ORDER BY a.created_at DESC,a.id DESC LIMIT 6`,[Object.keys(EVENTS)]);
  return rows.map(r=>({...r,text:EVENTS[r.accion]!,at:r.at.toISOString()}));
}
