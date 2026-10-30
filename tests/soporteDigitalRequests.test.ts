import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { auditLogs, editorialBlockers, fichasTrazabilidad, informacionSolicitudArea, notificaciones, projectAssignments, proyectos, solicitudArchivos, solicitudesArea, workItems } from '../server/db/schema/index.js';
import { createDigitalRequest, detailDigitalRequest, eligibleDigitalRequests, listDigitalRequests } from '../server/helpers/soporteDigitalRequests.js';
import { obtenerDetalleTrabajoDigital } from '../server/helpers/soporteDigitalWork.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import type { CreateDigitalRequest, DigitalRequestType } from '../shared/soporteDigitalRequests.js';

describe('Soporte Digital · Mis solicitudes · sistema canónico', () => {
  let app: ReturnType<typeof buildApp>;
  let support: Awaited<ReturnType<typeof crearUsuario>>, other: typeof support, specialist: typeof support;
  let p: Awaited<ReturnType<typeof crearProyectoDePrueba>>, workId: string, cookies: Record<string,string>;
  const filters = { tab:'all' as const,search:'',page:1,pageSize:10 };
  const payload = (type:DigitalRequestType='digital_material'):CreateDigitalRequest => ({ workItemId:workId,type,subject:'Revisar el material recibido',description:'El archivo recibido necesita revisión del área responsable antes de continuar.',blocksWorkItem:false,idempotencyKey:randomUUID() });
  async function login(user:typeof support) { const r=await app.inject({ method:'POST',url:'/api/auth/login',payload:{ email:user.email,password:'password123' } }); return r.cookies.map(c => c.name+'='+c.value).join('; '); }
  async function call(method:'GET'|'POST'|'PATCH',path:string,body?:object,cookie=cookies.support) {
    const r=await app.inject({ method,url:'/api/soporte-digital'+path,headers:{ cookie },payload:body });
    return { status:r.statusCode,body:r.headers['content-type']?.includes('application/json')?r.json():r.body,headers:r.headers,raw:r.rawPayload };
  }
  const create=(type?:DigitalRequestType) => createDigitalRequest(support,payload(type));
  const decide=(id:string,expectedVersion:number,action:'review'|'return'|'resolve'|'unblock',extra:object={},cookie=cookies.specialist) => call('POST',`/solicitudes-recibidas/${id}/decidir`,{ expectedVersion,action,text:'Revisión realizada por el Especialista coordinador.',...extra },cookie);
  const evidence=(expectedVersion=1) => ({ expectedVersion,uploadKey:randomUUID(),name:'evidencia.pdf',contentBase64:Buffer.from('%PDF-1.4\nEvidencia de prueba\n%%EOF').toString('base64') });
  beforeEach(async () => {
    await limpiarBaseDeDatos(); app=buildApp(); await app.ready();
    [support,other,specialist]=await Promise.all([crearUsuario('soporte_digital'),crearUsuario('soporte_digital'),crearUsuario('especialista')]);
    p=await crearProyectoDePrueba({ especialistaId:specialist.id });
    await db.insert(fichasTrazabilidad).values({ proyectoId:p.id });
    const [w]=await db.insert(workItems).values({ proyectoId:p.id,tipo:'soporte_digital',businessKey:'activacion_amazon' }).returning(); workId=w!.id;
    cookies={ support:await login(support),other:await login(other),specialist:await login(specialist) };
  });
  afterEach(async () => { await app.close(); });

  it('crea con proyecto/tarea/requester/destino reales, sin cambiar el work item por defecto', async () => {
    const r=await call('POST','/mis-solicitudes',payload()); expect(r.status).toBe(200);
    const [saved]=await db.select().from(solicitudesArea).where(eq(solicitudesArea.id,r.body.id));
    expect(saved).toMatchObject({ proyectoId:p.id,workItemId:workId,requestedById:support.id,targetUserId:specialist.id,estado:'pendiente',blockerId:null });
    const d=(await detailDigitalRequest(saved!.id,support.id))!;
    expect(d.summary.stage).toBe('preparation'); expect(d.summary.taskLabel).toContain('formulario'); expect(d.history).toHaveLength(1);
    expect((await db.select().from(workItems))[0]!.estado).toBe('pendiente');
    expect((await db.select().from(notificaciones)).some(n => n.usuarioDestinoId===specialist.id)).toBe(true);
  });
  it('solo habilita los tres tipos digitales y rechaza target, proyecto, status y campos arbitrarios', async () => {
    for(const extra of [{ type:'editor' },{ type:'calidad_material' },{ targetUserId:other.id },{ projectId:p.id },{ status:'resuelta' },{ priority:'alta' },{ fileId:randomUUID() }]) expect((await call('POST','/mis-solicitudes',{ ...payload(),...extra })).status).toBe(400);
    for(const type of ['digital_material','digital_aclaracion','digital_tecnico'] as const) expect((await call('POST','/mis-solicitudes',payload(type))).status).toBe(200);
    expect((await listDigitalRequests(support.id,filters)).total).toBe(3);
  });
  it('mis solicitudes es privado, aunque las tareas digitales sean compartidas por rol', async () => {
    const r=await create();
    expect((await call('GET','/mis-solicitudes',undefined,cookies.other)).body.total).toBe(0);
    expect((await call('GET','/mis-solicitudes/'+r.id,undefined,cookies.other)).status).toBe(404);
    expect((await call('POST',`/mis-solicitudes/${r.id}/cancelar`,{ expectedVersion:1 },cookies.other)).status).toBe(404);
    expect((await call('POST','/mis-solicitudes',payload(),cookies.other)).status).toBe(200);
  });
  it('RBAC rechaza anónimo y otros roles; el solicitante no puede resolver su propia solicitud', async () => {
    const r=await create();
    expect((await call('GET','/mis-solicitudes',undefined,'')).status).toBe(401);
    expect((await call('GET','/mis-solicitudes',undefined,cookies.specialist)).status).toBe(403);
    expect((await decide(r.id,1,'resolve',{},cookies.support)).status).toBe(403);
    expect((await call('GET','/solicitudes-recibidas',undefined,cookies.support)).status).toBe(403);
    expect((await call('POST',`/mis-solicitudes/${r.id}/resolver`,{ expectedVersion:1 })).status).toBe(404);
  });
  it('no admite tareas de otra área, sin contexto, canceladas ni proyectos retirados', async () => {
    expect((await call('POST','/mis-solicitudes',{ ...payload(),workItemId:randomUUID() })).status).toBe(404);
    const [wrong]=await db.insert(workItems).values({ proyectoId:p.id,tipo:'diseno' }).returning();
    expect((await call('POST','/mis-solicitudes',{ ...payload(),workItemId:wrong!.id })).status).toBe(404);
    await db.update(workItems).set({ estado:'cancelado' }).where(eq(workItems.id,workId));
    expect((await call('POST','/mis-solicitudes',payload())).status).toBe(409);
    await db.update(workItems).set({ estado:'pendiente' }).where(eq(workItems.id,workId));
    await db.update(proyectos).set({ estado:'retirado' }).where(eq(proyectos.id,p.id));
    expect((await call('POST','/mis-solicitudes',payload())).status).toBe(409);
  });
  it('preparación no requiere paquete final; activación completada conserva trabajo posterior hasta cierre digital', async () => {
    expect((await eligibleDigitalRequests('',1,10)).items).toHaveLength(1);
    await db.update(workItems).set({ estado:'completado' }).where(eq(workItems.id,workId));
    expect((await call('POST','/mis-solicitudes',payload())).status).toBe(409);
    await db.update(fichasTrazabilidad).set({ soporteDigitalFechaActivacion:'2026-01-01' }).where(eq(fichasTrazabilidad.proyectoId,p.id));
    expect((await call('POST','/mis-solicitudes',payload())).status).toBe(200);
    await db.update(fichasTrazabilidad).set({ digitalEstatus:'Completado' }).where(eq(fichasTrazabilidad.proyectoId,p.id));
    expect((await call('POST','/mis-solicitudes',payload('digital_aclaracion'))).status).toBe(409);
  });
  it('duplicados simultáneos con misma clave crean una entidad, un evento y un aviso', async () => {
    const body=payload(), responses=await Promise.all([call('POST','/mis-solicitudes',body),call('POST','/mis-solicitudes',body)]);
    expect(responses.map(r => r.status)).toEqual([200,200]); expect(responses[0]!.body.id).toBe(responses[1]!.body.id);
    expect(await db.select().from(solicitudesArea)).toHaveLength(1); expect(await db.select().from(auditLogs).where(eq(auditLogs.entityId,responses[0]!.body.id))).toHaveLength(1);
    expect((await call('POST','/mis-solicitudes',{ ...body,subject:'Otro tema incompatible' })).status).toBe(409);
    expect((await call('POST','/mis-solicitudes',payload())).status).toBe(409);
  });
  it('abrir la lista, detalle o bandeja de receptor no inicia revisión ni genera eventos', async () => {
    const r=await create(); await call('GET','/mis-solicitudes'); await call('GET','/mis-solicitudes/'+r.id); await call('GET','/solicitudes-recibidas/'+r.id,undefined,cookies.specialist);
    expect((await db.select().from(solicitudesArea))[0]!.estado).toBe('pendiente'); expect((await db.select().from(auditLogs).where(eq(auditLogs.entityId,r.id)))).toHaveLength(1);
  });
  it('devuelta muestra la pregunta real y completar información conserva entidad e historia', async () => {
    const r=await create(); expect((await decide(r.id,1,'review')).status).toBe(200); expect((await decide(r.id,2,'return')).status).toBe(200);
    const d=(await detailDigitalRequest(r.id,support.id))!; expect(d.summary).toMatchObject({ requiresAction:true,version:3,status:'requiere_informacion' });
    expect((await call('POST',`/mis-solicitudes/${r.id}/completar`,{ expectedVersion:3,questionId:randomUUID(),text:'Información complementaria real.' })).status).toBe(409);
    expect((await call('POST',`/mis-solicitudes/${r.id}/completar`,{ expectedVersion:3,questionId:d.questions[0]!.id,text:'Información complementaria real.' })).status).toBe(200);
    const after=(await detailDigitalRequest(r.id,support.id))!;
    expect(after.summary).toMatchObject({ id:r.id,status:'pendiente',version:4 }); expect(after.questions[0]!.answer).toBe('Información complementaria real.'); expect(after.history).toHaveLength(4);
    expect(await db.select().from(informacionSolicitudArea)).toHaveLength(1);
  });
  it('resolución muestra texto, actor, fecha y referencias validadas; no admite cambios posteriores', async () => {
    const r=await create(); expect((await decide(r.id,1,'resolve',{ resultWorkItemId:randomUUID() })).status).toBe(404);
    expect((await decide(r.id,1,'resolve',{ resultWorkItemId:workId })).status).toBe(200);
    const d=(await detailDigitalRequest(r.id,support.id))!; expect(d.summary.canCancel).toBe(false); expect(d.canAttach).toBe(false);
    expect(d.result).toMatchObject({ actor:specialist.nombre,workItemId:workId,blockerResolved:false });
    expect((await call('POST',`/mis-solicitudes/${r.id}/cancelar`,{ expectedVersion:2 })).status).toBe(409);
    expect((await call('POST',`/mis-solicitudes/${r.id}/archivos`,evidence(2))).status).toBe(409);
    expect((await db.select().from(notificaciones)).some(n => n.targetPath==='/?vista=mis-solicitudes&request='+r.id && n.usuarioDestinoId===support.id)).toBe(true);
  });
  it('cancelación confirma persistencia, motivo e historial y deja los archivos consultables', async () => {
    const r=await create(), file=await call('POST',`/mis-solicitudes/${r.id}/archivos`,evidence()); expect(file.status).toBe(200);
    expect((await call('POST',`/mis-solicitudes/${r.id}/cancelar`,{ expectedVersion:2,reason:'Ya no hace falta esta intervención.' })).status).toBe(200);
    const d=(await detailDigitalRequest(r.id,support.id))!; expect(d.summary.status).toBe('cancelada'); expect(d.result?.text).toContain('Ya no'); expect(d.history).toHaveLength(3); expect(d.attachments).toHaveLength(1);
    expect((await call('GET',`/solicitudes/${r.id}/archivos/${file.body.id}`)).status).toBe(200);
  });
  it('stale update y decisiones simultáneas solo admiten una transición', async () => {
    const r=await create(), responses=await Promise.all([decide(r.id,1,'resolve'),decide(r.id,1,'return')]);
    expect(responses.map(r => r.status).sort()).toEqual([200,409]);
    expect((await call('POST',`/mis-solicitudes/${r.id}/cancelar`,{ expectedVersion:1 })).status).toBe(409);
  });
  it('Especialista vigente decide; el anterior y otra persona no pueden después de una reasignación', async () => {
    const r=await create(), next=await crearUsuario('especialista'), cookie=await login(next);
    expect((await decide(r.id,1,'resolve',{},cookie)).status).toBe(403);
    await db.insert(projectAssignments).values({ proyectoId:p.id,tipo:'especialista',usuarioId:next.id });
    expect((await call('GET','/solicitudes-recibidas/'+r.id,undefined,cookies.specialist)).status).toBe(404);
    expect((await decide(r.id,1,'resolve')).status).toBe(403); expect((await decide(r.id,1,'resolve',{},cookie)).status).toBe(200);
  });
  it('bloqueo requiere decisión explícita y se refleja en Mi trabajo sin duplicar un gate', async () => {
    const r=await createDigitalRequest(support,{ ...payload(),blocksWorkItem:true });
    const d=(await detailDigitalRequest(r.id,support.id))!; expect(d.summary.blocksWorkItem).toBe(true); expect(d.summary.canCancel).toBe(false);
    expect((await obtenerDetalleTrabajoDigital(workId))!.nextAction).toBeNull();
    expect((await call('POST','/mis-solicitudes',{ ...payload('digital_aclaracion'),blocksWorkItem:true })).status).toBe(409);
    expect((await call('POST',`/mis-solicitudes/${r.id}/cancelar`,{ expectedVersion:1 })).status).toBe(409);
    expect((await decide(r.id,1,'resolve')).status).toBe(200);
    expect((await db.select().from(editorialBlockers))[0]!.resolvedAt).toBeNull();
    expect((await decide(r.id,2,'unblock')).status).toBe(200);
    expect((await obtenerDetalleTrabajoDigital(workId))!.nextAction).not.toBeNull();
    expect((await detailDigitalRequest(r.id,support.id))!.result!.blockerResolved).toBe(true);
  });
  it('resolver con revisión explícita del bloqueo restaura el estado anterior, sin inventar progreso', async () => {
    const r=await createDigitalRequest(support,{ ...payload(),blocksWorkItem:true });
    expect((await decide(r.id,1,'resolve',{ resolveBlocker:true })).status).toBe(200);
    expect((await db.select().from(workItems).where(eq(workItems.id,workId)))[0]!.estado).toBe('pendiente');
    expect((await db.select().from(editorialBlockers))[0]!.resolvedBy).toBe(specialist.id);
  });
  it('no elimina un gate que cambió mientras se revisaba la solicitud', async () => {
    const r=await createDigitalRequest(support,{ ...payload(),blocksWorkItem:true });
    await db.update(workItems).set({ gateBloqueante:'solvencia' }).where(eq(workItems.id,workId));
    expect((await decide(r.id,1,'resolve',{ resolveBlocker:true })).status).toBe(409);
    expect((await db.select().from(solicitudesArea))[0]!.estado).toBe('pendiente');
  });
  it('evidencia es privada, mantiene MIME/tamaño/actor y puede verla el destinatario vigente', async () => {
    const r=await create(), f=await call('POST',`/mis-solicitudes/${r.id}/archivos`,evidence()); expect(f.status).toBe(200);
    const d=(await detailDigitalRequest(r.id,support.id))!; expect(d.attachments[0]).toMatchObject({ name:'evidencia.pdf',mimeType:'application/pdf',uploadedBy:support.nombre });
    const view=await call('GET',d.attachments[0]!.url.replace('/api/soporte-digital','')); expect(view.status).toBe(200); expect(view.headers['x-content-type-options']).toBe('nosniff');
    expect((await call('GET',`/solicitudes/${r.id}/archivos/${f.body.id}`,undefined,cookies.other)).status).toBe(404);
    expect((await call('GET',`/solicitudes/${r.id}/archivos/${f.body.id}`,undefined,cookies.specialist)).status).toBe(200);
    expect((await call('POST',`/mis-solicitudes/${r.id}/archivos`,evidence(2),cookies.other)).status).toBe(404);
  });
  it('evidencia de otra solicitud/proyecto nunca puede abrirse por cambiar IDs o usarse como resultado', async () => {
    const a=await create(), b=await create('digital_aclaracion'); const f=await call('POST',`/mis-solicitudes/${b.id}/archivos`,evidence());
    expect((await call('GET',`/solicitudes/${a.id}/archivos/${f.body.id}`)).status).toBe(404);
    expect((await decide(a.id,1,'resolve',{ resultAttachmentId:f.body.id })).status).toBe(404);
    const foreign=await crearProyectoDePrueba({ especialistaId:specialist.id });
    const [w]=await db.insert(workItems).values({ proyectoId:foreign.id,tipo:'soporte_digital' }).returning();
    expect((await decide(a.id,1,'resolve',{ resultWorkItemId:w!.id })).status).toBe(404);
  });
  it('adjuntos duplicados se deduplican; contenido malicioso o tipo falso se rechaza', async () => {
    const r=await create(), body=evidence(), responses=await Promise.all([call('POST',`/mis-solicitudes/${r.id}/archivos`,body),call('POST',`/mis-solicitudes/${r.id}/archivos`,body)]);
    expect(responses.map(r => r.status)).toEqual([200,200]); expect(responses[0]!.body.id).toBe(responses[1]!.body.id);
    expect(await db.select().from(solicitudArchivos)).toHaveLength(1);
    expect((await call('POST',`/mis-solicitudes/${r.id}/archivos`,{ ...evidence(2),name:'otro.pdf',contentBase64:Buffer.from('<html>no</html>').toString('base64') })).status).toBe(400);
    expect((await call('POST',`/mis-solicitudes/${r.id}/archivos`,{ ...body,name:'otro.pdf' })).status).toBe(409);
  });
  it('no permite adjuntar durante revisión ni con una versión obsoleta', async () => {
    const r=await create(); expect((await decide(r.id,1,'review')).status).toBe(200);
    expect((await call('POST',`/mis-solicitudes/${r.id}/archivos`,evidence(1))).status).toBe(409);
    expect((await call('POST',`/mis-solicitudes/${r.id}/archivos`,evidence(2))).status).toBe(409);
  });
  it('paginación SQL y counts incluyen todo el conjunto propio y filtros literales', async () => {
    await create(); await create('digital_aclaracion'); await create('digital_tecnico');
    const first=await listDigitalRequests(support.id,{ ...filters,pageSize:1 }),next=await listDigitalRequests(support.id,{ ...filters,pageSize:1,page:2 });
    expect(first.total).toBe(3); expect(first.counts.pending).toBe(3); expect(first.items).toHaveLength(1); expect(first.items[0]!.id).not.toBe(next.items[0]!.id);
    expect((await listDigitalRequests(support.id,{ ...filters,type:'digital_tecnico',search:'acceso',project:p.id })).total).toBe(1);
    expect((await listDigitalRequests(support.id,{ ...filters,search:'%_no_coincide' })).total).toBe(0);
  });
  it('historial y etapa al enviar permanecen cuando cambia o se cancela la tarea', async () => {
    const r=await create(); await db.update(workItems).set({ estado:'cancelado' }).where(eq(workItems.id,workId));
    const d=(await detailDigitalRequest(r.id,support.id))!;
    expect(d.summary.stage).toBe('preparation'); expect(d.summary.workAccessible).toBe(false); expect(d.canAttach).toBe(false);
    expect((await listDigitalRequests(support.id,filters)).total).toBe(1);
  });
  it('el esquema canónico impide relaciones de trabajo y proyecto inconsistentes', async () => {
    const foreign=await crearProyectoDePrueba();
    await expect(db.insert(solicitudesArea).values({ proyectoId:foreign.id,workItemId:workId,requestedById:support.id,targetUserId:specialist.id,tipo:'digital_material',businessKey:randomUUID(),asunto:'Tema suficientemente largo',descripcion:'Descripción suficiente de una necesidad.' })).rejects.toMatchObject({ code:'23514' });
  });
});
