import {randomUUID} from 'node:crypto';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import {and,eq,sql} from 'drizzle-orm';
import {db,pool} from '../server/db/client.js';
import {adminOperations,auditLogs,capitulos,editorialDeliveries,externalIntegrations,fichasTrazabilidad,notificaciones,pausas,projectAssignments,projectDriveFolders,projectDriveWorkspaces,projectWorkspaceRequests,proyectos,securityEvents,servicios,sessions,solicitudesArea,users,workItems,type Rol} from '../server/db/schema/index.js';
import {createSession,hashToken} from '../server/helpers/session.js';
import {crearProyecto} from '../server/helpers/proyectos.js';
import {hashPassword} from '../server/helpers/password.js';
import {asignarConHistorial} from '../server/helpers/assignments.js';
import {ajustarPlazoEdicionPorPausas} from '../server/helpers/edicionSla.js';
import {adminProjects} from '../server/modules/admin/projects.js';
import {adminFolderFiles} from '../server/modules/admin/integrations.js';
import {safeAdminData} from '../server/modules/admin/policy.js';
import {env} from '../server/config/env.js';
import {limpiarBaseDeDatos} from './helpers/db.js';
import {crearProyectoDePrueba} from './helpers/fixtures.js';
import {crearAppDePrueba} from './helpers/testApp.js';
const probe=vi.hoisted(()=>({down:false}));
vi.mock('ioredis',()=>({Redis:class{on(){}async connect(){if(probe.down)throw new Error('redis://private-credential');}async ping(){return 'PONG';}disconnect(){}}}));
vi.mock('bullmq',()=>({Queue:class{async getJobCounts(){return {waiting:1,active:0,failed:1,delayed:0};}async getJobs(){return [{id:'job-1',name:'provision-project-drive-workspace',finishedOn:Date.now(),attemptsMade:2,data:{projectId:'not-a-uuid',token:'never-return-this'},failedReason:'password=never-return-this'}];}async close(){}}}));
const app=crearAppDePrueba();let passwordHash:string;let admin:typeof users.$inferSelect;let cookie:string;let count=0;
async function user(role:Rol='editor'){const [u]=await db.insert(users).values({nombre:'Persona '+(++count),email:`admin-test-${count}@example.test`,rol:role,passwordHash}).returning();return u!;}
async function login(u:typeof users.$inferSelect){return env.SESSION_COOKIE_NAME+'='+await createSession(u.id,{ip:'127.0.0.1',userAgent:'PanHouse test browser'});}
const command=<T extends object>(extra:T={} as T)=>({reason:'Intervención administrativa documentada',requestKey:randomUUID(),...extra});
async function call(method:'GET'|'POST'|'PATCH'|'DELETE',url:string,payload?:object,auth:string|null=cookie){return app.inject({method,url,headers:auth?{cookie:auth}:{},payload});}
async function project(){return crearProyectoDePrueba();}
async function work(projectId:string,type='edicion',state:'pendiente'|'en_progreso'|'completado'|'bloqueado'='en_progreso',key:string=randomUUID()) {return (await db.insert(workItems).values({proyectoId:projectId,tipo:type,estado:state,businessKey:key,fechaFinPautada:'2020-01-01'}).returning())[0]!;}
async function assignment(projectId:string,u:typeof users.$inferSelect,type:'editor'|'especialista'='editor'){
 return db.transaction(async tx=>{const a=await asignarConHistorial(tx,{proyectoId:projectId,usuarioId:u.id,tipo:type,asignadoPorId:admin.id});await tx.update(proyectos).set(type==='editor'?{editorId:u.id}:{especialistaId:u.id}).where(eq(proyectos.id,projectId));return a;});
}
beforeAll(async()=>{passwordHash=await hashPassword('password123');await app.ready();});
afterAll(async()=>{await app.close();});
beforeEach(async()=>{await limpiarBaseDeDatos();probe.down=false;admin=await user('admin');cookie=await login(admin);});
describe('Administración · seguridad, proyecciones y operaciones de dominio',()=>{
 it('identifica la sesión actual sin exponer el token ni su hash',async()=>{
  const r=await call('GET','/api/admin/sesiones');expect(r.statusCode).toBe(200);expect(r.json().items[0].current).toBe(true);expect(r.body).not.toContain(hashToken(cookie.split('=')[1]!));
 });
 it('emisión y validación de sesión comparten reloj y siguen rechazando expiración real',async()=>{
  try{
   vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2020-01-01T12:00:00Z'));
   const e=await user(),auth=await login(e);expect((await call('GET','/api/auth/me',undefined,auth)).statusCode).toBe(200);
   const {rows:[r]}=await pool.query<{seconds:number}>('SELECT extract(epoch from(expires_at-now()))::int seconds FROM sesiones WHERE user_id=$1',[e.id]);expect(r!.seconds).toBeGreaterThan(env.SESSION_TTL_HOURS*3600-60);
   await db.update(sessions).set({expiresAt:new Date('2000-01-01T00:00:00Z')}).where(eq(sessions.userId,e.id));expect((await call('GET','/api/auth/me',undefined,auth)).statusCode).toBe(401);
  }finally{vi.useRealTimers();}
 });
 it('desactivar un servicio impide nuevas altas y conserva proyectos existentes',async()=>{
  const p=await project();await call('POST','/api/admin/servicios/'+p.servicioId+'/disponibilidad',command({active:false,expectedActive:true}));
  const result=await crearProyecto({autorIds:[p.autorId],servicioId:p.servicioId,unidadId:p.unidadId,presupuestoId:p.presupuestoId,fechaProgramadaInicio:'2026-10-28'});expect(result).toMatchObject({ok:false,status:400});expect((await db.select().from(proyectos))).toHaveLength(1);
 });
 it('un responsable que cambió de rol queda pendiente y no ofrece reapertura',async()=>{
  const p=await project(),e=await user();await assignment(p.id,e);await work(p.id,'edicion','completado');await db.update(users).set({rol:'comercial'}).where(eq(users.id,e.id));
  const r=(await call('GET','/api/admin/proyectos/'+p.id)).json();expect(r.works[0].canReopen).toBe(false);
  await work(p.id);expect((await call('GET','/api/admin/pipeline?unassigned=true')).json().total).toBe(1);
  const specialist=await user('especialista');await assignment(p.id,specialist,'especialista');await db.update(proyectos).set({notificadoJefatura:true}).where(eq(proyectos.id,p.id));await db.update(users).set({activo:false}).where(eq(users.id,specialist.id));expect((await call('GET','/api/admin/proyectos/'+p.id)).json().missingOwner).toBe(true);
 });
 it('separa Dirección de Admin y protege todos los módulos',async()=>{
  for(const role of ['direccion','comercial','editor','especialista','soporte_digital'] as const){const auth=await login(await user(role));for(const path of ['inicio','pipeline','proyectos','usuarios','sesiones','actividad','solicitudes','integraciones','configuracion','salud'])expect((await call('GET','/api/admin/'+path,undefined,auth)).statusCode).toBe(403);}
  expect((await call('GET','/api/admin/inicio',undefined,null)).statusCode).toBe(401);
 });
 it('no permite headers falsos de permisos ni mutaciones raw',async()=>{
  const auth=await login(await user('editor'));expect((await app.inject({url:'/api/admin/proyectos',headers:{cookie:auth,'x-admin':'true','x-view-as-user':admin.id}})).statusCode).toBe(403);
  expect((await call('PATCH','/api/admin/audit/'+randomUUID(),{details:{}})).statusCode).toBe(404);
  expect((await call('DELETE','/api/admin/usuarios/'+admin.id)).statusCode).toBe(404);
 });
 it('expone un inicio vacío honesto y el catálogo de permisos de solo lectura',async()=>{
  const r=await call('GET','/api/admin/inicio');expect(r.statusCode).toBe(200);expect(r.json()).toMatchObject({active:0,attention:0,blocked:0,overdue:0,items:[]});
  expect((await call('GET','/api/admin/policy')).json()).toMatchObject({editable:false});
 });
 it('pipeline representa tres procesos paralelos y múltiples tareas del mismo tipo',async()=>{
  const p=await project();await Promise.all([work(p.id),work(p.id),work(p.id,'direccion_creativa'),work(p.id,'soporte_digital')]);
  const r=await adminProjects({page:1,pageSize:10,search:''});expect(r.items).toHaveLength(1);expect(r.items[0]!.works).toHaveLength(4);expect(new Set(r.items[0]!.works.map(w=>w.type)).size).toBe(3);expect(r.columns).toHaveLength(3);
 });
 it('Admin consulta cualquier proyecto sin assignment y conserva historial de equipo',async()=>{
  const p=await project();const e=await user();await assignment(p.id,e);await work(p.id);
  const r=await call('GET','/api/admin/proyectos/'+p.id);expect(r.statusCode).toBe(200);expect(r.json().works[0].responsible).toBe(e.nombre);
  expect((await call('GET',`/api/admin/proyectos/${p.id}/equipo`)).json().total).toBe(1);
 });
 it('una fuente de bloqueo coincide en Inicio, Pipeline y Project 360',async()=>{
  const p=await project();await work(p.id,'edicion','bloqueado');
  expect((await call('GET','/api/admin/inicio')).json().blocked).toBe(1);
  expect((await call('GET','/api/admin/pipeline?blocked=true')).json().total).toBe(1);
  expect((await call('GET','/api/admin/proyectos/'+p.id)).json().blocked).toBe(true);
 });
 it('waiting del autor o pausa del proyecto no se convierte en atraso del Editor',async()=>{
  const p=await project();const [chapter]=await db.insert(capitulos).values({proyectoId:p.id,numero:1,fechaInicioEditor:'2020-01-01',fechaEntregaEditor:'2020-01-02',fechaEnvioAutor:'2020-01-03'}).returning();
  await work(p.id,'edicion','en_progreso','capitulo:'+chapter!.id);
  const first=(await adminProjects({page:1,pageSize:10,search:''})).items[0]!;expect(first.works[0]!.waiting).toBe('Autor');expect(first.overdue).toBe(false);
  await db.update(proyectos).set({estado:'pausado'}).where(eq(proyectos.id,p.id));expect((await adminProjects({page:1,pageSize:10,search:'',overdue:true})).total).toBe(0);
 });
 it('la proyección SQL replica el ajuste central de SLA por pausas superpuestas',async()=>{
  const p=await project();const intervals=[{start:'2026-01-06',end:'2026-01-09'},{start:'2026-01-07',end:'2026-01-12'}];
  await db.insert(pausas).values(intervals.map(i=>({proyectoId:p.id,causa:'autor' as const,fechaInicio:new Date(i.start+'T12:00:00Z'),fechaFin:new Date(i.end+'T12:00:00Z')})));
  const r=await pool.query<{due:string}>(`SELECT panhouse_editor_deadline('2026-01-05','2026-01-08',$1,'2026-02-01')::text due`,[p.id]);expect(r.rows[0]!.due).toBe(ajustarPlazoEdicionPorPausas('2026-01-05','2026-01-08',intervals,'2026-02-01'));
 });
 it('filtra y pagina en SQL sin una consulta por celda o proyecto',async()=>{
  const p=await project();await db.insert(proyectos).values(Array.from({length:30},(_,i)=>({autorId:p.autorId,servicioId:p.servicioId,unidadId:p.unidadId,presupuestoId:p.presupuestoId,codigo:'PAG-'+i,fechaProgramadaInicio:'2026-01-01'})));
  const spy=vi.spyOn(pool,'query');const r=await call('GET','/api/admin/pipeline?page=2&pageSize=10&search=PAG-');expect(r.statusCode).toBe(200);expect(r.json()).toMatchObject({total:30,page:2,pages:3});expect(r.json().items).toHaveLength(10);expect(spy.mock.calls.length).toBeLessThanOrEqual(2);spy.mockRestore();
  expect((await call('GET','/api/admin/pipeline?search=%25')).json().total).toBe(0);
 });
 it('detecta referencias que contradicen el historial canónico',async()=>{
  const p=await project(),s=await user('especialista'),other=await user('especialista');await assignment(p.id,s,'especialista');await db.update(proyectos).set({especialistaId:other.id}).where(eq(proyectos.id,p.id));
  const r=await call('GET','/api/admin/pipeline?inconsistent=true');expect(r.json().items[0]).toMatchObject({specialistId:s.id,inconsistent:true});
 });
 it('incluye responsables legacy sin inventar fechas y permite una reasignación trazable',async()=>{
  const p=await project(),old=await user(),next=await user();await db.update(proyectos).set({editorId:old.id}).where(eq(proyectos.id,p.id));
  const before=(await call('GET',`/api/admin/proyectos/${p.id}/equipo`)).json();expect(before.items.find((a:{type:string})=>a.type==='editor')).toMatchObject({legacy:true,from:null,userId:old.id,canReassign:true});
  expect((await call('GET','/api/admin/usuarios/'+old.id)).json().assignments).toBe(1);
  expect((await call('POST',`/api/admin/proyectos/${p.id}/reasignar`,command({type:'editor',userId:next.id,expectedAssignmentId:null,expectedUserId:old.id}))).statusCode).toBe(200);
  const after=(await call('GET',`/api/admin/proyectos/${p.id}/equipo`)).json();expect(after.total).toBe(1);expect(after.items[0]).toMatchObject({legacy:false,userId:next.id});
  expect((await call('GET','/api/admin/usuarios/'+old.id)).json().assignments).toBe(0);expect((await call('GET','/api/admin/usuarios/'+next.id)).json().assignments).toBe(1);
  expect((await call('GET','/api/admin/actividad?user='+old.id)).json().items[0].details).toMatchObject({before:{userId:old.id,userName:old.nombre},after:{userId:next.id,userName:next.nombre}});
 });
 it('repara un puntero contradictorio conservando la asignación canónica y su historia',async()=>{
  const p=await project(),canonical=await user(),stale=await user();const a=await assignment(p.id,canonical);await db.update(proyectos).set({editorId:stale.id}).where(eq(proyectos.id,p.id));
  const team=(await call('GET',`/api/admin/proyectos/${p.id}/equipo`)).json();expect(team.items[0]).toMatchObject({legacy:false,referenceInconsistent:true,canReassign:true});
  expect((await call('POST',`/api/admin/proyectos/${p.id}/reasignar`,command({type:'editor',userId:canonical.id,expectedAssignmentId:a.asignacionId,expectedUserId:canonical.id}))).statusCode).toBe(200);
  const history=await db.select().from(projectAssignments).where(eq(projectAssignments.proyectoId,p.id));expect(history).toHaveLength(1);expect(history[0]!.id).toBe(a.asignacionId);expect(history[0]!.finalizadoEn).toBeNull();
  expect((await call('GET','/api/admin/proyectos/'+p.id)).json().inconsistent).toBe(false);
  const events=(await call('GET','/api/admin/actividad?user='+stale.id)).json();expect(events.items[0]).toMatchObject({action:'ADMIN_ASSIGNMENT_REFERENCE_REPAIRED',details:{before:{legacyUserId:stale.id,legacyUserName:stale.nombre},after:{legacyUserId:canonical.id,userName:canonical.nombre}}});
  expect((await db.select().from(notificaciones))).toHaveLength(2);
 });
 it('crear usuario exige motivo, contraseña segura y no devuelve secretos',async()=>{
  expect((await call('POST','/api/admin/usuarios',{...command(),name:'Nuevo usuario',email:'nuevo@example.test',role:'editor',password:'corta'})).statusCode).toBe(400);
  const body=command({name:'Nuevo usuario',email:'nuevo@example.test',role:'editor',accountType:'internal',password:'Una clave solo para pruebas 123'});
  const r=await call('POST','/api/admin/usuarios',body);expect(r.statusCode).toBe(200);expect(r.body).not.toMatch(/password|hash|token/i);
  const replay=await call('POST','/api/admin/usuarios',body);expect(replay.json()).toMatchObject({id:r.json().id,reused:true});
  const changedPassword=await call('POST','/api/admin/usuarios',{...body,password:'Otra contraseña que no debe cambiar la cuenta'});expect(changedPassword.json()).toMatchObject({id:r.json().id,reused:true});
  expect((await call('POST','/api/auth/login',{email:body.email,password:body.password},null)).statusCode).toBe(200);expect((await call('POST','/api/auth/login',{email:body.email,password:'Otra contraseña que no debe cambiar la cuenta'},null)).statusCode).toBe(401);
  const account=(await call('GET','/api/admin/usuarios/'+r.json().id)).json();expect(account.email).toBe('nuevo@example.test');expect(account).not.toHaveProperty('passwordHash');
 });
 it('admite colaboradores externos persistentes sin concederles roles internos',async()=>{
  const payload=command({name:'Corrector externo',email:'externo@example.test',role:'corrector',accountType:'external',password:'Una clave temporal de prueba 123'});
  const r=await call('POST','/api/admin/usuarios',payload);expect(r.statusCode).toBe(200);expect((await call('GET','/api/admin/usuarios?tab=external')).json().total).toBe(1);
  const u=(await call('GET','/api/admin/usuarios/'+r.json().id)).json();expect((await call('POST',`/api/admin/usuarios/${u.id}/acceso`,command({expectedVersion:u.version,role:'admin'}))).statusCode).toBe(400);
 });
 it('una cuenta de Autor exige un registro real y audita su vínculo sin crear otra ficha',async()=>{
  const p=await project();const body=command({name:'Cuenta de Autor',email:'autor-admin@example.test',role:'autor',accountType:'internal',password:'Clave de prueba para autor 123'});
  expect((await call('POST','/api/admin/usuarios',body)).statusCode).toBe(400);
  const r=await call('POST','/api/admin/usuarios',{...body,requestKey:randomUUID(),authorId:p.autorId});expect(r.statusCode).toBe(200);
  const account=(await call('GET','/api/admin/usuarios/'+r.json().id)).json();expect(account).toMatchObject({role:'autor',authorId:p.autorId});expect(account.authorName).toBeTruthy();
  const [event]=await db.select().from(auditLogs).where(and(eq(auditLogs.accion,'ADMIN_USER_CREATED'),eq(auditLogs.entityId,r.json().id)));expect(event!.detalles).toMatchObject({after:{autorId:p.autorId}});
 });
 it('desactivar revoca realmente las sesiones y conserva cuenta, eventos e historial',async()=>{
  const e=await user();const auth=await login(e);const u=(await call('GET','/api/admin/usuarios/'+e.id)).json();
  expect((await call('POST',`/api/admin/usuarios/${e.id}/acceso`,command({expectedVersion:u.version,active:false}))).statusCode).toBe(200);
  expect((await call('GET','/api/auth/me',undefined,auth)).statusCode).toBe(401);expect((await db.select().from(users).where(eq(users.id,e.id)))[0]!.activo).toBe(false);
  expect((await call('GET','/api/admin/sesiones?user='+e.id)).json().items[0].state).toBe('revoked');expect((await db.select().from(securityEvents).where(eq(securityEvents.action,'ACCOUNT_DISABLED')))).toHaveLength(1);
 });
 it('cambiar rol revoca permisos de sesiones anteriores y registra before/after',async()=>{
  const e=await user(),auth=await login(e);const u=(await call('GET','/api/admin/usuarios/'+e.id)).json();
  expect((await call('POST',`/api/admin/usuarios/${e.id}/acceso`,command({expectedVersion:u.version,role:'corrector'}))).statusCode).toBe(200);
  expect((await call('GET','/api/auth/me',undefined,auth)).statusCode).toBe(401);
  const [event]=await db.select().from(auditLogs).where(eq(auditLogs.accion,'ADMIN_USER_UPDATED'));expect(event!.detalles).toMatchObject({before:{role:'editor'},after:{role:'corrector',sessionsRevoked:true}});
 });
 it('protege al último administrador y rechaza versiones antiguas de usuario',async()=>{
  const current=(await call('GET','/api/admin/usuarios/'+admin.id)).json();expect((await call('POST',`/api/admin/usuarios/${admin.id}/acceso`,command({expectedVersion:current.version,role:'editor'}))).statusCode).toBe(409);
  expect((await call('POST',`/api/admin/usuarios/${admin.id}/acceso`,command({expectedVersion:'2000-01-01T00:00:00Z',active:false}))).statusCode).toBe(409);
 });
 it('revocar sesión usa UUID público y nunca entrega hash ni cookie',async()=>{
  const e=await user(),auth=await login(e);const list=(await call('GET','/api/admin/sesiones?user='+e.id)).json();const s=list.items[0];expect(s.id).toMatch(/^[0-9a-f-]{36}$/);expect(s.maskedId).toMatch(/^…/);expect(s).not.toHaveProperty('token');expect(s).not.toHaveProperty('session_hash');
  const body=command();expect((await call('POST',`/api/admin/sesiones/${s.id}/revocar`,body)).statusCode).toBe(200);expect((await call('POST',`/api/admin/sesiones/${s.id}/revocar`,body)).json().reused).toBe(true);expect((await call('GET','/api/auth/me',undefined,auth)).statusCode).toBe(401);
 });
 it('login, actividad reciente y logout quedan registrados sin afirmar online',async()=>{
  const e=await user();const r=await call('POST','/api/auth/login',{email:e.email,password:'password123'},undefined);expect(r.statusCode).toBe(200);const auth=r.headers['set-cookie'] as string;
  expect((await call('GET','/api/auth/me',undefined,auth)).statusCode).toBe(200);expect((await call('POST','/api/auth/logout',{},auth)).statusCode).toBe(200);expect((await call('GET','/api/auth/me',undefined,auth)).statusCode).toBe(401);
  const history=(await call('GET','/api/admin/actividad?tab=security')).json();expect(history.items.map((x:{action:string})=>x.action)).toContain('LOGOUT');expect(JSON.stringify(history)).not.toContain('password123');
 });
 it('Ver como utiliza el scope del usuario y bloquea mutaciones incluso en rutas antiguas',async()=>{
  const e=await user();expect((await call('POST','/api/admin/view-as/start',command({userId:e.id}))).statusCode).toBe(200);
  expect((await call('GET','/api/auth/me')).json().user).toMatchObject({id:e.id,rol:'editor',adminView:{active:true}});
  expect((await call('POST','/api/proyectos/'+randomUUID()+'/equipo',{})).statusCode).toBe(403);
  expect((await call('POST','/api/auth/login',{email:admin.email,password:'password123'})).statusCode).toBe(403);
  expect((await call('GET','/api/admin/usuarios')).statusCode).toBe(403);
  expect((await call('POST','/api/admin/view-as/stop',command())).statusCode).toBe(200);expect((await call('GET','/api/auth/me')).json().user.id).toBe(admin.id);
  const events=await db.select().from(auditLogs).where(eq(auditLogs.accion,'ADMIN_VIEW_AS_STARTED'));expect(events[0]!.actorId).toBe(admin.id);
 });
 it('Ver como Dirección no permite mutar la integración desde su callback GET',async()=>{
  const d=await user('direccion');expect((await call('POST','/api/admin/view-as/start',command({userId:d.id}))).statusCode).toBe(200);
  expect((await call('GET','/api/auth/google/callback?state=invalid&code=invalid')).statusCode).toBe(403);
  expect((await call('POST','/api/admin/view-as/stop',command())).statusCode).toBe(200);
 });
 it('la vista como usuario no otorga acceso a proyectos de otro Editor',async()=>{
  const e=await user(),other=await user(),p=await project();await assignment(p.id,other);await call('POST','/api/admin/view-as/start',command({userId:e.id}));
  expect((await call('GET',`/api/fichas-trazabilidad/${p.id}/resumen`)).statusCode).not.toBe(200);
  await call('POST','/api/admin/view-as/stop',command());
 });
 it('re asigna atómicamente mediante historial, referencia actual, audit y avisos a ambas personas',async()=>{
  const p=await project(),a=await user('especialista'),b=await user('especialista');const assignmentBefore=await assignment(p.id,a,'especialista');await work(p.id,'soporte_digital');
  const body=command({type:'especialista',userId:b.id,expectedAssignmentId:assignmentBefore.asignacionId,expectedUserId:a.id});const r=await call('POST',`/api/admin/proyectos/${p.id}/reasignar`,body);expect(r.statusCode).toBe(200);
  expect((await db.select().from(proyectos).where(eq(proyectos.id,p.id)))[0]!.especialistaId).toBe(b.id);
  const history=await db.select().from(projectAssignments).where(eq(projectAssignments.proyectoId,p.id));expect(history).toHaveLength(2);expect(history.find(x=>x.usuarioId===a.id)!.finalizadoEn).not.toBeNull();
  expect((await db.select().from(auditLogs).where(eq(auditLogs.accion,'ADMIN_REASSIGN')))).toHaveLength(1);expect((await db.select().from(notificaciones))).toHaveLength(2);
  expect((await call('POST',`/api/admin/proyectos/${p.id}/reasignar`,body)).json().reused).toBe(true);expect((await db.select().from(notificaciones))).toHaveLength(2);
 });
 it('reasignación concurrente o stale solo admite un cambio y no sobrescribe el otro',async()=>{
  const p=await project(),a=await user(),b=await user(),c=await user();const before=await assignment(p.id,a);const base={type:'editor',expectedAssignmentId:before.asignacionId,expectedUserId:a.id};
  const replies=await Promise.all([call('POST',`/api/admin/proyectos/${p.id}/reasignar`,command({...base,userId:b.id})),call('POST',`/api/admin/proyectos/${p.id}/reasignar`,command({...base,userId:c.id}))]);expect(replies.map(r=>r.statusCode).sort()).toEqual([200,409]);
 });
 it('override exige motivo y rechaza un destino de rol incorrecto sin dejar cambios parciales',async()=>{
  const p=await project(),e=await user(),wrong=await user('comercial');const before=await assignment(p.id,e);const data={type:'editor',userId:wrong.id,expectedAssignmentId:before.asignacionId,expectedUserId:e.id};
  expect((await call('POST',`/api/admin/proyectos/${p.id}/reasignar`,{...command(data),reason:''})).statusCode).toBe(400);expect((await call('POST',`/api/admin/proyectos/${p.id}/reasignar`,command(data))).statusCode).toBe(400);
  expect((await db.select().from(projectAssignments).where(eq(projectAssignments.proyectoId,p.id)))).toHaveLength(1);expect((await db.select().from(adminOperations))).toHaveLength(0);
 });
 it('reabre únicamente un cierre editorial sin evidencia, conservando el hecho anterior en audit',async()=>{
  const p=await project(),e=await user();await assignment(p.id,e);const w=await work(p.id,'edicion','completado');
  const r=await call('POST',`/api/admin/work-items/${w.id}/reabrir`,command({expectedVersion:w.updatedAt.toISOString()}));expect(r.statusCode).toBe(200);expect((await db.select().from(workItems).where(eq(workItems.id,w.id)))[0]!.estado).toBe('en_progreso');
  expect((await db.select().from(auditLogs).where(eq(auditLogs.accion,'ADMIN_REOPEN_WORK_ITEM')))[0]!.detalles).toMatchObject({before:{state:'completado'},after:{state:'en_progreso'}});
 });
 it('no reabre entregas reales ni crea una transición genérica para otro dominio',async()=>{
  const p=await project(),e=await user();await assignment(p.id,e);const w=await work(p.id,'edicion','completado');await db.insert(editorialDeliveries).values({projectId:p.id,workItemId:w.id,driveUrl:'https://example.test/delivery',submittedBy:e.id});
  expect((await call('POST',`/api/admin/work-items/${w.id}/reabrir`,command({expectedVersion:w.updatedAt.toISOString()}))).statusCode).toBe(409);
  const d=await work(p.id,'soporte_digital','completado');expect((await call('POST',`/api/admin/work-items/${d.id}/reabrir`,command({expectedVersion:d.updatedAt.toISOString()}))).statusCode).toBe(409);
 });
 it('solicitudes globales conservan solicitante, destino, contexto y lifecycle',async()=>{
  const p=await project(),s=await user('especialista'),e=await user('soporte_digital');const w=await work(p.id,'soporte_digital');
  const [r]=await db.insert(solicitudesArea).values({proyectoId:p.id,workItemId:w.id,requestedById:e.id,targetUserId:s.id,tipo:'digital_tecnico',businessKey:randomUUID(),asunto:'Problema real de acceso',descripcion:'No puedo consultar el material requerido.'}).returning();
  const list=await call('GET','/api/admin/solicitudes');expect(list.statusCode).toBe(200);expect(list.json().items[0]).toMatchObject({id:r!.id,family:'area',requesterId:e.id,targetId:s.id,workItemId:w.id});
  expect((await call('GET',`/api/admin/solicitudes/${r!.id}?family=area`)).json().summary.subject).toBe('Problema real de acceso');
  expect((await call('POST',`/api/admin/solicitudes/${r!.id}/intervenir`,command({action:'cancel',expectedVersion:1}))).statusCode).toBe(200);
  expect((await db.select().from(workItems).where(eq(workItems.id,w.id)))[0]!.estado).toBe('en_progreso');
 });
 it('repara destinatario inválido hacia el Especialista canónico sin elegir personas arbitrarias',async()=>{
  const p=await project(),s=await user('especialista'),old=await user('especialista'),e=await user('soporte_digital');await assignment(p.id,s,'especialista');await db.update(users).set({activo:false}).where(eq(users.id,old.id));const w=await work(p.id,'soporte_digital');
  const [r]=await db.insert(solicitudesArea).values({proyectoId:p.id,workItemId:w.id,requestedById:e.id,targetUserId:old.id,tipo:'digital_material',businessKey:randomUUID(),asunto:'Material recibido incompleto',descripcion:'Faltan los archivos necesarios para continuar.'}).returning();
  expect((await call('POST',`/api/admin/solicitudes/${r!.id}/intervenir`,command({action:'repair_target',expectedVersion:1}))).statusCode).toBe(200);expect((await db.select().from(solicitudesArea).where(eq(solicitudesArea.id,r!.id)))[0]!.targetUserId).toBe(s.id);
 });
 it('auditoría pagina, filtra y reduce secretos anidados antes de enviarlos',async()=>{
  const ids=Array.from({length:30},()=>({actorId:admin.id,accion:'ADMIN_TEST',entityType:'usuario',entityId:admin.id,detalles:{before:{passwordHash:'hidden',name:'Antes'},after:{name:'Después'},nested:{refresh_token:'hidden',safe:'permitido'}}}));await db.insert(auditLogs).values(ids);
  const r=await call('GET','/api/admin/actividad?page=2&pageSize=10&action=ADMIN_TEST');expect(r.json()).toMatchObject({total:30,page:2,pages:3});expect(r.body).not.toMatch(/passwordHash|refresh_token|hidden/);expect(r.body).toContain('permitido');
  expect(safeAdminData({password:'x',url:'https://example.test/?access_token=hidden',text:'Bearer hidden'})).toEqual({url:'[enlace con credenciales omitido]',text:'[credencial omitida]'});
 });
 it('configuración muestra catálogo real, reglas y plantillas sin editar plazos históricos',async()=>{
  const p=await project();const r=await call('GET','/api/admin/configuracion');expect(r.statusCode).toBe(200);expect(r.json()).toMatchObject({workflowEditable:false,permissionsEditable:false});expect(r.json().services[0].id).toBe(p.servicioId);expect(r.json().driveTemplates[0].folders[0].key).toBe('ROOT');
  expect((await call('POST',`/api/admin/servicios/${p.servicioId}/disponibilidad`,command({active:false,expectedActive:true}))).statusCode).toBe(200);expect((await db.select().from(proyectos).where(eq(proyectos.id,p.id)))[0]!.servicioId).toBe(p.servicioId);
  expect((await call('PATCH','/api/admin/configuracion/fases/'+randomUUID(),{orden:99})).statusCode).toBe(404);
 });
 it('Drive diagnóstico consulta asociaciones reales y reparación usa el mismo outbox sin duplicarlo',async()=>{
  const p=await project(),s=await user('especialista');await assignment(p.id,s,'especialista');
  expect((await call('GET',`/api/admin/proyectos/${p.id}/workspace`)).json().workspace.status).toBe('PENDING');await db.update(projectWorkspaceRequests).set({status:'ERROR',lastErrorCode:'GOOGLE_UNAVAILABLE'}).where(eq(projectWorkspaceRequests.projectId,p.id));
  const body=command({expectedStatus:'ERROR'});expect((await call('POST',`/api/admin/proyectos/${p.id}/workspace/reparar`,body)).statusCode).toBe(200);expect((await call('POST',`/api/admin/proyectos/${p.id}/workspace/reparar`,body)).json().reused).toBe(true);
  expect((await db.select().from(projectWorkspaceRequests))).toHaveLength(1);expect((await db.select().from(auditLogs).where(eq(auditLogs.accion,'ADMIN_WORKSPACE_REPAIR')))).toHaveLength(1);
 });
 it('Drive no acepta un folderId arbitrario ni una carpeta de otro proyecto',async()=>{
  const p=await project();expect((await call('GET',`/api/admin/proyectos/${p.id}/workspace/files?key=other&folderId=arbitrary`)).statusCode).toBe(400);
  await expect(adminFolderFiles(p.id,'other',undefined,async()=>{throw new Error('Must not call Google');})).rejects.toMatchObject({statusCode:404});
 });
 it('health usa señales reales, reduce datos del job y muestra Redis no disponible cuando falla el probe',async()=>{
  const ok=await call('GET','/api/admin/salud');expect(ok.statusCode).toBe(200);expect(ok.json()).toMatchObject({postgres:{status:'connected'},redis:{status:'connected'},migrations:{status:'up_to_date'},backups:{status:'not_monitored'}});expect(ok.body).not.toContain('never-return-this');
  probe.down=true;const down=await call('GET','/api/admin/salud');expect(down.json().redis.status).toBe('unavailable');expect(down.body).not.toContain('private-credential');
 });
 it('búsqueda global identifica tipos y no busca dentro de secretos',async()=>{
  const r=await call('GET','/api/admin/buscar?search='+encodeURIComponent(admin.nombre));expect(r.statusCode).toBe(200);expect(r.json().items.some((x:{kind:string;id:string})=>x.kind==='user'&&x.id===admin.id)).toBe(true);expect(r.body).not.toContain(passwordHash);
 });
 it('validación de origen, rango, filtros e inputs evita escrituras no autorizadas',async()=>{
  expect((await app.inject({method:'POST',url:'/api/admin/sesiones/'+randomUUID()+'/revocar',headers:{cookie,origin:'https://attacker.example'},payload:command()})).statusCode).toBe(403);
  expect((await call('GET','/api/admin/actividad?from=2026-10-30&to=2026-10-01')).statusCode).toBe(400);expect((await call('GET','/api/admin/pipeline?pageSize=100000')).statusCode).toBe(400);
  expect((await call('POST','/api/admin/usuarios',command({name:'Inyección',email:'x@example.test',role:'admin',password:'1234567890123456',passwordHash:'must-not-accept'}))).statusCode).toBe(400);
 });
});
