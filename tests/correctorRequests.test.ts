import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { auditLogs, notificaciones, solicitudesArea, workItems } from '../server/db/schema/index.js';
import { crearProyectoDePrueba, crearUsuario, completarPreparacionDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { solicitarCorreccion, asignarCorrector } from '../server/helpers/correcciones.js';
import { crearRequestCorrector, decidirRequestCorrector, listarRequestsCorrector, obtenerRequestCorrectorDetalle } from '../server/helpers/correctorRequests.js';
import type { CorrectorRequestType } from '../shared/correctorRequests.js';

let app: ReturnType<typeof crearAppDePrueba> | undefined;
beforeEach(limpiarBaseDeDatos);
afterEach(async () => { await app?.close(); app = undefined; });

async function scenario() {
  const [corrector, other, specialist] = await Promise.all([crearUsuario('corrector'), crearUsuario('corrector'), crearUsuario('especialista')]);
  const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
  await completarPreparacionDePrueba(p.id);
  const { id: correccionId } = await solicitarCorreccion(p.id, { alcance: 'tripa_completa' }, specialist.id);
  const asignacion = await asignarCorrector(correccionId, { correctorId: corrector.id, freelance: false, contratoConfirmado: true }, specialist.id);
  if (!asignacion.ok) throw new Error(asignacion.error);
  const [w] = await db.select().from(workItems).where(and(eq(workItems.proyectoId, p.id), eq(workItems.tipo, 'correccion')));
  app = crearAppDePrueba(); await app.ready();
  const login = async (email: string) => {
    const r = await request(app!.server).post('/api/auth/login').send({ email, password: 'password123' });
    expect(r.status).toBe(200); return r.headers['set-cookie']![0]!.split(';')[0]!;
  };
  const cookie = await login(corrector.email);
  const send = (body: object, auth = cookie) => request(app!.server).post('/api/correcciones/mis-solicitudes').set('Cookie', auth).send(body);
  const create = async (type: CorrectorRequestType = 'corrector_material') => crearRequestCorrector(corrector.id, w!.id, type, 'El material recibido no corresponde a la versión final');
  const list = (filters = {}, tab: Parameters<typeof listarRequestsCorrector>[1] = 'all', page = 1, size = 25) => listarRequestsCorrector(corrector.id, tab, page, size, filters);
  return { corrector, other, specialist, p, w: w!, correccionId, cookie, login, send, create, list };
}

describe('Corrector · Mis solicitudes · outbox y ciclo de vida', () => {
  it('creación contextual, destino Especialista, auditoría y aviso real', async () => {
    const f = await scenario();
    const response = await f.send({ workItemId: f.w.id, type: 'corrector_material', motivo: 'El archivo no corresponde a la versión final' });
    expect(response.status, response.text).toBe(200);
    const [r] = await db.select().from(solicitudesArea).where(eq(solicitudesArea.id, response.body.id));
    expect(r).toMatchObject({ tipo: 'corrector_material', requestedById: f.corrector.id, workItemId: f.w.id, proyectoId: f.p.id, targetUserId: f.specialist.id, estado: 'pendiente' });
    expect((await f.list()).items[0]).toMatchObject({ target: 'Especialista', requestedBy: f.corrector.nombre, workAccessible: true, interventionLabel: 'Tripa completa' });
    expect(await db.select().from(auditLogs).where(eq(auditLogs.entityId, r!.id))).toHaveLength(1);
    expect((await db.select().from(notificaciones)).some(n => n.usuarioDestinoId === f.specialist.id && n.rolDestino === 'especialista')).toBe(true);
  });
  it('no admite tipo ajeno, otro corrector ajeno ni sesión anónima', async () => {
    const f = await scenario(), body = { workItemId: f.w.id, type: 'corrector_material', motivo: 'El archivo no corresponde a la versión final' };
    expect((await f.send({ ...body, type: 'editor_apoyo' })).status).toBe(400);
    expect((await f.send(body, await f.login(f.other.email))).status).toBe(403);
    expect((await request(app!.server).post('/api/correcciones/mis-solicitudes').send(body)).status).toBe(401);
  });
  it('dos envíos simultáneos no duplican una solicitud pendiente', async () => {
    const f = await scenario(), body = { workItemId: f.w.id, type: 'corrector_tecnico', motivo: 'El archivo de Word no abre correctamente' };
    const results = await Promise.all([f.send(body), f.send(body)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await f.list()).total).toBe(1);
  });
  it('devuelta primero, pregunta y respuesta con actores y fecha; reenvío conserva el ID', async () => {
    const f = await scenario(), r = await f.create('corrector_aclaracion');
    await decidirRequestCorrector(r.id, f.specialist, 1, 'return', 'Indica a qué nombre propio te refieres exactamente');
    const before = await obtenerRequestCorrectorDetalle(r.id, f.corrector.id);
    expect(before?.summary).toMatchObject({ status: 'devuelta', version: 2, canRespond: true });
    expect(before?.observations?.[0]).toMatchObject({ askedBy: f.specialist.nombre, answer: null });
    const response = await request(app!.server).post(`/api/correcciones/mis-solicitudes/${r.id}/responder`).set('Cookie', f.cookie).send({ expectedVersion: 2, text: 'Me refiero al nombre del protagonista en el capítulo tres' });
    expect(response.status, response.text).toBe(200);
    const after = await obtenerRequestCorrectorDetalle(r.id, f.corrector.id);
    expect(after?.summary).toMatchObject({ id: r.id, status: 'pendiente', version: 3 });
    expect(after?.observations?.[0]).toMatchObject({ answeredBy: f.corrector.nombre, answer: 'Me refiero al nombre del protagonista en el capítulo tres' });
    expect(after?.observations?.[0]?.answeredAt).toBeTruthy();
  });
  it('lectura no cambia estado ni genera eventos', async () => {
    const f = await scenario(), r = await f.create();
    const a = await obtenerRequestCorrectorDetalle(r.id, f.corrector.id), b = await obtenerRequestCorrectorDetalle(r.id, f.corrector.id);
    expect(a?.summary.status).toBe('pendiente'); expect(b?.history).toEqual(a?.history);
    expect((await f.list()).items[0]?.lastEventLabel).toBe('Solicitud enviada');
  });
  it('resuelta muestra resultado, actor; rechaza edición/cancelación obsoletas y decisión de quien no es destinatario', async () => {
    const f = await scenario(), r = await f.create();
    await decidirRequestCorrector(r.id, f.specialist, 1, 'resolve', 'Confirmado: el archivo correcto ya está en la carpeta Para corregir.');
    const d = await obtenerRequestCorrectorDetalle(r.id, f.corrector.id);
    expect(d?.summary).toMatchObject({ status: 'resuelta', outcome: 'Confirmado: el archivo correcto ya está en la carpeta Para corregir.', resolvedBy: f.specialist.nombre });
    const conflictResponder = await request(app!.server).post(`/api/correcciones/mis-solicitudes/${r.id}/responder`).set('Cookie', f.cookie).send({ expectedVersion: 1, text: 'Información enviada desde una sesión obsoleta' });
    expect(conflictResponder.status).toBe(409);
    const conflictCancelar = await request(app!.server).post(`/api/correcciones/mis-solicitudes/${r.id}/cancelar`).set('Cookie', f.cookie).send({ expectedVersion: 1 });
    expect(conflictCancelar.status).toBe(409);
    const other = await crearUsuario('especialista');
    await expect(decidirRequestCorrector(r.id, other, 2, 'resolve', 'No soy el Especialista de este proyecto')).rejects.toMatchObject({ statusCode: 403 });
    expect((await request(app!.server).post(`/api/correcciones/solicitudes-corrector/${r.id}/decidir`).set('Cookie', f.cookie).send({ expectedVersion: 2, action: 'resolve', text: 'El propio Corrector no debe poder decidir' })).status).toBe(403);
  });
  it('cancelar conserva fila e historial, abandona pendientes e invalida versión', async () => {
    const f = await scenario(), r = await f.create();
    const cancel = () => request(app!.server).post(`/api/correcciones/mis-solicitudes/${r.id}/cancelar`).set('Cookie', f.cookie).send({ expectedVersion: 1 });
    expect((await cancel()).status).toBe(200); expect((await cancel()).status).toBe(409);
    const [stored] = await db.select().from(solicitudesArea).where(eq(solicitudesArea.id, r.id));
    expect(stored).toMatchObject({ estado: 'cancelada', resolvedById: f.corrector.id, version: 2 });
    expect((await f.list({}, 'pending')).total).toBe(0);
    expect((await obtenerRequestCorrectorDetalle(r.id, f.corrector.id))?.history.some(h => h.label.includes('cancel'))).toBe(true);
  });
  it('IDOR: otro Corrector no enumera, lee, cancela ni responde una solicitud ajena', async () => {
    const f = await scenario(), r = await f.create(), cookie = await f.login(f.other.email);
    expect((await request(app!.server).get('/api/correcciones/mis-solicitudes').set('Cookie', cookie)).body.total).toBe(0);
    expect((await request(app!.server).get(`/api/correcciones/mis-solicitudes/${r.id}`).set('Cookie', cookie)).status).toBe(404);
    expect((await request(app!.server).post(`/api/correcciones/mis-solicitudes/${r.id}/cancelar`).set('Cookie', cookie).send({ expectedVersion: 1 })).status).toBe(404);
    expect((await request(app!.server).post(`/api/correcciones/mis-solicitudes/${r.id}/responder`).set('Cookie', cookie).send({ expectedVersion: 1, text: 'No debe aceptar información ajena' })).status).toBe(404);
  });
  it('tras reasignar el Corrector pierde capacidad de reenviar, la solicitud propia se conserva', async () => {
    const f = await scenario(), r = await f.create();
    await decidirRequestCorrector(r.id, f.specialist, 1, 'return', 'Explica el motivo de la consulta');
    const reasignacion = await asignarCorrector(f.correccionId, { correctorId: f.other.id, freelance: false, contratoConfirmado: true }, f.specialist.id);
    expect(reasignacion.ok).toBe(true);
    const d = await obtenerRequestCorrectorDetalle(r.id, f.corrector.id);
    expect(d?.summary).toMatchObject({ workAccessible: false, canRespond: false, status: 'devuelta' });
    const response = await request(app!.server).post(`/api/correcciones/mis-solicitudes/${r.id}/responder`).set('Cookie', f.cookie).send({ expectedVersion: 2, text: 'Intento reenviar desde mi asignación anterior' });
    expect(response.status).toBe(403);
  });
  it('filtros de tipo/proyecto/fecha, conteos globales y paginación en servidor', async () => {
    const f = await scenario();
    const a = await f.create('corrector_material'), b = await f.create('corrector_aclaracion'), c = await f.create('corrector_tecnico');
    await db.update(solicitudesArea).set({ requestedAt: new Date('2026-10-25T03:59:00Z') }).where(eq(solicitudesArea.id, a.id));
    await db.update(solicitudesArea).set({ requestedAt: new Date('2026-10-25T04:00:00Z') }).where(eq(solicitudesArea.id, b.id));
    await decidirRequestCorrector(c.id, f.specialist, 1, 'return', 'Explica mejor el problema técnico que detectaste');
    const page = await f.list({}, 'all', 1, 1);
    expect(page.total).toBe(3); expect(page.items).toHaveLength(1); expect(page.counts).toMatchObject({ all: 3, pending: 2, returned: 1 }); expect(page.items[0]?.id).toBe(c.id);
    expect((await f.list({ search: 'protagonista' })).total).toBe(0);
    expect((await f.list({ type: 'corrector_material', from: '2026-10-25', to: '2026-10-25' })).total).toBe(0);
    expect((await f.list({ type: 'corrector_aclaracion', from: '2026-10-25', to: '2026-10-25' })).total).toBe(1);
    const invalid = await request(app!.server).get('/api/correcciones/mis-solicitudes?from=2026-10-26&to=2026-10-20').set('Cookie', f.cookie); expect(invalid.status).toBe(400);
  });
  it('no revienta la bandeja genérica de Solicitudes del Especialista', async () => {
    const f = await scenario(); await f.create('corrector_material');
    const inbox = await request(app!.server).get('/api/especialistas/solicitudes').set('Cookie', await f.login(f.specialist.email));
    expect(inbox.status, inbox.text).toBe(200);
    expect(inbox.body.solicitudes.some((s: any) => s.tipo?.startsWith('corrector_'))).toBe(false);
  });
});
