import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../server/app.js';
import { db, pool } from '../server/db/client.js';
import { auditLogs, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases, fichasTrazabilidad, notificaciones, projectAssignments, proyectos, solicitudesArea, workItems } from '../server/db/schema/index.js';
import { createQualityRequest, detailQualityRequest, listQualityRequests } from '../server/helpers/soporteEditorialRequests.js';
import { criteriosDeFase } from '../server/helpers/calidad.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import type { CreateQualityRequest, QualityRequestType } from '../shared/soporteEditorialRequests.js';

describe('Soporte Editorial · Mis solicitudes · lifecycle canónico', () => {
  let app: ReturnType<typeof buildApp>;
  let support: Awaited<ReturnType<typeof crearUsuario>>, other: typeof support, specialist: typeof support, designer: typeof support;
  let p: Awaited<ReturnType<typeof crearProyectoDePrueba>>, workId: string, phaseId: string, designId: string;
  let cookies: Record<string, string>;
  const filters = { tab: 'all' as const, search: '', page: 1, pageSize: 10 };
  async function login(user: typeof support) {
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: user.email, password: 'password123' } });
    return r.cookies.map(c => c.name + '=' + c.value).join('; ');
  }
  async function call(method: 'GET' | 'POST' | 'PATCH', path: string, body?: object, cookie = cookies.support) {
    const r = await app.inject({ method, url: '/api/calidad' + path, headers: { cookie }, payload: body });
    return { status: r.statusCode, body: r.json() };
  }
  const payload = (type: QualityRequestType = 'calidad_material'): CreateQualityRequest => ({ workItemId: workId, type, subject: 'Confirmar el material recibido', description: 'El archivo recibido no corresponde a la versión entregada para validar.', idempotencyKey: randomUUID() });
  const create = (type?: QualityRequestType, actor = support) => createQualityRequest(actor, payload(type));
  async function decide(id: string, expectedVersion: number, action: 'review' | 'return' | 'resolve', extra = {}, cookie = cookies.specialist) {
    return call('POST', `/solicitudes-recibidas/${id}/decidir`, { expectedVersion, action, text: 'Explicación operativa registrada por el Especialista.', ...extra }, cookie);
  }
  beforeEach(async () => {
    await limpiarBaseDeDatos(); app = buildApp(); await app.ready();
    [support, other, specialist, designer] = await Promise.all([crearUsuario('soporte_editorial'), crearUsuario('soporte_editorial'), crearUsuario('especialista'), crearUsuario('disenador')]);
    p = await crearProyectoDePrueba({ especialistaId: specialist.id, disenadorId: designer.id });
    const [f] = await db.insert(fichasTrazabilidad).values({ proyectoId: p.id }).returning();
    const [cw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'direccion_creativa', estado: 'completado' }).returning();
    const [dc] = await db.insert(direccionesCreativas).values({ proyectoId: p.id, workItemId: cw!.id, tipo: 'concepto_portada', resultadoFinal: 'aprobado' }).returning();
    const [dw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno', estado: 'en_progreso' }).returning();
    const [d] = await db.insert(disenos).values({ proyectoId: p.id, workItemId: dw!.id, tipo: 'diagramacion', direccionCreativaId: dc!.id, fuenteUrl: 'https://example.test/fuente', solicitudKey: randomUUID(), preparacionConfirmada: true }).returning(); designId = d!.id;
    const [w] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'calidad', businessKey: randomUUID() }).returning(); workId = w!.id;
    const [v] = await db.insert(disenoVersiones).values({ disenoId: designId, numero: 3, enlace: 'https://example.test/v3', entregaKey: randomUUID(), entregadoPorId: designer.id, handoffEn: new Date(), calidadWorkItemId: workId }).returning();
    const [q] = await db.insert(fichaCalidadFases).values({ fichaId: f!.id, numeroFase: 2, ronda: 2, pdfVersion: 'V3', pdfUrl: v!.enlace, workItemId: workId, disenoVersionId: v!.id, solicitadoEn: new Date() }).returning(); phaseId = q!.id;
    await db.update(disenoVersiones).set({ calidadFaseId: phaseId }).where(eq(disenoVersiones.id, v!.id));
    cookies = { support: await login(support), other: await login(other), specialist: await login(specialist), designer: await login(designer) };
  });
  afterEach(async () => { await app.close(); });

  it('crea por work item, conserva F2.2/V3 y enruta al Especialista con auditoría y aviso', async () => {
    const response = await call('POST', '/mis-solicitudes', payload()); expect(response.status).toBe(200);
    const [r] = await db.select().from(solicitudesArea).where(eq(solicitudesArea.id, response.body.id));
    expect(r).toMatchObject({ workItemId: workId, proyectoId: p.id, requestedById: support.id, targetUserId: specialist.id, estado: 'pendiente' });
    const detail = await detailQualityRequest(r!.id, support.id);
    expect(detail?.summary).toMatchObject({ qualityPhaseId: phaseId, phase: 2, round: 2, versionLabel: 'V3', subject: 'Confirmar el material recibido' });
    expect(detail?.destination).toBe('Especialista coordinador');
    expect(detail?.history).toHaveLength(1);
    const notices = await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId, specialist.id));
    expect(notices.some(n => n.targetPath === '/?vista=solicitudes&qualityRequest=' + r!.id)).toBe(true);
    expect((await db.select().from(workItems).where(eq(workItems.id, workId)))[0]!.estado).toBe('pendiente');
  });
  it('habilita solo tipos de Calidad y no acepta target, estado, proyecto, fase, archivos ni IDs libres', async () => {
    for (const extra of [{ type: 'editor' }, { type: 'corrector_material' }, { type: 'otro' }, { targetUserId: designer.id }, { status: 'resuelta' }, { projectId: p.id }, { qualityPhaseId: phaseId }, { attachments: [{ fileId: 'ajeno' }] }, { fileId: 'ajeno' }]) {
      expect((await call('POST', '/mis-solicitudes', { ...payload(), ...extra })).status).toBe(400);
    }
    expect((await call('POST', '/mis-solicitudes', { ...payload(), workItemId: randomUUID() })).status).toBe(404);
    const [wrong] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno', businessKey: randomUUID() }).returning();
    expect((await call('POST', '/mis-solicitudes', { ...payload(), workItemId: wrong!.id })).status).toBe(404);
  });
  it('creación de material, aclaración y problema técnico usa tipos inequívocos y destino controlado', async () => {
    for (const type of ['calidad_material', 'calidad_aclaracion', 'calidad_tecnico'] as const) expect((await call('POST', '/mis-solicitudes', payload(type))).status).toBe(200);
    expect((await listQualityRequests(support.id, filters)).total).toBe(3);
    expect((await db.select().from(solicitudesArea)).every(r => r.targetUserId === specialist.id)).toBe(true);
  });
  it('requests privadas aunque las validaciones sean compartidas por el rol', async () => {
    const r = await create();
    expect((await call('GET', '/mis-solicitudes', undefined, cookies.other)).body.total).toBe(0);
    expect((await call('GET', '/mis-solicitudes/' + r.id, undefined, cookies.other)).status).toBe(404);
    expect((await call('POST', `/mis-solicitudes/${r.id}/cancelar`, { expectedVersion: 1 }, cookies.other)).status).toBe(404);
    expect((await call('POST', `/mis-solicitudes/${r.id}/responder`, { expectedVersion: 1, questionId: randomUUID(), text: 'Respuesta ajena.' }, cookies.other)).status).toBe(404);
    // La bandeja de rondas es compartida por decisión de negocio; no se inventa ownership individual.
    expect((await call('POST', '/mis-solicitudes', payload(), cookies.other)).status).toBe(200);
  });
  it('RBAC: anónimo y otros roles no crean ni leen outbox; el Validador no decide', async () => {
    expect((await call('GET', '/mis-solicitudes', undefined, '')).status).toBe(401);
    for (const cookie of [cookies.specialist, cookies.designer]) expect((await call('POST', '/mis-solicitudes', payload(), cookie)).status).toBe(403);
    const r = await create();
    expect((await decide(r.id, 1, 'resolve', {}, cookies.support)).status).toBe(403);
    expect((await call('GET', '/solicitudes-recibidas', undefined, cookies.support)).status).toBe(403);
  });
  it('doble envío concurrente con misma clave devuelve el mismo ID sin duplicar avisos ni audit', async () => {
    const body = payload(); const responses = await Promise.all([call('POST', '/mis-solicitudes', body), call('POST', '/mis-solicitudes', body)]);
    expect(responses.map(r => r.status)).toEqual([200, 200]); expect(responses[0]!.body.id).toBe(responses[1]!.body.id);
    expect((await db.select().from(solicitudesArea))).toHaveLength(1);
    expect((await db.select().from(auditLogs).where(eq(auditLogs.entityId, responses[0]!.body.id)))).toHaveLength(1);
    expect((await call('POST', '/mis-solicitudes', { ...body, subject: 'Otra necesidad distinta' })).status).toBe(409);
    expect((await call('POST', '/mis-solicitudes', payload())).status).toBe(409);
  });
  it('abrir lista/detalle no inicia revisión ni produce eventos', async () => {
    const r = await create(); await call('GET', '/mis-solicitudes'); await call('GET', '/mis-solicitudes/' + r.id);
    await call('GET', '/solicitudes-recibidas/' + r.id, undefined, cookies.specialist);
    expect((await db.select().from(solicitudesArea))[0]!.estado).toBe('pendiente');
    expect((await db.select().from(auditLogs).where(eq(auditLogs.entityId, r.id)))).toHaveLength(1);
  });
  it('revisión explícita, devolución y respuesta preservan la solicitud y las preguntas con actores', async () => {
    const r = await create(); expect((await decide(r.id, 1, 'review')).status).toBe(200);
    expect((await decide(r.id, 2, 'return', { text: 'Indica la página y la versión del PDF recibido.' })).status).toBe(200);
    const d = (await detailQualityRequest(r.id, support.id))!;
    expect(d.summary).toMatchObject({ status: 'requiere_informacion', requiresAction: true, version: 3 });
    expect(d.questions[0]).toMatchObject({ actor: specialist.nombre, answer: null });
    expect((await listQualityRequests(support.id, { ...filters, tab: 'returned' })).total).toBe(1);
    expect((await call('POST', `/mis-solicitudes/${r.id}/responder`, { expectedVersion: 3, questionId: randomUUID(), text: 'La página quince está vacía.' })).status).toBe(409);
    expect((await call('POST', `/mis-solicitudes/${r.id}/responder`, { expectedVersion: 3, questionId: d.questions[0]!.id, text: 'La página quince está vacía en V3.' })).status).toBe(200);
    const after = (await detailQualityRequest(r.id, support.id))!;
    expect(after.summary).toMatchObject({ id: r.id, status: 'pendiente', version: 4 });
    expect(after.questions[0]).toMatchObject({ answer: 'La página quince está vacía en V3.', answeredBy: support.nombre });
    expect(after.history).toHaveLength(4);
  });
  it('resuelta muestra resultado/actor/fecha, conserva referencia validada y no genera rondas', async () => {
    const r = await create(); const before = await db.select().from(fichaCalidadFases);
    expect((await decide(r.id, 1, 'resolve', { resultQualityPhaseId: randomUUID() })).status).toBe(404);
    expect((await decide(r.id, 1, 'resolve', { resultQualityPhaseId: phaseId, text: 'Se confirmó el enlace a la versión correcta.' })).status).toBe(200);
    const detail = (await detailQualityRequest(r.id, support.id))!;
    expect(detail.summary).toMatchObject({ status: 'resuelta', canCancel: false, requiresAction: false });
    expect(detail.result).toMatchObject({ text: 'Se confirmó el enlace a la versión correcta.', actor: specialist.nombre, references: { qualityPhaseId: phaseId, round: 2, versionLabel: 'V3' } });
    expect((await call('POST', `/mis-solicitudes/${r.id}/cancelar`, { expectedVersion: 2 })).status).toBe(409);
    expect((await db.select().from(fichaCalidadFases))).toHaveLength(before.length);
    expect((await db.select().from(notificaciones)).some(n => n.targetPath === '/?vista=mis-solicitudes&request=' + r.id && n.usuarioDestinoId === support.id)).toBe(true);
  });
  it('cancelación conserva entidad, motivo, actor/fecha e historial y no admite cambios posteriores', async () => {
    const r = await create();
    expect((await call('POST', `/mis-solicitudes/${r.id}/cancelar`, { expectedVersion: 1, reason: 'El problema ya no impide la revisión.' })).status).toBe(200);
    const d = (await detailQualityRequest(r.id, support.id))!;
    expect(d.summary).toMatchObject({ status: 'cancelada', canCancel: false });
    expect(d.cancellation).toMatchObject({ reason: 'El problema ya no impide la revisión.', actor: support.nombre });
    expect(d.history).toHaveLength(2); expect((await decide(r.id, 2, 'resolve')).status).toBe(409);
  });
  it('stale update y decisión simultánea no sobrescriben resolución', async () => {
    const r = await create();
    const decisions = await Promise.all([decide(r.id, 1, 'resolve'), decide(r.id, 1, 'return')]);
    expect(decisions.map(d => d.status).sort()).toEqual([200, 409]);
    expect((await db.select().from(auditLogs).where(eq(auditLogs.entityId, r.id)))).toHaveLength(2);
    expect((await call('POST', `/mis-solicitudes/${r.id}/cancelar`, { expectedVersion: 1 })).status).toBe(409);
  });
  it('Especialista actual canónico decide; otro y el anterior después de reasignación no acceden', async () => {
    const r = await create(), next = await crearUsuario('especialista'), cookie = await login(next);
    expect((await decide(r.id, 1, 'resolve', {}, cookie)).status).toBe(403);
    await db.insert(projectAssignments).values({ proyectoId: p.id, tipo: 'especialista', usuarioId: next.id });
    expect((await call('GET', '/solicitudes-recibidas/' + r.id, undefined, cookies.specialist)).status).toBe(404);
    expect((await decide(r.id, 1, 'resolve')).status).toBe(403);
    expect((await decide(r.id, 1, 'resolve', {}, cookie)).status).toBe(200);
  });
  it('no crea sobre ronda cerrada, proyecto cerrado/pausado ni trabajo sin ronda', async () => {
    for (const estado of ['pausado', 'retirado', 'culminado'] as const) {
      await db.update(proyectos).set({ estado }).where(eq(proyectos.id, p.id));
      expect((await call('POST', '/mis-solicitudes', payload())).status).toBe(409);
    }
    await db.update(proyectos).set({ estado: 'en_proceso' }).where(eq(proyectos.id, p.id));
    await db.update(fichaCalidadFases).set({ revisadoEn: new Date(), aprobado: true }).where(eq(fichaCalidadFases.id, phaseId));
    expect((await call('POST', '/mis-solicitudes', payload())).status).toBe(409);
    expect((await call('GET', '/mis-solicitudes/contextos')).body.total).toBe(0);
  });
  it('la solicitud conserva su ronda aunque esa revisión se cierre después', async () => {
    const r = await create();
    await db.update(fichaCalidadFases).set({ revisadoEn: new Date(), aprobado: true, checklist: Object.fromEntries(criteriosDeFase(2).map(k => [k, { cumple: true }])) }).where(eq(fichaCalidadFases.id, phaseId));
    expect((await detailQualityRequest(r.id, support.id))?.summary).toMatchObject({ qualityPhaseId: phaseId, round: 2, versionLabel: 'V3' });
    expect((await decide(r.id, 1, 'resolve')).status).toBe(200);
  });
  it('una ronda abierta en stand-by puede reportar un problema sin inventar otra prohibición de Calidad', async () => {
    await db.update(proyectos).set({ estado: 'stand_by' }).where(eq(proyectos.id, p.id));
    expect((await call('POST', '/mis-solicitudes', payload())).status).toBe(200);
    expect((await call('GET', '/mis-solicitudes/contextos')).body.total).toBe(1);
  });
  it('el contexto SQL protege contra requests huérfanas o de otro proyecto incluso al insertar directamente', async () => {
    const foreign = await crearProyectoDePrueba();
    await expect(db.insert(solicitudesArea).values({ proyectoId: foreign.id, workItemId: workId, tipo: 'calidad_material', businessKey: randomUUID(), requestedById: support.id, targetUserId: specialist.id, asunto: 'Contexto incorrecto', descripcion: 'Este trabajo pertenece a otro proyecto.' })).rejects.toThrow();
  });
  it('filtra días de Caracas y rechaza rangos y parámetros inválidos con 400', async () => {
    const r = await create();
    await db.update(solicitudesArea).set({ requestedAt: new Date('2026-10-28T03:59:00Z') }).where(eq(solicitudesArea.id, r.id));
    expect((await listQualityRequests(support.id, { ...filters, from: '2026-10-28' })).total).toBe(0);
    expect((await listQualityRequests(support.id, { ...filters, from: '2026-10-27', to: '2026-10-27' })).total).toBe(1);
    for (const query of ['from=2026-10-28&to=2026-10-27', 'from=no-fecha', 'pageSize=99', 'status=abierta']) expect((await call('GET', '/mis-solicitudes?' + query)).status).toBe(400);
  });
  it('agregados sobre todo el resultado, filtros y paginación SQL sin N+1 ni detalle en lista', async () => {
    for (let i = 0; i < 12; i++) { const r = await create(); expect((await decide(r.id, 1, 'resolve')).status).toBe(200); }
    const pending = await create('calidad_aclaracion'); expect((await decide(pending.id, 1, 'return')).status).toBe(200);
    const spy = vi.spyOn(pool, 'query');
    try {
      const list = await listQualityRequests(support.id, filters);
      expect(spy.mock.calls).toHaveLength(1); expect(list).toMatchObject({ total: 13, pages: 2, counts: { all: 13, resolved: 12, returned: 1 } });
      expect(list.items).toHaveLength(10); expect(list.items[0]!.id).toBe(pending.id);
      expect(JSON.stringify(list)).not.toMatch(/description|questions|history|attachments|outcome/);
      expect((await listQualityRequests(support.id, { ...filters, page: 999 }))).toMatchObject({ page: 2, items: expect.any(Array) });
      for (const search of [p.codigo, 'V3', 'ronda 2', 'Material incorrecto']) expect((await listQualityRequests(support.id, { ...filters, search })).total).toBeGreaterThan(0);
      expect((await listQualityRequests(support.id, { ...filters, type: 'calidad_aclaracion' })).total).toBe(1);
      expect((await listQualityRequests(other.id, filters)).total).toBe(0);
    } finally { spy.mockRestore(); }
  });
});
