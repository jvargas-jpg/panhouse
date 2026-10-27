import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { auditLogs, autores, capitulos, notificaciones, proyectos, solicitudesArea, workItems } from '../server/db/schema/index.js';
import { crearProyectoDePrueba, crearUsuario, completarPreparacionDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { asignarEditor } from '../server/helpers/proyectos.js';
import { crearCapitulo } from '../server/helpers/capitulos.js';
import { crearRequestEditor, decidirRequestEditor, listarRequestsEditor, obtenerRequestEditorDetalle } from '../server/helpers/editorOwnRequests.js';

let app: ReturnType<typeof crearAppDePrueba> | undefined;
beforeEach(limpiarBaseDeDatos);
afterEach(async () => { await app?.close(); app = undefined; });
async function scenario() {
  const [editor, other, specialist, chief] = await Promise.all([crearUsuario('editor'), crearUsuario('editor'), crearUsuario('especialista'), crearUsuario('jefe_edicion')]);
  const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
  await completarPreparacionDePrueba(p.id); await asignarEditor(p.id, editor.id, chief.id); await crearCapitulo(p.id, 7, editor.id);
  const [c] = await db.select().from(capitulos).where(eq(capitulos.proyectoId, p.id));
  const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));
  app = crearAppDePrueba(); await app.ready();
  const login = async (email: string) => {
    const r = await request(app!.server).post('/api/auth/login').send({ email, password: 'password123' });
    expect(r.status).toBe(200); return r.headers['set-cookie']![0]!.split(';')[0]!;
  };
  const cookie = await login(editor.email);
  const send = (body: object, auth = cookie) => request(app!.server).post('/api/editores/mis-solicitudes').set('Cookie', auth).send(body);
  const create = async (type: 'editor_apoyo' | 'editor_reasignacion' | 'editor_aclaracion' = 'editor_apoyo') => crearRequestEditor(editor.id, w!.id, type, 'Necesito revisar la estructura de la intervención');
  const list = (filters = {}, tab: Parameters<typeof listarRequestsEditor>[1] = 'all', page = 1, size = 25) => listarRequestsEditor(editor.id, tab, page, size, filters);
  return { editor, other, specialist, chief, p, w: w!, cookie, login, send, create, list };
}
describe('Editor · Mis solicitudes · outbox y ciclo de vida', () => {
  it('creación contextual, tipo propio, destino, inbox, auditoría y aviso real', async () => {
    const f = await scenario();
    const response = await f.send({ workItemId: f.w.id, type: 'editor_apoyo', motivo: 'Necesito apoyo con la estructura' });
    expect(response.status, response.text).toBe(200);
    const [r] = await db.select().from(solicitudesArea).where(eq(solicitudesArea.id, response.body.id));
    expect(r).toMatchObject({ tipo: 'editor_apoyo', requestedById: f.editor.id, workItemId: f.w.id, proyectoId: f.p.id, estado: 'pendiente' });
    expect((await f.list()).items[0]).toMatchObject({ target: 'Jefe de Edición', requestedBy: f.editor.nombre, workAccessible: true, interventionLabel: 'Capítulo 7' });
    expect(await db.select().from(auditLogs).where(eq(auditLogs.entityId, r!.id))).toHaveLength(1);
    expect((await db.select().from(notificaciones)).some(n => n.targetPath?.includes(r!.id))).toBe(true);
    const inbox = await request(app!.server).get('/api/editores/solicitudes?tab=pending').set('Cookie', await f.login(f.chief.email));
    expect(inbox.body.items.some((i: any) => i.id === r!.id)).toBe(true);
  });
  it('no admite tipo nativo editor, destino manual, adjuntos arbitrarios ni contexto ajeno', async () => {
    const f = await scenario(), body = { workItemId: f.w.id, type: 'editor_apoyo', motivo: 'Necesito validar esta intervención' };
    expect((await f.send({ ...body, type: 'editor' })).status).toBe(400);
    expect((await f.send({ ...body, targetUserId: f.other.id })).status).toBe(400);
    expect((await f.send({ ...body, attachment: { fileId: 'arbitrary-file' } })).status).toBe(400);
    expect((await f.send(body, await f.login(f.other.email))).status).toBe(403);
    expect((await request(app!.server).post('/api/editores/mis-solicitudes').send(body)).status).toBe(401);
    expect((await f.send(body, await f.login(f.chief.email))).status).toBe(403);
    expect((await request(app!.server).post(`/api/editores/mis-solicitudes/${f.w.id}/archivos`).set('Cookie', f.cookie).send({ fileId: 'arbitrary-file' })).status).toBe(404);
  });
  it('dos envíos simultáneos no duplican una solicitud pendiente', async () => {
    const f = await scenario(), body = { workItemId: f.w.id, type: 'editor_reasignacion', motivo: 'Solicito revisar mi carga de trabajo' };
    const results = await Promise.all([f.send(body), f.send(body)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await f.list()).total).toBe(1);
  });
  it('devuelta primero, pregunta y respuesta con actores y fecha; reenvío conserva el ID', async () => {
    const f = await scenario(), r = await f.create();
    await decidirRequestEditor(r.id, f.chief, 1, 'return', 'Indica el apartado concreto que debes revisar');
    const before = await obtenerRequestEditorDetalle(r.id, f.editor.id);
    expect(before?.summary).toMatchObject({ status: 'devuelta', version: 2, canRespond: true });
    expect(before?.observations?.[0]).toMatchObject({ askedBy: f.chief.nombre, answer: null });
    expect((await f.list()).items[0]?.id).toBe(r.id);
    const response = await request(app!.server).post(`/api/editores/mis-solicitudes/${r.id}/responder`).set('Cookie', f.cookie).send({ expectedVersion: 2, text: 'El apartado siete necesita un criterio editorial claro.' });
    expect(response.status, response.text).toBe(200);
    const after = await obtenerRequestEditorDetalle(r.id, f.editor.id);
    expect(after?.summary).toMatchObject({ id: r.id, status: 'pendiente', version: 3 });
    expect(after?.description).toBe(r.descripcion);
    expect(after?.observations?.[0]).toMatchObject({ answeredBy: f.editor.nombre, answer: 'El apartado siete necesita un criterio editorial claro.' });
    expect(after?.observations?.[0]?.answeredAt).toBeTruthy();
    expect((await f.list()).total).toBe(1);
  });
  it('lectura no cambia estado ni genera eventos y el historial no se trunca a 20', async () => {
    const f = await scenario(), r = await f.create();
    await db.insert(auditLogs).values(Array.from({ length: 24 }, (_, n) => ({ actorId: f.editor.id, accion: 'EDITOR_REQUEST_REENVIADA', entityType: 'solicitud', entityId: r.id, proyectoId: f.p.id, createdAt: new Date(Date.now() + n * 1000) })));
    const a = await obtenerRequestEditorDetalle(r.id, f.editor.id), b = await obtenerRequestEditorDetalle(r.id, f.editor.id);
    expect(a?.summary.status).toBe('pendiente'); expect(a?.history).toHaveLength(25); expect(b?.history).toEqual(a?.history);
    expect((await f.list()).items[0]?.lastEventLabel).toBe('Solicitud reenviada');
    expect((await f.list()).items[0]?.updatedAt).toBe(a?.history.at(-1)?.at);
  });
  it('resuelta muestra resultado, actor e IDs y rechaza edición/cancelación obsoletas', async () => {
    const f = await scenario(), r = await f.create();
    await decidirRequestEditor(r.id, f.chief, 1, 'resolve', 'Mantén el orden acordado en la reunión editorial.');
    const d = await obtenerRequestEditorDetalle(r.id, f.editor.id);
    expect(d?.summary).toMatchObject({ status: 'resuelta', outcome: 'Mantén el orden acordado en la reunión editorial.', resolvedBy: f.chief.nombre, resultReferences: { projectId: f.p.id, workItemId: f.w.id, resolvedById: f.chief.id } });
    for (const action of ['responder', 'cancelar']) {
      const conflict = await request(app!.server).post(`/api/editores/mis-solicitudes/${r.id}/${action}`).set('Cookie', f.cookie).send({ expectedVersion: 1, text: 'Información enviada desde una sesión obsoleta' });
      expect(conflict.status).toBe(409);
    }
    expect((await request(app!.server).post(`/api/editores/solicitudes-editor/${r.id}/decidir`).set('Cookie', f.cookie).send({ expectedVersion: 2, action: 'resolve', text: 'No debe poder decidir el propio Editor' })).status).toBe(403);
  });
  it('cancelar conserva fila e historial, abandona pendientes e invalida versión', async () => {
    const f = await scenario(), r = await f.create();
    const cancel = () => request(app!.server).post(`/api/editores/mis-solicitudes/${r.id}/cancelar`).set('Cookie', f.cookie).send({ expectedVersion: 1 });
    expect((await cancel()).status).toBe(200); expect((await cancel()).status).toBe(409);
    const [stored] = await db.select().from(solicitudesArea).where(eq(solicitudesArea.id, r.id));
    expect(stored).toMatchObject({ estado: 'cancelada', resolvedById: f.editor.id, version: 2 });
    expect(stored?.resolvedAt).toBeTruthy(); expect((await f.list({}, 'pending')).total).toBe(0);
    expect((await obtenerRequestEditorDetalle(r.id, f.editor.id))?.history.some(h => h.label.includes('canceló'))).toBe(true);
  });
  it('la resolución de reasignación referencia la asignación canónica que realmente se ejecutó', async () => {
    const f = await scenario(), r = await f.create('editor_reasignacion');
    await expect(decidirRequestEditor(r.id, f.chief, 1, 'resolve', 'Solicitud de reasignación atendida.')).rejects.toMatchObject({ statusCode: 409 });
    await asignarEditor(f.p.id, f.other.id, f.chief.id, 'Redistribución solicitada por el Editor');
    await decidirRequestEditor(r.id, f.chief, 1, 'resolve', 'Solicitud de reasignación atendida.');
    const d = await obtenerRequestEditorDetalle(r.id, f.editor.id);
    expect(d?.summary.reassignment).toMatchObject({ previousEditor: f.editor.nombre, nextEditor: f.other.nombre });
    expect(d?.summary.resultReferences?.assignmentId).toBeTruthy();
    const events = await db.select().from(auditLogs).where(eq(auditLogs.entityId, r.id));
    const decision = events.find(e => e.accion === 'EDITOR_REQUEST_RESUELTA');
    expect(decision?.detalles).toMatchObject({ assignmentId: d?.summary.resultReferences?.assignmentId });
    expect(d?.summary.workAccessible).toBe(false);
  });
  it('IDOR: otro Editor no enumera, lee, cancela ni responde una solicitud ajena', async () => {
    const f = await scenario(), r = await f.create(), cookie = await f.login(f.other.email);
    expect((await request(app!.server).get('/api/editores/mis-solicitudes').set('Cookie', cookie)).body.total).toBe(0);
    expect((await request(app!.server).get(`/api/editores/mis-solicitudes/${r.id}`).set('Cookie', cookie)).status).toBe(404);
    for (const action of ['cancelar', 'responder']) expect((await request(app!.server).post(`/api/editores/mis-solicitudes/${r.id}/${action}`).set('Cookie', cookie).send({ expectedVersion: 1, text: 'No debe aceptar información ajena' })).status).toBe(404);
  });
  it('tras reasignar conserva la solicitud propia pero bloquea reenviar sobre trabajo ajeno', async () => {
    const f = await scenario(), r = await f.create();
    await decidirRequestEditor(r.id, f.chief, 1, 'return', 'Explica el motivo de la consulta');
    await asignarEditor(f.p.id, f.other.id, f.chief.id, 'Rotación de la intervención');
    const d = await obtenerRequestEditorDetalle(r.id, f.editor.id);
    expect(d?.summary).toMatchObject({ workAccessible: false, canRespond: false, status: 'devuelta' });
    const response = await request(app!.server).post(`/api/editores/mis-solicitudes/${r.id}/responder`).set('Cookie', f.cookie).send({ expectedVersion: 2, text: 'Intento reenviar desde mi asignación anterior' });
    expect(response.status).toBe(403);
    const created = await crearRequestEditor(f.other.id, f.w.id, 'editor_apoyo', 'Solicitud del nuevo Editor de la intervención');
    expect(created.id).not.toBe(r.id);
  });
  it('filtros de autor/tipo/destino/fecha, conteos globales y paginación en servidor', async () => {
    const f = await scenario(); await db.update(autores).set({ nombre: 'Autor verificable' }).where(eq(autores.id, f.p.autorId));
    const a = await f.create('editor_apoyo'), b = await f.create('editor_aclaracion'), c = await f.create('editor_reasignacion');
    await db.update(solicitudesArea).set({ requestedAt: new Date('2026-10-25T03:59:00Z') }).where(eq(solicitudesArea.id, a.id));
    await db.update(solicitudesArea).set({ requestedAt: new Date('2026-10-25T04:00:00Z') }).where(eq(solicitudesArea.id, b.id));
    await decidirRequestEditor(c.id, f.chief, 1, 'return', 'Explica por qué solicitas cambiar la asignación');
    const page = await f.list({ search: 'Autor verificable' }, 'all', 1, 1);
    expect(page.total).toBe(3); expect(page.items).toHaveLength(1); expect(page.counts).toMatchObject({ all: 3, pending: 2, returned: 1 }); expect(page.items[0]?.id).toBe(c.id);
    expect((await f.list({ search: 'aclaración' })).items.map(i => i.id)).toEqual([b.id]);
    expect((await f.list({ target: 'specialist' })).items.map(i => i.id)).toEqual([b.id]);
    expect((await f.list({ type: 'editor_apoyo', from: '2026-10-25', to: '2026-10-25' })).total).toBe(0);
    expect((await f.list({ type: 'editor_aclaracion', from: '2026-10-25', to: '2026-10-25' })).total).toBe(1);
    expect((await f.list({}, 'all', 9999, 1)).page).toBe(3);
    const invalid = await request(app!.server).get('/api/editores/mis-solicitudes?from=2026-10-26&to=2026-10-20').set('Cookie', f.cookie); expect(invalid.status).toBe(400);
  });
});
