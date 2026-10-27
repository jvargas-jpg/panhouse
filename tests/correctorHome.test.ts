import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { eq, and } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { auditLogs, correcciones, projectAssignments, proyectos, users, workItems } from '../server/db/schema/index.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { solicitarCorreccion, asignarCorrector, registrarEntregaCorreccion } from '../server/helpers/correcciones.js';
import { getCorrectorDashboard } from '../server/helpers/correctorHome.js';
const drive = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../server/modules/integrations/google-drive/corporate.js', () => ({ withCorporateDrive: async () => { drive.calls++; throw Error('Dashboard must not call Drive'); } }));
const now = new Date('2026-10-27T16:00:00Z');
let app:ReturnType<typeof crearAppDePrueba>|undefined;
beforeEach(async()=>{await limpiarBaseDeDatos();drive.calls=0;});
afterEach(async()=>{await app?.close();app=undefined;});
async function scenario(){
 const [corrector,other,specialist]=await Promise.all([crearUsuario('corrector'),crearUsuario('corrector'),crearUsuario('especialista')]);
 const p=await crearProyectoDePrueba({especialistaId:specialist.id});
 const create=async(alcance:'tripa_completa'|'preliminares'|'cubierta_extendida'='tripa_completa', owner=corrector, projectId=p.id)=>{
  const c=await solicitarCorreccion(projectId,{alcance,paginas:90},specialist.id);
  expect(await asignarCorrector(c.id,{correctorId:owner.id,freelance:false,contratoConfirmado:true},specialist.id)).toMatchObject({ok:true});
  const [row]=await db.select().from(correcciones).where(eq(correcciones.id,c.id));return row!;
 };
 const dashboard=()=>getCorrectorDashboard(corrector.id,now);
 return {corrector,other,specialist,p,create,dashboard};
}
describe('Corrector · Inicio operativo',()=>{
 it('cuenta activa sin asignaciones: resumen cero, lista vacía y próxima fecha nula',async()=>{
  const f=await scenario(),d=await f.dashboard();expect(d.summary).toEqual({active:0,dueSoon:0,overdue:0,completedThisMonth:0});expect(d.attentionItems).toEqual([]);expect(d.nextDeadline).toBeNull();
 });
 it('una asignación representa una intervención propia con alcance real, no un capítulo inventado',async()=>{
  const f=await scenario(),c=await f.create();const d=await f.dashboard();expect(d.summary.active).toBe(1);expect(d.attentionItems[0]).toMatchObject({correctionId:c.id,workItemId:c.workItemId,projectId:f.p.id,intervention:'Tripa completa',state:'assigned',stateLabel:'Asignada',cta:'Abrir trabajo',actionable:true});expect(d.attentionItems[0]?.deadline).toBe(c.dueAt?.toISOString());
 });
 it('tres correcciones de un mismo proyecto cuentan como tres trabajos sin duplicados',async()=>{
  const f=await scenario();await f.create();await f.create('preliminares');await f.create('cubierta_extendida');const d=await f.dashboard();expect(d.summary.active).toBe(3);expect(new Set(d.attentionItems.map(i=>i.workItemId)).size).toBe(3);
 });
 it('SLA central: vencida primero, próxima dentro de 24h y siguiente entrega exacta de 12h',async()=>{
  const f=await scenario(),late=await f.create(),soon=await f.create('preliminares'),later=await f.create('cubierta_extendida');
  await db.update(correcciones).set({dueAt:new Date(now.getTime()-1)}).where(eq(correcciones.id,late.id));
  await db.update(correcciones).set({dueAt:new Date(now.getTime()+12*3600000)}).where(eq(correcciones.id,soon.id));
  await db.update(correcciones).set({dueAt:new Date(now.getTime()+48*3600000),fechaInicio:'2026-10-27'}).where(eq(correcciones.id,later.id));
  const d=await f.dashboard();expect(d.summary).toMatchObject({overdue:1,dueSoon:1});expect(d.attentionItems.map(i=>i.correctionId)).toEqual([late.id,soon.id,later.id]);expect(d.nextDeadline?.correctionId).toBe(soon.id);expect(d.attentionItems[2]?.cta).toBe('Continuar');
 });
 it('pausa de proyecto y bloqueo no imputan vencimiento al Corrector',async()=>{
  const f=await scenario(),a=await f.create();await db.update(correcciones).set({dueAt:new Date('2026-09-01')}).where(eq(correcciones.id,a.id));
  await db.update(workItems).set({estado:'bloqueado',gateBloqueante:'Falta material autorizado'}).where(eq(workItems.id,a.workItemId));
  let d=await f.dashboard();expect(d.summary.overdue).toBe(0);expect(d.attentionItems[0]).toMatchObject({state:'blocked',blocker:'Falta material autorizado',actionable:false,deadlineState:null,cta:'Ver trabajo'});expect(d.nextDeadline).toBeNull();
  await db.update(proyectos).set({estado:'pausado'}).where(eq(proyectos.id,f.p.id));d=await f.dashboard();expect(d.attentionItems[0]?.state).toBe('paused');expect(d.summary.dueSoon).toBe(0);
 });
 it('entrega sale de activas, aparece en entregadas del mes y misma cuenta recibe otro proyecto',async()=>{
  const f=await scenario(),a=await f.create();await registrarEntregaCorreccion(a.id,{fecha:'2026-10-20',entregadoEn:'2026-10-20T15:00:00Z'},f.corrector.id);
  const p2=await crearProyectoDePrueba({especialistaId:f.specialist.id});const b=await f.create('preliminares',f.corrector,p2.id);
  const d=await f.dashboard();expect(d.summary).toMatchObject({active:1,completedThisMonth:1});expect(d.attentionItems[0]?.correctionId).toBe(b.id);expect(d.recentCompleted[0]).toMatchObject({correctionId:a.id,state:'completed',cta:'Ver entrega'});
 });
 it('completadas antiguas no inflan el mes actual y fecha legacy no inventa hora',async()=>{
  const f=await scenario(),a=await f.create(),b=await f.create('preliminares');
  await registrarEntregaCorreccion(a.id,{fecha:'2026-09-20'},f.corrector.id);await registrarEntregaCorreccion(b.id,{fecha:'2026-10-20'},f.corrector.id);
  const d=await f.dashboard();expect(d.summary.completedThisMonth).toBe(1);expect(d.recentCompleted[0]?.completedAt).toBe('2026-10-20');expect(d.summary.active).toBe(0);
 });
 it('participación finalizada conserva una entrega propia y la cuenta puede recibir otra asignación',async()=>{
  const f=await scenario(),a=await f.create();
  await db.update(projectAssignments).set({asignadoEn:new Date('2026-10-01T12:00:00Z')}).where(eq(projectAssignments.workItemId,a.workItemId));
  await registrarEntregaCorreccion(a.id,{fecha:'2026-10-20',entregadoEn:'2026-10-20T15:00:00Z'},f.corrector.id);
  await db.update(projectAssignments).set({finalizadoEn:new Date('2026-10-21T12:00:00Z')}).where(eq(projectAssignments.workItemId,a.workItemId));
  const p2=await crearProyectoDePrueba({especialistaId:f.specialist.id});await f.create('preliminares',f.corrector,p2.id);
  const d=await f.dashboard();expect(d.summary).toMatchObject({active:1,completedThisMonth:1});expect(d.recentCompleted[0]?.correctionId).toBe(a.id);
  const {listarMisCorrecciones}=await import('../server/helpers/correcciones.js');expect((await listarMisCorrecciones(f.corrector.id)).some(c=>c.id===a.id)).toBe(true);
 });
 it('mes del negocio usa Caracas: 1 oct 02:00 UTC todavía pertenece a septiembre',async()=>{
  const f=await scenario(),a=await f.create();await registrarEntregaCorreccion(a.id,{fecha:'2026-09-30',entregadoEn:'2026-10-01T02:00:00Z'},f.corrector.id);expect((await f.dashboard()).summary.completedThisMonth).toBe(0);
 });
 it('reasignación elimina acceso al anterior y asignación canónica impide usar puntero legacy obsoleto',async()=>{
  const f=await scenario(),a=await f.create();expect(await asignarCorrector(a.id,{correctorId:f.other.id,freelance:false,contratoConfirmado:true},f.specialist.id)).toMatchObject({ok:true});
  await db.update(correcciones).set({correctorId:f.corrector.id}).where(eq(correcciones.id,a.id));
  expect((await f.dashboard()).summary.active).toBe(0);expect((await getCorrectorDashboard(f.other.id,now)).summary.active).toBe(1);
  expect((await db.select().from(projectAssignments).where(and(eq(projectAssignments.workItemId,a.workItemId),eq(projectAssignments.usuarioId,f.corrector.id))))[0]?.finalizadoEn).toBeTruthy();
 });
 it('historial de asignación finalizado no concede acceso a trabajos activos y fallback legacy solo sin historial',async()=>{
  const f=await scenario(),a=await f.create();await db.update(projectAssignments).set({finalizadoEn:new Date()}).where(eq(projectAssignments.workItemId,a.workItemId));expect((await f.dashboard()).summary.active).toBe(0);
  const [w]=await db.insert(workItems).values({proyectoId:f.p.id,tipo:'correccion',businessKey:'legacy',estado:'en_progreso'}).returning();await db.insert(correcciones).values({proyectoId:f.p.id,workItemId:w!.id,alcance:'preliminares',correctorId:f.corrector.id});expect((await f.dashboard()).summary.active).toBe(1);
 });
 it('freelance con cuenta usa la misma proyección; freelance sin cuenta no aparece por nombre',async()=>{
  const f=await scenario(),a=await f.create();await db.update(correcciones).set({freelance:true}).where(eq(correcciones.id,a.id));expect((await f.dashboard()).summary.active).toBe(1);
  await db.update(correcciones).set({correctorId:null,correctorNombre:f.corrector.nombre}).where(eq(correcciones.id,a.id));await db.update(projectAssignments).set({finalizadoEn:new Date()}).where(eq(projectAssignments.workItemId,a.workItemId));expect((await f.dashboard()).summary.active).toBe(0);
 });
 it('resumen completo antes de limitar filas; no Drive, una consulta y sin escrituras al abrir',async()=>{
  const f=await scenario();for(let n=0;n<10;n++){const p=await crearProyectoDePrueba({especialistaId:f.specialist.id});await f.create('preliminares',f.corrector,p.id);}
  const before=await db.select().from(auditLogs);const spy=vi.spyOn(pool,'query');const d=await f.dashboard();expect(spy).toHaveBeenCalledTimes(1);spy.mockRestore();expect(d.activeTotal).toBe(10);expect(d.attentionItems).toHaveLength(8);expect(drive.calls).toBe(0);expect(await db.select().from(auditLogs)).toHaveLength(before.length);
 });
 it('API exige sesión, rol y cuenta activa; IDOR en deep link no expone trabajo ajeno',async()=>{
  const f=await scenario(),a=await f.create('preliminares',f.other);app=crearAppDePrueba();await app.ready();
  const login=async(email:string)=>{const r=await request(app!.server).post('/api/auth/login').send({email,password:'password123'});return r.headers['set-cookie']![0]!.split(';')[0]!;};
  expect((await request(app.server).get('/api/correcciones/inicio')).status).toBe(401);
  expect((await request(app.server).get('/api/correcciones/inicio').set('Cookie',await login(f.specialist.email))).status).toBe(403);
  const cookie=await login(f.corrector.email);const own=await request(app.server).get('/api/correcciones/inicio').set('Cookie',cookie);expect(own.status).toBe(200);expect(own.body.summary.active).toBe(0);
  expect((await request(app.server).get('/api/correcciones/mias?workItem='+a.workItemId).set('Cookie',cookie)).status).toBe(404);
  expect((await request(app.server).get('/api/proyectos/'+f.p.id+'/correcciones').set('Cookie',cookie)).status).toBe(403);
  expect((await request(app.server).get('/api/correcciones/inicio?correctorId='+f.other.id).set('Cookie',cookie)).status).toBe(400);
  await db.update(users).set({activo:false}).where(eq(users.id,f.corrector.id));expect((await request(app.server).get('/api/correcciones/inicio').set('Cookie',cookie)).status).toBe(401);
 });
});
