import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { auditLogs, monthlyGoals, notificaciones, proyectos, users, workItems, type Rol } from '../db/schema/index.js';
import { GOAL_TYPES, type GoalCatalog, type GoalInput, type GoalList, type GoalSummary, type MonthlyGoal, type TeamGoals } from '../../shared/monthlyGoals.js';
import { diaCaracas } from './atencionEspecialista.js';
import { especialistaActualSql, obtenerEspecialistaActual } from './carga.js';
import { registrarEvento } from './auditLog.js';
import { evaluateMonthlyGoal, GOAL_PROCESSES, goalPeriod, loadGoalFacts, periodReadOnly, reconcileGoals, type GoalFacts, type GoalRow } from './monthlyGoalEvaluation.js';
import type { Tx } from './tx.js';

export type GoalActor = { id: string; rol: Rol };
export class GoalError extends Error { constructor(public status: number, message: string) { super(message); } }
function requireValue(value: unknown, message: string, status = 409): asserts value { if(!value)throw new GoalError(status,message); }
const normalize=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('es').replace(/\s+/g,' ').trim();
export interface GoalFilters { period: string; specialistId?: string; projectId?: string; source?: 'JEFATURA' | 'ESPECIALISTA'; status?: MonthlyGoal['status']; page: number; pageSize: number }
export function assertGoalsRole(actor: GoalActor) { requireValue(['especialista','jefe_area'].includes(actor.rol),'No tienes acceso a los objetivos mensuales',403); }
async function specialistScope(actor: GoalActor, specialistId?: string, client: typeof db | Tx = db) {
  assertGoalsRole(actor);
  const id=actor.rol==='especialista'?actor.id:specialistId;
  if(actor.rol==='especialista'&&specialistId&&specialistId!==actor.id)throw new GoalError(403,'Solo puedes consultar tus objetivos');
  if(id) {
    const [person]=await client.select({id:users.id,nombre:users.nombre}).from(users).where(and(eq(users.id,id),eq(users.rol,'especialista')));
    requireValue(person,'Especialista no encontrado',404);
  }
  return id;
}
function canEdit(actor: GoalActor, g: GoalRow, now: Date) {
  return g.status==='ACTIVO'&&!periodReadOnly(goalPeriod(g),now)&&(actor.rol==='jefe_area'?g.source==='JEFATURA':g.source==='ESPECIALISTA'&&g.specialistId===actor.id);
}
function dto(g: GoalRow, facts: Map<string,GoalFacts>, names: Map<string,string>, actor: GoalActor, now: Date): MonthlyGoal {
  const f=g.projectId?facts.get(g.projectId):undefined,e=evaluateMonthlyGoal(g,f,now);
  return {id:g.id,specialistId:g.specialistId,projectId:g.projectId,periodYear:g.periodYear,periodMonth:g.periodMonth,source:g.source,
    createdBy:{id:g.createdByUserId,nombre:names.get(g.createdByUserId) ?? 'Usuario registrado'},title:g.title,description:g.description,
    goalType:g.goalType,targetProcess:g.targetProcess,targetWorkItemId:g.targetWorkItemId,
    targetLabel:g.targetProcess?GOAL_PROCESSES[g.targetProcess] ?? g.targetProcess:g.targetWorkItemId?GOAL_PROCESSES[f?.items.find(w=>w.id===g.targetWorkItemId)?.tipo ?? ''] ?? 'Hito editorial':GOAL_TYPES[g.goalType],
    targetDate:g.targetDate,status:e.status,baseStatus:g.status,completedAt:e.evidence?.precision==='dia'?e.evidence.at:e.completedAt?.toISOString() ?? null,evidence:e.evidence,
    cancelReason:g.cancelReason,createdAt:g.createdAt.toISOString(),updatedAt:g.updatedAt.toISOString(),currentContext:e.currentContext,
    riskReasons:e.riskReasons,daysRemaining:e.daysRemaining,daysEarly:e.daysEarly,canEdit:canEdit(actor,g,now),project:f?.project ?? null,
    canOpenProject:!!f&&(actor.rol==='jefe_area'||f.owner===actor.id)};
}
export function summarizeGoals(items: Pick<MonthlyGoal,'source'|'status'>[]): GoalSummary {
  return {total:items.length,assigned:items.filter(g=>g.source==='JEFATURA').length,own:items.filter(g=>g.source==='ESPECIALISTA').length,
    active:items.filter(g=>g.status==='ACTIVO').length,risk:items.filter(g=>g.status==='EN_RIESGO').length,completed:items.filter(g=>g.status==='CUMPLIDO').length,
    unmet:items.filter(g=>g.status==='NO_CUMPLIDO').length,cancelled:items.filter(g=>g.status==='CANCELADO').length};
}
async function periodRows(actor: GoalActor, period: string, specialistId: string | undefined, now: Date) {
  const owner=await specialistScope(actor,specialistId),[year,month]=period.split('-').map(Number);
  return db.transaction(async tx=>{
    const goals=await tx.select().from(monthlyGoals).where(and(eq(monthlyGoals.periodYear,year!),eq(monthlyGoals.periodMonth,month!),owner?eq(monthlyGoals.specialistId,owner):undefined))
      .orderBy(asc(monthlyGoals.targetDate),sql`case when ${monthlyGoals.source}='JEFATURA' then 0 else 1 end`,asc(monthlyGoals.createdAt),asc(monthlyGoals.id));
    const facts=await reconcileGoals(tx,goals,now);
    const ids=[...new Set(goals.map(g=>g.createdByUserId))];
    const people=ids.length?await tx.select({id:users.id,nombre:users.nombre}).from(users).where(inArray(users.id,ids)):[];
    const names=new Map(people.map(p=>[p.id,p.nombre]));
    return goals.map(g=>dto(g,facts,names,actor,now));
  });
}
export async function listMonthlyGoals(actor: GoalActor, filters: GoalFilters, now = new Date()): Promise<GoalList> {
  const all=await periodRows(actor,filters.period,filters.specialistId,now);
  const rows=all.filter(g=>(!filters.source||g.source===filters.source)&&(!filters.status||g.status===filters.status)&&(!filters.projectId||g.projectId===filters.projectId));
  const total=rows.length,pages=Math.max(1,Math.ceil(total/filters.pageSize)),page=Math.min(filters.page,pages);
  return {period:filters.period,readOnly:periodReadOnly(filters.period,now),updatedAt:now.toISOString(),items:rows.slice((page-1)*filters.pageSize,page*filters.pageSize),total,pages,page,pageSize:filters.pageSize};
}
export async function summaryMonthlyGoals(actor: GoalActor, period: string, specialistId?: string, now = new Date()) {
  const items=await periodRows(actor,period,specialistId,now);
  return {period,readOnly:periodReadOnly(period,now),summary:summarizeGoals(items)};
}
export async function teamMonthlyGoals(actor: GoalActor, period: string, now = new Date()): Promise<TeamGoals> {
  requireValue(actor.rol==='jefe_area','Solo Jefatura puede consultar el equipo',403);
  const people=await db.select({id:users.id,nombre:users.nombre}).from(users).where(and(eq(users.rol,'especialista'),eq(users.activo,true))).orderBy(asc(users.nombre),asc(users.id));
  const all=await periodRows(actor,period,undefined,now),scope=new Set(people.map(p=>p.id)),items=all.filter(g=>scope.has(g.specialistId));
  const byPerson=new Map<string, MonthlyGoal[]>();
  for(const g of items){const arr=byPerson.get(g.specialistId) ?? [];arr.push(g);byPerson.set(g.specialistId,arr);}
  return {period,readOnly:periodReadOnly(period,now),summary:summarizeGoals(items),specialists:people.map(p=>({...p,summary:summarizeGoals(byPerson.get(p.id) ?? [])}))};
}
export async function monthlyGoalCatalog(actor: GoalActor, specialistId?: string): Promise<GoalCatalog> {
  const id=await specialistScope(actor,specialistId);
  requireValue(id,'Selecciona un Especialista',400);
  const rows=await db.select({id:proyectos.id}).from(proyectos).where(eq(especialistaActualSql,id));
  const facts=await loadGoalFacts(db,rows.map(p=>p.id));
  return {types:Object.entries(GOAL_TYPES).map(([id,nombre])=>({id:id as keyof typeof GOAL_TYPES,nombre})),processes:Object.entries(GOAL_PROCESSES).map(([id,nombre])=>({id,nombre})),
    projects:[...facts.values()].filter(f=>!['retirado','culminado'].includes(f.project.estado)).map(f=>f.project).sort((a,b)=>a.titulo.localeCompare(b.titulo,'es')),
    milestones:[...facts.values()].flatMap(f=>['retirado','culminado'].includes(f.project.estado)?[]:f.items.filter(w=>GOAL_PROCESSES[w.tipo]&&!['cancelado','completado'].includes(w.estado)).map(w=>({id:w.id,projectId:w.proyectoId,nombre:(GOAL_PROCESSES[w.tipo] ?? w.tipo)+' · '+w.businessKey,estado:w.estado})))};
}
async function readGoal(actor: GoalActor, id: string, client: typeof db | Tx = db) {
  assertGoalsRole(actor);
  const [g]=await client.select().from(monthlyGoals).where(and(eq(monthlyGoals.id,id),actor.rol==='especialista'?eq(monthlyGoals.specialistId,actor.id):undefined));
  requireValue(g,'Objetivo no encontrado',404);
  await specialistScope(actor,g.specialistId,client);
  return g;
}
export async function monthlyGoalDetail(actor: GoalActor, id: string, now = new Date()) {
  return db.transaction(async tx=>{
    const g=await readGoal(actor,id,tx),facts=await reconcileGoals(tx,[g],now);
    const [creator]=await tx.select({nombre:users.nombre}).from(users).where(eq(users.id,g.createdByUserId));
    const events=await tx.select({id:auditLogs.id,accion:auditLogs.accion,actor:users.nombre,at:auditLogs.createdAt,detalles:auditLogs.detalles}).from(auditLogs)
      .leftJoin(users,eq(users.id,auditLogs.actorId)).where(and(eq(auditLogs.entityType,'monthly_goal'),eq(auditLogs.entityId,id))).orderBy(desc(auditLogs.createdAt),desc(auditLogs.id));
    return {goal:dto(g,facts,new Map([[g.createdByUserId,creator?.nombre ?? 'Usuario registrado']]),actor,now),
      events:events.map(e=>({...e,actor:e.actor ?? 'PanHouse',at:e.at.toISOString(),detalles:e.detalles as Record<string,unknown>|null}))};
  });
}
function assertWritablePeriod(period: string, now: Date) { requireValue(!periodReadOnly(period,now),'El periodo histórico es de solo lectura'); }
async function validateProject(tx: Tx, input: GoalInput, specialistId: string, now: Date) {
  if(!input.projectId)return;
  const [p]=await tx.select().from(proyectos).where(eq(proyectos.id,input.projectId)).for('update');
  requireValue(p,'Proyecto no encontrado',404);
  requireValue(await obtenerEspecialistaActual(p.id,p.especialistaId,tx)===specialistId,'El proyecto no está asignado a este Especialista',403);
  requireValue(!['retirado','culminado'].includes(p.estado),'Selecciona un proyecto activo');
  if(input.targetWorkItemId) {
    const [w]=await tx.select().from(workItems).where(and(eq(workItems.id,input.targetWorkItemId),eq(workItems.proyectoId,p.id)));
    requireValue(w&&GOAL_PROCESSES[w.tipo],'Hito ajeno o no disponible',400);
    requireValue(!['cancelado','completado'].includes(w.estado),'El hito ya está resuelto');
  }
  if(input.targetProcess) {
    const [w]=await tx.select({id:workItems.id}).from(workItems).where(and(eq(workItems.proyectoId,p.id),eq(workItems.tipo,input.targetProcess),sql`${workItems.estado}<>'cancelado'`)).limit(1);
    requireValue(!w,'El proyecto ya alcanzó ese proceso; selecciona un resultado pendiente');
  }
}
async function duplicate(tx: Tx, input: GoalInput, specialistId: string, exclude?: string) {
  const rows=await tx.select().from(monthlyGoals).where(and(eq(monthlyGoals.specialistId,specialistId),eq(monthlyGoals.periodYear,input.periodYear),eq(monthlyGoals.periodMonth,input.periodMonth),sql`${monthlyGoals.status}<>'CANCELADO'`));
  const key=(g:GoalInput)=>[g.goalType,g.projectId,g.targetProcess,g.targetWorkItemId,normalize(g.title)].join('|');
  requireValue(!rows.some(g=>g.id!==exclude&&key(g)===key(input)),'Ya existe un objetivo equivalente en este periodo');
}
async function notify(tx: Tx, g: GoalRow, verb: string) {
  if(g.source==='JEFATURA')await tx.insert(notificaciones).values({proyectoId:g.projectId,rolDestino:'especialista',usuarioDestinoId:g.specialistId,
    mensaje:`Jefatura ${verb} tu objetivo de ${goalPeriod(g)}: ${g.title}`});
}
export async function createMonthlyGoal(actor: GoalActor, input: GoalInput & {specialistId?: string;idempotencyKey:string}, now = new Date()) {
  const specialistId=await specialistScope(actor,input.specialistId);
  requireValue(specialistId,'Selecciona un Especialista',400);
  const source=actor.rol==='especialista'?'ESPECIALISTA' as const:'JEFATURA' as const;
  const {idempotencyKey,specialistId:_selected,...data}=input;
  const hash=createHash('sha256').update(JSON.stringify({...data,specialistId,source})).digest('hex');
  return db.transaction(async tx=>{
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${actor.id+':'+idempotencyKey},0))`);
    const [specialist]=await tx.select().from(users).where(eq(users.id,specialistId)).for('update');
    requireValue(specialist?.activo&&specialist.rol==='especialista','Selecciona un Especialista activo');
    const [retry]=await tx.select().from(monthlyGoals).where(and(eq(monthlyGoals.createdByUserId,actor.id),eq(monthlyGoals.idempotencyKey,idempotencyKey)));
    if(retry){requireValue(retry.requestHash===hash,'Esta clave de creación ya se usó con otros datos');return {id:retry.id,alreadyExisted:true};}
    assertWritablePeriod(goalPeriod(data),now);
    await validateProject(tx,data,specialistId,now);
    await duplicate(tx,data,specialistId);
    const [g]=await tx.insert(monthlyGoals).values({...data,specialistId,source,createdByUserId:actor.id,idempotencyKey,requestHash:hash,createdAt:now,updatedAt:now}).returning();
    requireValue(g,'No se pudo crear el objetivo',500);
    await registrarEvento(tx,{actorId:actor.id,accion:'OBJETIVO_CREADO',entityType:'monthly_goal',entityId:g.id,proyectoId:g.projectId,
      detalles:{source,specialistId,period:goalPeriod(g),title:g.title,targetDate:g.targetDate,goalType:g.goalType,targetProcess:g.targetProcess,targetWorkItemId:g.targetWorkItemId}});
    await notify(tx,g,'asignó');
    return {id:g.id,alreadyExisted:false};
  });
}
export async function updateMonthlyGoal(actor: GoalActor,id: string,input: GoalInput & {updatedAt:string;changeReason:string}, now=new Date()) {
  const initial=await readGoal(actor,id);
  return db.transaction(async tx=>{
    // Orden de bloqueos compatible con reasignación: proyecto antes que meta.
    for(const pid of [...new Set([initial.projectId,input.projectId].filter((p):p is string=>!!p))].sort())await tx.select({id:proyectos.id}).from(proyectos).where(eq(proyectos.id,pid)).for('update');
    const [g]=await tx.select().from(monthlyGoals).where(eq(monthlyGoals.id,id)).for('update');
    requireValue(g,'Objetivo no encontrado',404);
    requireValue(canEdit(actor,g,now),'No puedes modificar este objetivo',403);
    requireValue(g.updatedAt.toISOString()===input.updatedAt,'El objetivo cambió. Actualiza antes de editar');
    requireValue(g.projectId===initial.projectId,'El proyecto del objetivo cambió. Actualiza antes de editar');
    await reconcileGoals(tx,[g],now);
    requireValue(g.status==='ACTIVO','El objetivo ya tiene un resultado');
    const {updatedAt:_version,changeReason,...data}=input;
    requireValue(data.periodYear===g.periodYear&&data.periodMonth===g.periodMonth,'El periodo es histórico e inmutable; crea otro objetivo para otro mes',400);
    await validateProject(tx,data,g.specialistId,now);
    await duplicate(tx,data,g.specialistId,id);
    const changes=Object.fromEntries(Object.entries(data).filter(([k,v])=>g[k as keyof GoalRow]!==v).map(([k,v])=>[k,{anterior:g[k as keyof GoalRow],nuevo:v}]));
    if(!Object.keys(changes).length)return {id};
    await tx.update(monthlyGoals).set({...data,updatedAt:new Date(Math.max(now.getTime(),g.updatedAt.getTime()+1))}).where(eq(monthlyGoals.id,id));
    await registrarEvento(tx,{actorId:actor.id,accion:'OBJETIVO_AJUSTADO',entityType:'monthly_goal',entityId:id,proyectoId:g.projectId,detalles:{changes,motivo:changeReason}});
    await notify(tx,{...g,...data},'ajustó');
    return {id};
  });
}
export async function cancelMonthlyGoal(actor: GoalActor,id: string,reason: string,version: string,now=new Date()) {
  const initial=await readGoal(actor,id);
  return db.transaction(async tx=>{
    if(initial.projectId)await tx.select({id:proyectos.id}).from(proyectos).where(eq(proyectos.id,initial.projectId)).for('update');
    const [g]=await tx.select().from(monthlyGoals).where(eq(monthlyGoals.id,id)).for('update');
    requireValue(g,'Objetivo no encontrado',404);
    requireValue(g.projectId===initial.projectId,'El objetivo cambió. Actualiza antes de cancelar');
    requireValue(canEdit(actor,g,now),'No puedes cancelar este objetivo',403);
    requireValue(g.updatedAt.toISOString()===version,'El objetivo cambió. Actualiza antes de cancelar');
    await reconcileGoals(tx,[g],now);
    requireValue(g.status==='ACTIVO','El objetivo ya tiene un resultado');
    await tx.update(monthlyGoals).set({status:'CANCELADO',cancelReason:reason,cancelledAt:now,updatedAt:new Date(Math.max(now.getTime(),g.updatedAt.getTime()+1))}).where(eq(monthlyGoals.id,id));
    await registrarEvento(tx,{actorId:actor.id,accion:'OBJETIVO_CANCELADO',entityType:'monthly_goal',entityId:id,proyectoId:g.projectId,detalles:{anterior:'ACTIVO',nuevo:'CANCELADO',motivo:reason}});
    await notify(tx,g,'canceló');return {id};
  });
}
export const currentGoalPeriod=()=>diaCaracas(new Date()).slice(0,7);
