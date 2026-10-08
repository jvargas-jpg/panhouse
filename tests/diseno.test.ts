import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { auditLogs, correcciones, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, fichaDisenoPropuestas, fichasTrazabilidad, notificaciones, projectAssignments, proyectos, workItems } from '../server/db/schema/index.js';
import { diasReferenciaDiseno, plazoDiseno } from '../server/helpers/disenoSla.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

describe('5D Diseño — workflow y aislamiento de roles', () => {
  let app: ReturnType<typeof buildApp>;
  let p: Awaited<ReturnType<typeof crearProyectoDePrueba>>;
  let especialista: Awaited<ReturnType<typeof crearUsuario>>;
  let diseñador: Awaited<ReturnType<typeof crearUsuario>>;
  let lider: Awaited<ReturnType<typeof crearUsuario>>;
  let dcId: string;
  let cookies: Record<string, string>;
  async function login(u: Awaited<ReturnType<typeof crearUsuario>>) {
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: u.email, password: 'password123' } });
    return r.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }
  const call = async (method: 'GET' | 'POST' | 'PATCH', path: string, payload: unknown = undefined, cookie = cookies.especialista) => {
    const res = await app.inject({ method, url: `/api${path}`, headers: { cookie }, payload: payload as any });
    return { status: res.statusCode, body: res.json() };
  };
  beforeEach(async () => {
    await limpiarBaseDeDatos(); app = buildApp(); await app.ready(); cookies = {};
    especialista = await crearUsuario('especialista'); diseñador = await crearUsuario('disenador'); lider = await crearUsuario('lider_creativo');
    p = await crearProyectoDePrueba({ especialistaId: especialista.id, disenadorId: diseñador.id });
    await db.update(proyectos).set({ tituloDefinitivo: 'Título', subtituloDefinitivo: 'Subtítulo' }).where(eq(proyectos.id, p.id));
    const [f] = await db.insert(fichasTrazabilidad).values({ proyectoId: p.id }).returning();
    const [wi] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'direccion_creativa', estado: 'completado' }).returning();
    const [dc] = await db.insert(direccionesCreativas).values({ proyectoId: p.id, workItemId: wi!.id, tipo: 'concepto_portada', resultadoFinal: 'aprobado', briefEnlace: 'https://drive.google.com/brief', fechaBriefAprobadoAutor: '2026-01-01', recursoImagenUrl: 'https://drive.google.com/imagen', recursoConceptoPdfUrl: 'https://drive.google.com/concepto' }).returning();
    dcId = dc!.id;
    await db.insert(projectAssignments).values({ proyectoId: p.id, workItemId: wi!.id, tipo: 'lider_creativo', usuarioId: lider.id });
    await db.insert(fichaDisenoPropuestas).values({ fichaId: f!.id, direccionCreativaId: dcId, fechaAprobadaRrpp: '2026-01-01', fechaAprobadaAutor: '2026-01-01', enlace: 'https://drive.google.com/concepto' });
    cookies.especialista = await login(especialista); cookies.disenador = await login(diseñador); cookies.lider = await login(lider);
  });
  afterEach(async () => { await app.close(); });
  async function solicitar(tipo = 'muestra_diagramacion', extras = {}) {
    return call('POST', `/diseno/proyecto/${p.id}`, { tipo, fuenteUrl: 'https://drive.google.com/fuente', capitulosMuestra: 3, preparacionConfirmada: true, solicitudKey: randomUUID(), ...extras });
  }
  async function entregar(id: string, extras = {}, cookie = cookies.disenador) {
    return call('POST', `/diseno/${id}/versiones`, { enlace: 'https://drive.google.com/v1', entregaKey: randomUUID(), ...extras }, cookie);
  }
  const coordinar = (id: string, versionId: string, accion: string, extras = {}) => call('PATCH', `/diseno/${id}/versiones/${versionId}`, { accion, ...extras });
  async function muestraAprobada() {
    const d = await solicitar(); const v = await entregar(d.body.id);
    expect((await coordinar(d.body.id, v.body.id, 'enviar_autor')).status).toBe(200);
    expect((await coordinar(d.body.id, v.body.id, 'aprobar_autor')).status).toBe(200); return d.body.id as string;
  }
  async function tripa() {
    const [wi] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'correccion', estado: 'completado' }).returning();
    const [c] = await db.insert(correcciones).values({ proyectoId: p.id, workItemId: wi!.id, alcance: 'tripa_completa', fechaEntrega: '2026-01-01' }).returning(); return c!.id;
  }
  it('bloquea solicitud sin título, recursos o preparación y rechaza muestra de menos de tres capítulos', async () => {
    await db.update(proyectos).set({ tituloDefinitivo: null }).where(eq(proyectos.id, p.id));
    expect((await solicitar()).status).toBe(400);
    await db.update(proyectos).set({ tituloDefinitivo: 'Título' }).where(eq(proyectos.id, p.id));
    expect((await solicitar('muestra_diagramacion', { capitulosMuestra: 2 })).status).toBe(400);
    expect((await solicitar('muestra_diagramacion', { preparacionConfirmada: false })).status).toBe(400);
    await db.update(direccionesCreativas).set({ recursoConceptoPdfUrl: null }).where(eq(direccionesCreativas.id, dcId));
    expect((await solicitar()).status).toBe(400); expect(await db.select().from(disenos)).toHaveLength(0);
  });
  it('solicitud concurrente es idempotente: un trabajo, assignment, audit y aviso', async () => {
    const resultados = await Promise.all([solicitar(), solicitar()]);
    expect(resultados.map(x => x.status).sort()).toEqual([200, 201]); expect(resultados[0]!.body.id).toBe(resultados[1]!.body.id);
    expect(await db.select().from(disenos)).toHaveLength(1);
    expect(await db.select().from(projectAssignments).where(eq(projectAssignments.tipo, 'disenador'))).toHaveLength(1);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'DISENO_SOLICITADO'))).toHaveLength(1);
    expect(await db.select().from(notificaciones).where(eq(notificaciones.rolDestino, 'disenador'))).toHaveLength(1);
  });
  it('muestra: entrega, feedback, V2, envío y aprobación; conserva V1 y autor de la entrega', async () => {
    const d = await solicitar(); const v1 = await entregar(d.body.id);
    expect(v1.status).toBe(201);
    expect((await entregar(d.body.id)).status).toBe(409);
    expect((await coordinar(d.body.id, v1.body.id, 'aprobar_autor')).status).toBe(409);
    expect((await coordinar(d.body.id, v1.body.id, 'enviar_autor')).status).toBe(200);
    expect((await coordinar(d.body.id, v1.body.id, 'feedback', { feedback: 'Cambiar márgenes', cantidadComentarios: 7 })).status).toBe(200);
    const v2 = await entregar(d.body.id, { enlace: 'https://drive.google.com/v2' });
    expect(v2.status).toBe(201);
    expect((await coordinar(d.body.id, v1.body.id, 'aprobar_autor')).status).toBe(404);
    await coordinar(d.body.id, v2.body.id, 'enviar_autor'); await coordinar(d.body.id, v2.body.id, 'aprobar_autor');
    const filas = await db.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, d.body.id));
    expect(filas).toHaveLength(2); expect(filas[0]!.entregadoPorId).toBe(diseñador.id); expect(filas.find(x => x.id === v1.body.id)!.feedback).toBe('Cambiar márgenes');
    expect((await entregar(d.body.id)).status).toBe(409);
  });
  it('entrega concurrente con misma clave conserva timestamp y no duplica versiones/audit/notificaciones', async () => {
    const d = await solicitar(); const key = randomUUID(); const resultados = await Promise.all([entregar(d.body.id, { entregaKey: key }), entregar(d.body.id, { entregaKey: key })]);
    expect(resultados[0]!.body.id).toBe(resultados[1]!.body.id);
    expect(await db.select().from(disenoVersiones)).toHaveLength(1);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'DISENO_VERSION_ENTREGADA'))).toHaveLength(1);
    expect(await db.select().from(notificaciones).where(eq(notificaciones.rolDestino, 'especialista'))).toHaveLength(1);
    expect((await entregar(d.body.id, { entregaKey: key, enlace: 'https://drive.google.com/otro' })).status).toBe(409);
  });
  it('IDOR de proyecto/trabajo/versión y roles corrector/editor: denegados sin efectos', async () => {
    const d = await solicitar(); const v = await entregar(d.body.id);
    for (const rol of ['especialista', 'disenador', 'corrector', 'editor'] as const) {
      const cookie = await login(await crearUsuario(rol));
      expect((await entregar(d.body.id, {}, cookie)).status).toBe(403);
      if (rol === 'especialista' || rol === 'disenador') expect((await call('GET', `/diseno/proyecto/${p.id}`, undefined, cookie)).status).toBe(403);
      expect((await call('PATCH', `/diseno/${d.body.id}/versiones/${v.body.id}`, { accion: 'aprobar_autor' }, cookie)).status).toBe(403);
    }
    expect((await coordinar(d.body.id, randomUUID(), 'aprobar_autor')).status).toBe(404);
    expect((await entregar(randomUUID())).status).toBe(404);
  });
  it('reasignación mantiene historial/versiones y revoca acceso del diseñador anterior', async () => {
    const dueAt = '2026-11-01T12:30:00-04:00';
    const d = await solicitar('muestra_diagramacion', { dueAt }); const v = await entregar(d.body.id);
    await coordinar(d.body.id, v.body.id, 'feedback', { feedback: 'Ajustar' });
    const nuevo = await crearUsuario('disenador');
    const body = { disenadorId: nuevo.id, dueAt };
    expect((await call('PATCH', `/diseno/${d.body.id}/asignar`, body)).status).toBe(200);
    expect((await call('PATCH', `/diseno/${d.body.id}/asignar`, { ...body, dueAt: '2026-12-01T16:30:00Z' })).status).toBe(409);
    expect((await call('PATCH', `/diseno/${d.body.id}/asignar`, body)).status).toBe(200);
    const a = await db.select().from(projectAssignments).where(eq(projectAssignments.tipo, 'disenador'));
    expect(a).toHaveLength(2); expect(a.filter(x => !x.finalizadoEn)[0]!.usuarioId).toBe(nuevo.id);
    expect((await entregar(d.body.id)).status).toBe(403);
    expect((await entregar(d.body.id, {}, await login(nuevo))).status).toBe(201);
    expect((await db.select().from(disenoVersiones))[0]!.entregadoPorId).toBe(diseñador.id);
  });
  it('no asigna un usuario con otro rol o inactivo', async () => {
    const d = await solicitar();
    expect((await call('PATCH', `/diseno/${d.body.id}/asignar`, { disenadorId: lider.id })).status).toBe(400);
    await db.execute((await import('drizzle-orm')).sql`update usuarios set activo = false where id = ${diseñador.id}`);
    expect((await call('PATCH', `/diseno/${d.body.id}/asignar`, { disenadorId: diseñador.id })).status).toBe(400);
  });
  it('diagramación exige muestra aprobada, tripa corregida de ESTE proyecto y aprobación editorial', async () => {
    const correccionId = await tripa();
    expect((await solicitar('diagramacion', { correccionId, aprobacionEdicionUrl: 'https://drive.google.com/aprobacion' })).status).toBe(400);
    await muestraAprobada();
    expect((await solicitar('diagramacion', { correccionId: randomUUID(), aprobacionEdicionUrl: 'https://drive.google.com/aprobacion' })).status).toBe(400);
    expect((await solicitar('diagramacion', { correccionId })).status).toBe(400);
    expect((await solicitar('diagramacion', { correccionId, aprobacionEdicionUrl: 'https://drive.google.com/aprobacion' })).status).toBe(201);
  });
  it('handoff concurrente crea una ronda reutilizable, un work item, audit y aviso a Calidad', async () => {
    await muestraAprobada(); const correccionId = await tripa();
    const d = await solicitar('diagramacion', { correccionId, aprobacionEdicionUrl: 'https://drive.google.com/aprobacion' }); const v = await entregar(d.body.id);
    const results = await Promise.all([coordinar(d.body.id, v.body.id, 'handoff_calidad'), coordinar(d.body.id, v.body.id, 'handoff_calidad')]);
    expect(results.every(x => x.status === 200)).toBe(true);
    const qs = await db.select().from(fichaCalidadFases); expect(qs).toHaveLength(1); expect(qs[0]).toMatchObject({ numeroFase: 1, ronda: 1, pdfUrl: 'https://drive.google.com/v1', pdfVersion: 'V1' });
    const [vv] = await db.select().from(disenoVersiones).where(eq(disenoVersiones.id, v.body.id)); expect(vv?.calidadFaseId).toBe(qs[0]!.id);
    expect(await db.select().from(workItems).where(eq(workItems.tipo, 'calidad'))).toHaveLength(1);
    expect(await db.select().from(notificaciones).where(eq(notificaciones.rolDestino, 'soporte_editorial'))).toHaveLength(1);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'DISENO_HANDOFF_CALIDAD'))).toHaveLength(1);
    const [handoff] = await db.select().from(workItems).where(eq(workItems.id, vv!.calidadWorkItemId!));
    expect(JSON.parse(handoff!.observaciones!)).toMatchObject({ disenoId: d.body.id, versionId: v.body.id, fuenteUrl: 'https://drive.google.com/fuente', correccionId });
  });
  it('cubierta no cierra ni va a Autor sin revisión creativa e interna; no la aprueba el especialista por 5C', async () => {
    const d = await solicitar('cubierta_extendida'); const v = await entregar(d.body.id);
    const [vv] = await db.select().from(disenoVersiones).where(eq(disenoVersiones.id, v.body.id));
    expect(vv?.revisionCreativaId).toBeTruthy(); expect(vv?.revisionInternaWorkItemId).toBeTruthy();
    expect((await coordinar(d.body.id, v.body.id, 'enviar_autor')).status).toBe(409);
    expect((await call('PATCH', `/direccion-creativa/${vv!.revisionCreativaId}/cerrar`, { resultadoFinal: 'aprobado' })).status).toBe(403);
    const interna = await login(await crearUsuario('jefe_edicion'));
    expect((await call('PATCH', `/diseno/${d.body.id}/versiones/${v.body.id}/revision-creativa`, { aprobar: true }, cookies.lider)).status).toBe(200);
    expect((await coordinar(d.body.id, v.body.id, 'enviar_autor')).status).toBe(409);
    expect((await call('PATCH', `/diseno/${d.body.id}/versiones/${v.body.id}/revision-interna`, { aprobar: true }, interna)).status).toBe(200);
    expect((await coordinar(d.body.id, v.body.id, 'enviar_autor')).status).toBe(200);
    expect((await coordinar(d.body.id, v.body.id, 'aprobar_autor')).status).toBe(200);
    expect((await db.select().from(disenos).where(eq(disenos.id, d.body.id)))[0]!.cerradoEn).toBeTruthy();
  });
  it('Líder Creativo ajeno no ve ni aprueba cubierta; diseñador no puede hacer revisión interna', async () => {
    const d = await solicitar('cubierta_extendida'); const v = await entregar(d.body.id);
    const otro = await login(await crearUsuario('lider_creativo'));
    expect((await call('GET', '/diseno/revisiones', undefined, otro)).body.trabajos).toHaveLength(0);
    expect((await call('PATCH', `/diseno/${d.body.id}/versiones/${v.body.id}/revision-creativa`, { aprobar: true }, otro)).status).toBe(403);
    expect((await call('PATCH', `/diseno/${d.body.id}/versiones/${v.body.id}/revision-interna`, { aprobar: true }, cookies.disenador)).status).toBe(403);
    expect((await call('GET', '/diseno/revisiones', undefined, cookies.lider)).body.trabajos).toHaveLength(1);
    const [revision] = await db.select().from(disenoVersiones).where(eq(disenoVersiones.id, v.body.id));
    const ajeno = await crearUsuario('lider_creativo'); const ajenoCookie = await login(ajeno);
    expect((await call('PATCH', `/direccion-creativa/${revision!.revisionCreativaId}/asignar`, { liderCreativoId: ajeno.id }, ajenoCookie)).status).toBe(403);
  });
  it('rechazo creativo abre ajustes, revisión por nueva versión y preserva resultado histórico', async () => {
    const d = await solicitar('cubierta_extendida'); const v = await entregar(d.body.id);
    const ruta = `/diseno/${d.body.id}/versiones/${v.body.id}/revision-creativa`;
    expect((await call('PATCH', ruta, { aprobar: false, feedback: 'Ajustar identidad' }, cookies.lider)).status).toBe(200);
    const v2 = await entregar(d.body.id, { enlace: 'https://drive.google.com/v2' }); expect(v2.status).toBe(201);
    const vs = await db.select().from(disenoVersiones).where(eq(disenoVersiones.disenoId, d.body.id));
    expect(new Set(vs.map(x => x.revisionCreativaId)).size).toBe(2);
    expect((await call('PATCH', ruta, { aprobar: true }, cookies.lider)).status).toBe(404);
    const vieja = vs.find(x => x.id === v.body.id)!;
    expect((await db.select().from(workItems).where(eq(workItems.id, vieja.revisionInternaWorkItemId!)))[0]?.estado).toBe('cancelado');
  });
  it('retry no cambia el resultado de revisión ni duplica su auditoría o aviso', async () => {
    const d = await solicitar('cubierta_extendida'); const v = await entregar(d.body.id);
    const ruta = `/diseno/${d.body.id}/versiones/${v.body.id}/revision-creativa`;
    const body = { aprobar: true };
    const responses = await Promise.all([call('PATCH', ruta, body, cookies.lider), call('PATCH', ruta, body, cookies.lider)]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);
    expect((await call('PATCH', ruta, { aprobar: false, feedback: 'Otro resultado' }, cookies.lider)).status).toBe(409);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.accion, 'CUBIERTA_REVISION_CREATIVA'))).toHaveLength(1);
  });
  it('el handoff inicial sigue siendo fase 1 si existen filas legacy de otras fases', async () => {
    await muestraAprobada(); const correccionId = await tripa();
    const [ficha] = await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, p.id));
    await db.insert(fichaCalidadFases).values({ fichaId: ficha!.id, numeroFase: 4, ronda: 1 });
    const d = await solicitar('diagramacion', { correccionId, aprobacionEdicionUrl: 'https://drive.google.com/aprobacion' });
    const v = await entregar(d.body.id);
    expect((await coordinar(d.body.id, v.body.id, 'handoff_calidad')).status).toBe(200);
    const [vv] = await db.select().from(disenoVersiones).where(eq(disenoVersiones.id, v.body.id));
    expect((await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, vv!.calidadFaseId!)))[0]?.numeroFase).toBe(1);
  });
  it('una clave de solicitud no sirve para otro tipo de trabajo; las etapas pueden trabajar en paralelo', async () => {
    const solicitudKey = randomUUID();
    expect((await solicitar('muestra_diagramacion', { solicitudKey })).status).toBe(201);
    expect((await solicitar('cubierta_extendida', { solicitudKey })).status).toBe(409);
    expect((await solicitar('cubierta_extendida')).status).toBe(201);
    expect(await db.select().from(disenos)).toHaveLength(2);
  });
  it('lee brief y recursos canónicos, no una copia, y entrega hora exacta', async () => {
    const d = await solicitar(); await entregar(d.body.id);
    await db.update(direccionesCreativas).set({ briefEnlace: 'https://drive.google.com/brief-actual' }).where(eq(direccionesCreativas.id, dcId));
    const q = await call('GET', '/diseno/mios', undefined, cookies.disenador);
    expect(q.body.trabajos[0].briefEnlace).toBe('https://drive.google.com/brief-actual');
    expect(q.body.trabajos[0].versiones[0].entregadoEn).toMatch(/T.*Z$/);
    const otro = await login(await crearUsuario('disenador')); expect((await call('GET', '/diseno/mios', undefined, otro)).body.trabajos).toHaveLength(0);
  });
  it('las FKs nuevas permiten eliminar el proyecto temporal sin errores por orden del CASCADE', async () => {
    await muestraAprobada();
    const d = await solicitar('diagramacion', { correccionId: await tripa(), aprobacionEdicionUrl: 'https://drive.google.com/aprobacion' });
    const v = await entregar(d.body.id); await coordinar(d.body.id, v.body.id, 'handoff_calidad');
    const cubierta = await solicitar('cubierta_extendida'); await entregar(cubierta.body.id);
    await db.delete(proyectos).where(eq(proyectos.id, p.id));
    expect(await db.select().from(disenos)).toHaveLength(0);
    expect(await db.select().from(disenoVersiones)).toHaveLength(0);
    expect(await db.select().from(fichaCalidadFases)).toHaveLength(0);
  });
});
describe('5D SLA sin inferencias de texto libre ni calendario', () => {
  it('criterio estructurado de especial: 15, estándar 5, muestra/cubierta 3', () => {
    expect(diasReferenciaDiseno('diagramacion', ['Diagramación especial'])).toBe(15);
    expect(diasReferenciaDiseno('diagramacion', ['Ilustraciones'])).toBe(5);
    expect(diasReferenciaDiseno('muestra_diagramacion', null)).toBe(3);
    expect(diasReferenciaDiseno('cubierta_extendida', null)).toBe(3);
    expect(diasReferenciaDiseno('diagramacion', ['Diagramación ultra especial'])).toBeNull();
  });
  it('comparación exacta de SLA y ausencia explícita de vencimiento', () => {
    expect(plazoDiseno(null, null)).toBeNull();
    expect(plazoDiseno(new Date('2026-01-01T10:00Z'), new Date('2026-01-01T20:00Z'))).toBe('vencido');
    expect(plazoDiseno(new Date('2026-01-01T10:00Z'), new Date('2026-01-01T10:00Z'))).toBe('en_tiempo');
  });
});
