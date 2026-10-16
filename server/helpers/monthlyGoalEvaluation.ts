import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLogs, autores, fichasTrazabilidad, monthlyGoals, pausas, proyectos, proyectosAutores, servicios, workItems } from '../db/schema/index.js';
import { especialistaActualSql, ESTADOS_ACTIVOS } from './carga.js';
import { evaluarRiesgo, determinarDiasPlazoAlerta } from './alertas.js';
import { calcularDuracionEfectivaDias } from './performance.js';
import { resolverPlazosServicio, nombreServicioProyecto } from '../../shared/planificacion.js';
import { diaCaracas } from './atencionEspecialista.js';
import { registrarEvento } from './auditLog.js';
import type { Tx } from './tx.js';
import type { GoalEvidence, GoalProject, GoalStatus } from '../../shared/monthlyGoals.js';
import { evaluarExpressJefatura } from './jefatura.js';

export const GOAL_PROCESSES: Record<string, string> = {
  preparacion_inicial: 'Preparación inicial', edicion: 'Edición', correccion: 'Corrección',
  direccion_creativa: 'Dirección Creativa', diseno: 'Diseño y diagramación', calidad: 'Calidad editorial',
  soporte_digital: 'Soporte digital', lanzamiento: 'Lanzamiento', impresion: 'Impresión', distribucion: 'Distribución',
};
export type GoalRow = typeof monthlyGoals.$inferSelect;
export const goalPeriod = (g: Pick<GoalRow, 'periodYear' | 'periodMonth'>) => `${g.periodYear}-${String(g.periodMonth).padStart(2, '0')}`;
export const periodReadOnly = (period: string, now = new Date()) => period < diaCaracas(now).slice(0, 7);
export const diffDays = (a: string, b: string) => Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
export interface GoalFacts {
  project: GoalProject; owner: string | null; riskReasons: string[]; paused: boolean;
  items: (typeof workItems.$inferSelect)[];
  closures: { id: string; at: Date; specialistId: string | null }[];
}
const group = <T>(rows: T[], key: (r: T) => string) => {
  const map = new Map<string, T[]>();
  for (const r of rows) { const k=key(r), list=map.get(k) ?? []; list.push(r); map.set(k,list); }
  return map;
};

// Cinco lecturas por lote, acotadas a los proyectos del periodo. Nunca N+1.
export async function loadGoalFacts(client: typeof db | Tx, ids: string[], now = new Date()): Promise<Map<string, GoalFacts>> {
  if (!ids.length) return new Map();
  // En una transacción todas usan la misma conexión PG; se ejecutan en orden.
  const rows = await client.select({ p: proyectos, s: servicios, owner: especialistaActualSql, autor: autores.nombre, subtipo: fichasTrazabilidad.ingresoServicioSubtipoCrudo, ingreso: fichasTrazabilidad.ingresoFechaIngreso, deseada: fichasTrazabilidad.fechaDeseadaCulminacion })
    .from(proyectos).innerJoin(servicios, eq(servicios.id, proyectos.servicioId)).innerJoin(autores,eq(autores.id,proyectos.autorId)).leftJoin(fichasTrazabilidad, eq(fichasTrazabilidad.proyectoId, proyectos.id)).where(inArray(proyectos.id, ids));
  const items = await client.select().from(workItems).where(inArray(workItems.proyectoId, ids));
  const events = await client.select({ id: auditLogs.id, projectId: auditLogs.proyectoId, at: auditLogs.createdAt, specialistId: sql<string | null>`${auditLogs.detalles}->>'especialistaId'` }).from(auditLogs)
    .where(and(inArray(auditLogs.proyectoId, ids), eq(auditLogs.accion, 'PROYECTO_ESTADO_CAMBIADO'), sql`${auditLogs.detalles}->>'nuevo'='culminado'`));
  const breaks = await client.select().from(pausas).where(inArray(pausas.proyectoId, ids));
  const authors = await client.select({ projectId: proyectosAutores.proyectoId, nombre: autores.nombre }).from(proyectosAutores).innerJoin(autores, eq(autores.id, proyectosAutores.autorId)).where(inArray(proyectosAutores.proyectoId, ids));
  const byItem=group(items, r=>r.proyectoId), byEvent=group(events, r=>r.projectId!), byBreak=group(breaks,r=>r.proyectoId), byAuthor=group(authors,r=>r.projectId);
  return new Map(rows.map(({p,s,owner,autor,subtipo,ingreso,deseada}) => {
    const ps=byBreak.get(p.id) ?? [], wi=byItem.get(p.id) ?? [];
    const duration=calcularDuracionEfectivaDias(new Date((p.fechaRealInicio ?? p.fechaProgramadaInicio)+'T00:00:00Z'),now,ps,now);
    const plazo=resolverPlazosServicio(s,subtipo) ?? s;
    const risk=evaluarRiesgo(duration,determinarDiasPlazoAlerta(plazo));
    const express=evaluarExpressJefatura(p,s,deseada,subtipo,ingreso);
    const reasons: string[]=[];
    if (ESTADOS_ACTIVOS.includes(p.estado)) {
      if (risk.vencido) reasons.push('Plazo operativo del proyecto excedido');
      else if (risk.enRiesgo) reasons.push('El proyecto alcanzó el umbral de riesgo operativo');
      if(p.estado==='retrasado')reasons.push('Proyecto retrasado');
    }
    return [p.id, { project:{id:p.id,codigo:p.codigo,titulo:p.tituloDefinitivo?.trim() || p.titulo?.trim() || 'Proyecto editorial',
      autores:(byAuthor.get(p.id) ?? []).map(a=>a.nombre).join(', ') || autor,servicio:nombreServicioProyecto(s.codigo,s.nombre,subtipo),estado:p.estado,
      portadaUrl:p.portadaDecisionAutor==='aprobada'?p.propuestaPortadaUrl:null,fechaObjetivo:p.fechaFinProyectada ?? (express.estado==='confirmado'?express.fechaDeseada:express.fechaEstandar),express:express.estado==='confirmado'},
      owner, riskReasons:reasons, paused:p.estado==='pausado'||p.estado==='stand_by'||ps.some(b=>b.esPausadoFormal&&!b.fechaFin),
      items:wi,closures:(byEvent.get(p.id) ?? []).map(e=>({id:e.id,at:e.at,specialistId:e.specialistId})) }];
  }));
}

export function evaluateMonthlyGoal(g: GoalRow, facts: GoalFacts | undefined, now = new Date()) {
  const today=diaCaracas(now), period=goalPeriod(g), start=period+'-01';
  const end=new Date(Date.UTC(g.periodYear,g.periodMonth,1)).toISOString().slice(0,10);
  const visible=(wi: GoalFacts['items'][number])=>diaCaracas(wi.createdAt)<end && wi.createdAt<=now;
  const active=facts?.items.filter(w=>visible(w)&&w.estado!=='cancelado'&&GOAL_PROCESSES[w.tipo]) ?? [];
  const context = facts ? (active.filter(w=>w.estado!=='completado').map(w=>(GOAL_PROCESSES[w.tipo] ?? w.tipo)+(w.estado==='bloqueado'?' · bloqueado':'')).join(' · ') || ({culminado:'Proyecto cerrado',retirado:'Proyecto retirado'}[facts.project.estado] ?? 'Sin procesos abiertos')) : 'Objetivo general';
  const base={currentContext:g.resultContext ?? context, daysRemaining:diffDays(g.targetDate,today)};
  if(g.status!=='ACTIVO')return {...base,status:g.status as GoalStatus,evidence:g.evidence,completedAt:g.completedAt,
    riskReasons:[] as string[],daysEarly:g.completedAt?diffDays(g.targetDate,g.evidence?.precision==='dia'?g.evidence.at:diaCaracas(g.completedAt)):null};
  const candidates: GoalEvidence[]=[];
  if(g.goalType==='CIERRE_PROYECTO')for(const e of facts?.closures ?? [])if(e.specialistId===g.specialistId)candidates.push({kind:'project_close',id:e.id,at:e.at.toISOString(),precision:'instante'});
  if(g.goalType==='ALCANZAR_PROCESO')for(const w of facts?.items ?? [])if(w.tipo===g.targetProcess && w.estado!=='cancelado')candidates.push({kind:'process_opened',id:w.id,at:w.createdAt.toISOString(),precision:'instante'});
  if(g.goalType==='ALCANZAR_HITO')for(const w of facts?.items ?? [])if(w.id===g.targetWorkItemId && w.estado==='completado' && w.fechaFinReal)candidates.push({kind:'work_item_completed',id:w.id,at:w.fechaFinReal,precision:'dia'});
  const evidence=candidates.filter(e=>{ const day=e.precision==='dia'?e.at:diaCaracas(new Date(e.at)); return day>=start&&day<end&&day<=today&&(e.precision==='dia'||new Date(e.at)<=now); }).sort((a,b)=>a.at.localeCompare(b.at))[0] ?? null;
  if(evidence) {
    const completedAt=new Date(evidence.precision==='dia'?evidence.at+'T12:00:00-04:00':evidence.at);
    const resultContext=g.goalType==='CIERRE_PROYECTO'?'Proyecto cerrado':g.goalType==='ALCANZAR_PROCESO'?(GOAL_PROCESSES[g.targetProcess!] ?? 'Proceso editorial')+' · alcanzado':(GOAL_PROCESSES[facts?.items.find(w=>w.id===g.targetWorkItemId)?.tipo ?? ''] ?? 'Hito editorial')+' · completado';
    return {...base,currentContext:resultContext,status:'CUMPLIDO' as const,evidence,completedAt,riskReasons:[],daysEarly:diffDays(g.targetDate,evidence.precision==='dia'?evidence.at:diaCaracas(completedAt))};
  }
  if(today>=end)return {...base,currentContext:'Sin cumplimiento registrado al cierre del periodo',status:'NO_CUMPLIDO' as const,evidence:null,completedAt:null,riskReasons:[],daysEarly:null};
  if(g.projectId && facts && facts.owner!==g.specialistId)return {...base,status:'CANCELADO' as const,evidence:null,completedAt:null,riskReasons:[],daysEarly:null};
  const reasons: string[]=[];
  if(g.targetDate<today)reasons.push('Fecha objetivo vencida');
  if(facts?.paused)reasons.push('Proyecto en pausa o stand-by');
  const relevant=facts?.items.filter(w=>g.goalType==='ALCANZAR_HITO'?w.id===g.targetWorkItemId:true) ?? [];
  if(relevant.some(w=>w.estado==='bloqueado'))reasons.push('Proceso relacionado bloqueado');
  reasons.push(...(facts?.riskReasons ?? []));
  return {...base,status:reasons.length?'EN_RIESGO' as const:'ACTIVO' as const,evidence:null,completedAt:null,riskReasons:reasons,daysEarly:null};
}

export async function reconcileGoals(tx: Tx, goals: GoalRow[], now = new Date(), suppliedFacts?: Map<string, GoalFacts>) {
  const facts=suppliedFacts ?? await loadGoalFacts(tx,[...new Set(goals.flatMap(g=>g.projectId?[g.projectId]:[]))],now);
  for(const g of goals) {
    if(g.status!=='ACTIVO')continue;
    const e=evaluateMonthlyGoal(g,g.projectId?facts.get(g.projectId):undefined,now);
    if(e.status==='ACTIVO'||e.status==='EN_RIESGO')continue;
    const cancelReason=e.status==='CANCELADO'?'Proyecto reasignado':null;
    const updatedAt=new Date(Math.max(now.getTime(),g.updatedAt.getTime()+1));
    const [changed]=await tx.update(monthlyGoals).set({status:e.status,completedAt:e.completedAt,evidence:e.evidence,resultContext:e.currentContext,
      ...(cancelReason?{cancelReason,cancelledAt:now}:{}),updatedAt}).where(and(eq(monthlyGoals.id,g.id),eq(monthlyGoals.status,'ACTIVO'),eq(monthlyGoals.updatedAt,g.updatedAt))).returning();
    if(!changed){
      const [latest]=await tx.select().from(monthlyGoals).where(eq(monthlyGoals.id,g.id));
      if(latest){Object.assign(g,latest);if(g.projectId&&!facts.has(g.projectId)){const current=await loadGoalFacts(tx,[g.projectId],now);for(const [id,f]of current)facts.set(id,f);}}
      continue;
    }
    await registrarEvento(tx,{actorId:null,accion:e.status==='CUMPLIDO'?'OBJETIVO_CUMPLIDO':e.status==='NO_CUMPLIDO'?'OBJETIVO_NO_CUMPLIDO':'OBJETIVO_CANCELADO_REASIGNACION',entityType:'monthly_goal',entityId:g.id,proyectoId:g.projectId,
      detalles:{anterior:'ACTIVO',nuevo:e.status,period:goalPeriod(g),evidence:e.evidence,motivo:cancelReason}});
    Object.assign(g,changed);
  }
  return facts;
}
export async function evaluateProjectGoals(tx: Tx, projectId: string, now = new Date()) {
  const goals=await tx.select().from(monthlyGoals).where(and(eq(monthlyGoals.projectId,projectId),eq(monthlyGoals.status,'ACTIVO')));
  if(goals.length)await reconcileGoals(tx,goals,now);
}
export async function cancelReassignedGoals(tx: Tx, projectId: string, nextOwner: string | null, actorId: string | null) {
  const goals=await tx.select().from(monthlyGoals).where(and(eq(monthlyGoals.projectId,projectId),eq(monthlyGoals.status,'ACTIVO')));
  if(!goals.length)return;
  const now=new Date();
  const facts=await reconcileGoals(tx,goals,now);
  for(const g of goals)if(g.status==='ACTIVO'&&g.specialistId!==nextOwner) {
    const context=evaluateMonthlyGoal(g,facts.get(projectId),now).currentContext;
    const [changed]=await tx.update(monthlyGoals).set({status:'CANCELADO',cancelledAt:now,cancelReason:'Proyecto reasignado',resultContext:context,updatedAt:now})
      .where(and(eq(monthlyGoals.id,g.id),eq(monthlyGoals.status,'ACTIVO'))).returning();
    if(changed)await registrarEvento(tx,{actorId,accion:'OBJETIVO_CANCELADO_REASIGNACION',entityType:'monthly_goal',entityId:g.id,proyectoId:projectId,
      detalles:{anterior:'ACTIVO',nuevo:'CANCELADO',motivo:'Proyecto reasignado',specialistId:g.specialistId,nuevoEspecialistaId:nextOwner}});
  }
}
