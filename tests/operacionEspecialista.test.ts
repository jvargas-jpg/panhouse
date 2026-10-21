import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as audit from '../server/helpers/auditLog.js';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../server/app.js';
import { db, pool } from '../server/db/client.js';
import { auditLogs, capitulos, fichaDocumentalDatos, fichasTrazabilidad, informacionSolicitudArea, notificaciones, projectAssignments, proyectos, servicios, solicitudesArea, users, workItems } from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import { obtenerCommandCenter } from '../server/helpers/projectCommandCenter.js';
import { obtenerColaTrabajoEspecialista } from '../server/helpers/especialistaMiTrabajo.js';
import { listarSolicitudes } from '../server/helpers/especialistaSolicitudes.js';
import { calcularPrimerContactoDueAt } from '../server/helpers/preparacionInicial.js';
import { historialFicha } from '../server/helpers/fichaViva.js';
import { crearProyectoDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
const app = buildApp();
let spec:string,other:string,rrpp:string,jefa:string,sc:string,oc:string,rc:string,jc:string;
async function user(rol:typeof users.$inferInsert.rol) { const id=randomUUID();await db.insert(users).values({id,rol,nombre:rol,email:id+'@panhouse.test',passwordHash:'session-only'});return [id,'panhouse_sid='+await createSession(id)]; }
beforeAll(()=>app.ready());afterAll(()=>app.close());
beforeEach(async()=>{await limpiarBaseDeDatos();[spec,sc]=await user('especialista') as [string,string];[other,oc]=await user('especialista') as [string,string];[rrpp,rc]=await user('rrpp') as [string,string];[jefa,jc]=await user('jefe_area') as [string,string];});
async function fixture(codigo='EF',subtipo:'Tripa'|'Capítulo'|null=null) {
  const p=await crearProyectoDePrueba({especialistaId:spec,jefeAreaId:jefa});
  await db.update(servicios).set({codigo}).where(eq(servicios.id,p.servicioId));
  await db.insert(fichasTrazabilidad).values({proyectoId:p.id,ingresoServicioSubtipoCrudo:subtipo});
  await db.insert(projectAssignments).values({proyectoId:p.id,tipo:'especialista',usuarioId:spec,asignadoPorId:jefa,asignadoEn:new Date(Date.now()-3600000)});
  return p;
}
const call=(method:'GET'|'POST'|'PATCH',url:string,payload?:object,cookie=sc)=>app.inject({method,url,payload,headers:{cookie}});
const solicitar=(id:string,tipo='lanzamiento',cookie=sc)=>call('POST',`/api/proyectos/${id}/solicitar-${tipo}`,{},cookie);
const accion=(id:string,command:string,datos:object={},cookie=rc)=>call('POST',`/api/solicitudes-area/${id}/acciones`,{accion:command,...datos},cookie);
async function hito(p:Awaited<ReturnType<typeof fixture>>,codigo:string,subtipo?:string|null) {
  if(codigo==='EF'||subtipo==='Capítulo')await db.insert(capitulos).values({proyectoId:p.id,numero:4,fechaEnvioAutor:'2026-10-01'});
  else if(subtipo==='Tripa')await db.update(fichasTrazabilidad).set({edicionFechaEnvioAutor:'2026-10-01'}).where(eq(fichasTrazabilidad.proyectoId,p.id));
  else {const [d]=await user('disenador');await db.update(proyectos).set({disenadorId:d}).where(eq(proyectos.id,p.id));}
}
const trabajo=(id:string)=>obtenerColaTrabajoEspecialista(id,{tab:'pendientes',search:'',page:1,pageSize:50});
describe('Operación del Especialista: ownership y handoffs',()=>{
  it('guardar preparación sin hechos conserva Pendiente y no crea un inicio ficticio',async()=>{
    const p=await fixture();expect((await call('PATCH',`/api/proyectos/${p.id}/preparacion-inicial`,{reunionOperativaRealizada:false,observaciones:''})).statusCode).toBe(200);
    expect((await obtenerCommandCenter(p.id,{id:spec,rol:'especialista'})).preparacion.estado).toBe('Pendiente');
    expect((await db.select().from(workItems).where(eq(workItems.tipo,'preparacion_inicial')))[0]?.estado).toBe('pendiente');
  });
  it('Ficha de Impresión es de consulta para RRPP hasta aceptar el handoff',async()=>{
    const p=await fixture();const before=(await call('GET',`/api/fichas-trazabilidad/${p.id}/expediente`,undefined,rc)).json();
    expect(before.areas.find((a:{id:string})=>a.id==='impresion').fields.some((f:{editable:boolean})=>f.editable)).toBe(false);
    await db.insert(fichaDocumentalDatos).values({proyectoId:p.id,seccion:'diseno',datos:{paqueteFinalCargado:true}});
    const r=(await solicitar(p.id,'impresion')).json();await accion(r.id,'aceptar');
    const after=(await call('GET',`/api/fichas-trazabilidad/${p.id}/expediente`,undefined,rc)).json();
    expect(after.areas.find((a:{id:string})=>a.id==='impresion').fields.find((f:{key:string})=>f.key==='cantidadLibros').editable).toBe(true);
  });
  it('un fallo de auditoría revierte solicitud, trabajo y notificación',async()=>{
    const p=await fixture('SE');await hito(p,'SE');
    const spy=vi.spyOn(audit,'registrarEvento').mockRejectedValueOnce(new Error('Fallo de auditoría de prueba'));
    try { expect((await solicitar(p.id)).statusCode).toBe(500); } finally { spy.mockRestore(); }
    expect(await db.select().from(solicitudesArea)).toHaveLength(0);
    expect(await db.select().from(notificaciones)).toHaveLength(0);
    expect(await db.select().from(workItems).where(eq(workItems.tipo,'lanzamiento'))).toHaveLength(0);
  });
  it('la versión evita una actualización basada en un detalle obsoleto',async()=>{
    const p=await fixture('SE');await hito(p,'SE');const r=(await solicitar(p.id)).json();
    expect((await accion(r.id,'revisar',{expectedVersion:1})).statusCode).toBe(200);
    expect((await accion(r.id,'informacion',{expectedVersion:1,texto:'Esta petición se basa en una versión anterior.'})).statusCode).toBe(409);
    expect(await db.select().from(informacionSolicitudArea)).toHaveLength(0);
  });
  it('no expone cola global ni proyectos sin asignar o ajenos',async()=>{
    const p=await fixture();expect((await call('GET',`/api/proyectos/${p.id}/command-center`,undefined,oc)).statusCode).toBe(403);
    await db.delete(projectAssignments).where(eq(projectAssignments.proyectoId,p.id));await db.update(proyectos).set({especialistaId:null}).where(eq(proyectos.id,p.id));
    expect((await call('GET',`/api/proyectos/${p.id}/command-center`)).statusCode).toBe(403);
    expect((await call('GET','/api/proyectos/activos')).statusCode).toBe(403);
    expect((await call('GET','/api/jefatura/asignaciones')).statusCode).not.toBe(200);
  });
  it('retira ingreso/asignación del dominio operativo y conserva Ficha/Actividad',async()=>{
    const p=await fixture();await db.insert(workItems).values([{proyectoId:p.id,tipo:'intake_rrpp',estado:'completado'},{proyectoId:p.id,tipo:'asignacion_especialista',estado:'completado'}]);
    await db.insert(auditLogs).values({proyectoId:p.id,actorId:jefa,entityId:p.id,entityType:'proyecto',accion:'JEFATURA_NOTIFICADA'});
    const data=await obtenerCommandCenter(p.id,{id:spec,rol:'especialista'});
    expect(data.procesos[0]?.tipo).toBe('preparacion_inicial');expect(data.procesos.map(p=>p.tipo)).not.toContain('intake_rrpp');expect(data.procesos.map(p=>p.tipo)).not.toContain('asignacion_especialista');
    expect(data.contextoPrevio).toHaveLength(2);expect((await historialFicha(p.id)).items.some(e=>e.label.includes('Jefatura'))).toBe(true);
  });
  it('preparación guarda hechos reales, no URLs ficticias y SLA central de 24h',async()=>{
    const p=await fixture();expect(calcularPrimerContactoDueAt(new Date('2026-10-12T10:00:00Z'))).toBe('2026-10-13T10:00:00.000Z');expect(calcularPrimerContactoDueAt(null)).toBeNull();
    const url=`/api/proyectos/${p.id}/preparacion-inicial`;
    expect((await call('PATCH',url,{primerContactoEn:new Date().toISOString()},oc)).statusCode).toBe(403);
    expect((await call('PATCH',url,{primerContactoEn:new Date().toISOString()},jc)).statusCode).toBe(403);
    expect((await call('PATCH',url,{primerContactoEn:new Date().toISOString(),driveCarpetaUrl:'https://example.com/folder'})).statusCode).toBe(400);
    expect((await call('PATCH',url,{driveCarpetaUrl:'https://drive.google.com/drive/folders/unverified'})).statusCode).toBe(400);
    const now=new Date().toISOString();expect((await call('PATCH',url,{recibidoEn:now,expedienteRevisadoEn:now,primerContactoEn:now,reunionOperativaFecha:now,reunionOperativaRealizada:true,grabacionUrl:'https://example.com/grabacion',transcripcionUrl:'https://example.com/transcripcion',minutaUrl:'https://example.com/minuta',cronogramaUrl:'https://example.com/cronograma'})).statusCode).toBe(200);
    const d=await obtenerCommandCenter(p.id,{id:spec,rol:'especialista'});expect(d.preparacion.estado).toBe('En curso');expect(d.preparacion.driveEstado).toBe('no_configurado');expect((await trabajo(spec)).items.some(i=>i.accion==='Configurar espacio documental')).toBe(true);
    expect((await call('PATCH',url,{reunionOperativaFecha:new Date(Date.now()+86400000).toISOString(),reunionOperativaRealizada:true})).statusCode).toBe(400);
  });
  it.each([['EF',null],['CR','Capítulo'],['CR','Tripa'],['SE',null]] as const)('Lanzamiento %s/%s: hito, solicitud explícita y activación RRPP',async(codigo,subtipo)=>{
    const p=await fixture(codigo,subtipo);expect((await solicitar(p.id)).statusCode).toBe(409);
    await hito(p,codigo,subtipo);const before=await obtenerCommandCenter(p.id,{id:spec,rol:'especialista'});expect(before.procesos.find(p=>p.tipo==='lanzamiento')?.action?.label).toBe('Solicitar activación');
    expect((await listarSolicitudes({id:spec,rol:'especialista'},{tab:'todas',search:'',page:1,pageSize:50})).total).toBe(0);
    const [a,b]=await Promise.all([solicitar(p.id),solicitar(p.id)]);expect(a.statusCode).toBe(200);expect(b.json().id).toBe(a.json().id);
    expect(await db.select().from(solicitudesArea)).toHaveLength(1);expect((await db.select().from(notificaciones).where(eq(notificaciones.rolDestino,'rrpp')))).toHaveLength(1);expect((await db.select().from(auditLogs).where(eq(auditLogs.accion,'SOLICITUD_AREA_CREADA')))).toHaveLength(1);
    expect((await trabajo(spec)).items.some(i=>i.accion==='Solicitar activación de Lanzamiento')).toBe(false);
    expect((await accion(a.json().id,'aceptar',{},sc)).statusCode).toBe(403);expect((await accion(a.json().id,'aceptar',{},jc)).statusCode).toBe(403);
    const results=await Promise.all([accion(a.json().id,'aceptar'),accion(a.json().id,'aceptar')]);expect(results.every(r=>r.statusCode===200)).toBe(true);
    const [r]=await db.select().from(solicitudesArea);expect(r?.estado).toBe('resuelta');expect(r?.outcome).toBe('LANZAMIENTO_ACTIVADO');expect((await db.select().from(workItems).where(eq(workItems.id,r!.workItemId!)))[0]?.estado).toBe('en_progreso');
    const after=await obtenerCommandCenter(p.id,{id:spec,rol:'especialista'});expect(after.procesos.find(p=>p.tipo==='lanzamiento')?.estado).toBe('En planificación');expect(after.procesos.find(p=>p.tipo==='lanzamiento')?.ownerRole).toBe('rrpp');
    expect((await db.select().from(auditLogs).where(eq(auditLogs.accion,'SOLICITUD_AREA_ACTIVADA')))).toHaveLength(1);
  });
  it('IDOR: cambio de asignación invalida crear y responder solicitudes',async()=>{
    const p=await fixture('SE');await hito(p,'SE');expect((await solicitar(p.id,'lanzamiento',oc)).statusCode).toBe(403);
    const r=(await solicitar(p.id)).json();await accion(r.id,'informacion',{texto:'Adjunta el cronograma actualizado del proyecto.'});
    const [q]=await db.select().from(informacionSolicitudArea);expect((await accion(r.id,'responder',{texto:'Respuesta ajena que no debe guardarse',preguntaId:q!.id},oc)).statusCode).toBe(403);
    await db.update(projectAssignments).set({usuarioId:other}).where(and(eq(projectAssignments.proyectoId,p.id),eq(projectAssignments.tipo,'especialista')));
    expect((await accion(r.id,'responder',{texto:'Respuesta anterior que no debe guardarse',preguntaId:q!.id},sc)).statusCode).toBe(403);
    expect((await call('GET','/api/especialistas/solicitudes/'+r.id)).statusCode).toBe(404);
  });
  it('información/respuesta utiliza la misma solicitud y regresa a revisión',async()=>{
    const p=await fixture('SE');await hito(p,'SE');const r=(await solicitar(p.id)).json();await accion(r.id,'revisar');
    expect((await accion(r.id,'informacion',{texto:'Indica las preferencias de fecha y lugar.'})).statusCode).toBe(200);
    expect((await accion(r.id,'aceptar')).statusCode).toBe(409);const [q]=await db.select().from(informacionSolicitudArea);
    expect((await trabajo(spec)).items.some(i=>i.accion==='Responder información a RRPP')).toBe(true);
    expect((await accion(r.id,'responder',{texto:'La fecha y el lugar están descritos en la minuta.',preguntaId:q!.id},sc)).statusCode).toBe(200);
    expect((await accion(r.id,'responder',{texto:'Un reintento tardío no debe cambiar los datos.',preguntaId:q!.id},sc)).statusCode).toBe(409);
    expect(await db.select().from(solicitudesArea)).toHaveLength(1);expect((await db.select().from(solicitudesArea))[0]?.estado).toBe('en_revision');
    expect((await trabajo(spec)).items.some(i=>i.accion==='Responder información a RRPP')).toBe(false);
  });
  it('Impresión: paquete final, request, aceptación y campos de RRPP',async()=>{
    const p=await fixture();expect((await solicitar(p.id,'impresion')).statusCode).toBe(409);
    await db.insert(fichaDocumentalDatos).values({proyectoId:p.id,seccion:'diseno',datos:{paqueteFinalCargado:true}});
    const [a,b]=await Promise.all([solicitar(p.id,'impresion'),solicitar(p.id,'impresion')]);expect(a.json().id).toBe(b.json().id);
    const path=`/api/fichas-trazabilidad/${p.id}/impresion`;
    expect((await call('PATCH',path,{impresionEstatus:'En imprenta'},sc)).statusCode).toBe(403);expect((await call('PATCH',path,{impresionEstatus:'En imprenta'},jc)).statusCode).toBe(403);
    expect((await call('PATCH',path,{impresionEstatus:'En coordinación'},rc)).statusCode).toBe(409);
    expect((await accion(a.json().id,'aceptar')).statusCode).toBe(200);expect((await call('PATCH',path,{impresionResponsable:'Coordinación RRPP',impresionEstadoCotizacion:'solicitada',impresionObservaciones:'Solicitar presupuesto con el paquete final.'},rc)).statusCode).toBe(200);
    expect((await obtenerCommandCenter(p.id,{id:spec,rol:'especialista'})).procesos.find(p=>p.tipo==='impresion')?.estado).toBe('En coordinación');
    const documental=`/api/fichas-trazabilidad/${p.id}/documental/impresion`;
    expect((await call('PATCH',documental,{datos:{cantidadLibros:100}},jc)).statusCode).toBe(403);
    expect((await call('PATCH',documental,{datos:{cantidadLibros:100}},sc)).statusCode).toBe(403);
    expect((await call('PATCH',documental,{datos:{cantidadLibros:100}},rc)).statusCode).toBe(200);
  });
  it.each(['lanzamiento-control','lanzamiento-promocion','digital-control','impresion'])('Especialista no muta campos de otro owner por %s',async(path)=>{
    const p=await fixture();const payload=path==='lanzamiento-control'?{lanzamientoEstatus:'En curso'}:path==='lanzamiento-promocion'?{lanzamientoPromocionTipo:'Digital'}:path==='digital-control'?{digitalEstatus:'Activo'}:{impresionEstatus:'En imprenta'};
    expect((await call('PATCH',`/api/fichas-trazabilidad/${p.id}/${path}`,payload)).statusCode).toBe(403);
  });
  it('RRPP guarda planificación y todas las vistas comparten la fuente',async()=>{
    const p=await fixture('SE');await hito(p,'SE');const r=(await solicitar(p.id)).json();await accion(r.id,'aceptar');
    expect((await call('PATCH',`/api/rrpp/lanzamientos/planes/${p.id}`,{asesoriaFase:'En espera de lanzamiento',lanzamientoPromocionFechaTentativa:'2026-12-01'},rc)).statusCode).toBe(200);
    const a=await obtenerCommandCenter(p.id,{id:spec,rol:'especialista'}),b=await obtenerCommandCenter(p.id,{id:jefa,rol:'jefe_area'});
    expect(a.procesos.find(p=>p.tipo==='lanzamiento')?.seguimiento).toEqual(b.procesos.find(p=>p.tipo==='lanzamiento')?.seguimiento);
    expect(a.procesos.find(p=>p.tipo==='lanzamiento')?.seguimiento?.find(f=>f.key==='lanzamientoPromocionFechaTentativa')?.value).toBe('2026-12-01');
    expect((await historialFicha(p.id)).items.some(e=>e.label.includes('RRPP inició'))).toBe(true);
  });
  it('legacy activo se consulta sin inventar solicitud o solicitante',async()=>{
    const p=await fixture();await db.insert(workItems).values({proyectoId:p.id,tipo:'lanzamiento',businessKey:'planificacion',estado:'en_progreso'});
    const data=await obtenerCommandCenter(p.id,{id:spec,rol:'especialista'});expect(data.procesos.find(p=>p.tipo==='lanzamiento')?.activacion).toMatchObject({activo:true,legacy:true,solicitud:null});
    expect((await listarSolicitudes({id:spec,rol:'especialista'},{tab:'todas',search:'',page:1,pageSize:50})).total).toBe(0);
  });
  it('401, payload arbitrario y proyecto cerrado no permiten activar',async()=>{
    const p=await fixture('SE');await hito(p,'SE');expect((await solicitar(p.id,'lanzamiento','')).statusCode).toBe(401);
    expect((await call('POST',`/api/proyectos/${p.id}/solicitar-lanzamiento`,{destino:'direccion',estado:'resuelta'})).statusCode).toBe(400);
    await db.update(proyectos).set({estado:'culminado'}).where(eq(proyectos.id,p.id));expect((await solicitar(p.id)).statusCode).toBe(409);
  });
});
