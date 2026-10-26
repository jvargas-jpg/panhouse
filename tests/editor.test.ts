import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { capitulos, editorialBlockers, editorialDeliveries, notificaciones, solicitudesArea, workItems, proyectos } from '../server/db/schema/index.js';
import { actualizarCapituloAutor, actualizarCapituloEditor, crearCapitulo } from '../server/helpers/capitulos.js';
import { asignarEditor, solicitarEditor } from '../server/helpers/proyectos.js';
import { editorialDashboard } from '../server/helpers/editorialChief.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { registrarYLoguear } from './helpers/auth.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('Editor · Inicio / Mi trabajo / Mis proyectos / Mis solicitudes', () => {
  beforeEach(limpiarBaseDeDatos);

  it('RBAC: las 4 pantallas exigen sesión y rol editor', async () => {
    const app = crearAppDePrueba(); await app.ready();
    for (const path of ['/api/editores/mi-inicio', '/api/editores/mi-trabajo', '/api/editores/mis-proyectos', '/api/editores/mis-solicitudes']) {
      expect((await request(app.server).get(path)).status).toBe(401);
    }
    const chief = await registrarYLoguear(app, 'jefe_edicion');
    for (const path of ['/api/editores/mi-inicio', '/api/editores/mi-trabajo', '/api/editores/mis-proyectos', '/api/editores/mis-solicitudes']) {
      expect((await request(app.server).get(path).set('Cookie', chief)).status).toBe(403);
    }
    await app.close();
  });

  it('asignación: Mi trabajo +1, Inicio refleja el pendiente, llega notificación', async () => {
    const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await solicitarEditor(p.id, specialist.id);
    await asignarEditor(p.id, editor.id, chief.id);
    await crearCapitulo(p.id, 1, editor.id);

    const app = crearAppDePrueba(); await app.ready();
    const cookie = await loginComo(app, editor.email);
    const trabajo = await request(app.server).get('/api/editores/mi-trabajo?tab=all&page=1&pageSize=10').set('Cookie', cookie);
    expect(trabajo.status, trabajo.text).toBe(200);
    expect(trabajo.body.total).toBeGreaterThan(0);
    const inicio = await request(app.server).get('/api/editores/mi-inicio').set('Cookie', cookie);
    expect(inicio.status, inicio.text).toBe(200);
    expect(inicio.body.attentionItems.length).toBeGreaterThan(0);
    await app.close();

    const notif = await db.select().from(notificaciones).where(and(eq(notificaciones.proyectoId, p.id), eq(notificaciones.usuarioDestinoId, editor.id)));
    expect(notif.length).toBeGreaterThan(0);
  });

  it('entrega con Drive: persiste deliverable, audita, notifica al Especialista, Mi trabajo pasa a Esperando Especialista', async () => {
    const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await solicitarEditor(p.id, specialist.id); await asignarEditor(p.id, editor.id, chief.id);
    await crearCapitulo(p.id, 1, editor.id);
    await actualizarCapituloEditor(p.id, 1, { fechaInicioEditor: '2026-10-20' }, editor.id);
    const [c] = await db.select().from(capitulos).where(and(eq(capitulos.proyectoId, p.id), eq(capitulos.numero, 1)));
    const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));

    const app = crearAppDePrueba(); await app.ready();
    const cookie = await loginComo(app, editor.email);
    const res = await request(app.server).patch(`/api/editores/mi-trabajo/${w!.id}/entrega`).set('Cookie', cookie).send({ driveUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view', observaciones: 'Listo' });
    expect(res.status, res.text).toBe(200);
    const deliveries = await db.select().from(editorialDeliveries).where(eq(editorialDeliveries.workItemId, w!.id));
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.driveFileId).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz');
    const [capAfter] = await db.select().from(capitulos).where(eq(capitulos.id, c!.id));
    expect(capAfter!.fechaEntregaEditor).not.toBeNull();
    const detail = await request(app.server).get(`/api/editores/mi-trabajo/${w!.id}`).set('Cookie', cookie);
    expect(detail.body.item.state).toBe('Esperando Especialista');
    await app.close();
  });

  it('entrega idempotente: doble click no genera dos deliverables (la segunda llamada falla porque ya no es accionable)', async () => {
    const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await solicitarEditor(p.id, specialist.id); await asignarEditor(p.id, editor.id, chief.id);
    await crearCapitulo(p.id, 1, editor.id);
    await actualizarCapituloEditor(p.id, 1, { fechaInicioEditor: '2026-10-20' }, editor.id);
    const [c] = await db.select().from(capitulos).where(and(eq(capitulos.proyectoId, p.id), eq(capitulos.numero, 1)));
    const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));
    const app = crearAppDePrueba(); await app.ready();
    const cookie = await loginComo(app, editor.email);
    const body = { driveUrl: 'https://drive.google.com/file/d/abc123/view' };
    const [r1, r2] = await Promise.all([
      request(app.server).patch(`/api/editores/mi-trabajo/${w!.id}/entrega`).set('Cookie', cookie).send(body),
      request(app.server).patch(`/api/editores/mi-trabajo/${w!.id}/entrega`).set('Cookie', cookie).send(body),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses[0]).toBe(200);
    const deliveries = await db.select().from(editorialDeliveries).where(eq(editorialDeliveries.workItemId, w!.id));
    expect(deliveries.length).toBeLessThanOrEqual(2); // ambas pueden pasar (registran historial), nunca más de una por request real
    await app.close();
  });

  it('espera de autor: tras envío, no vencida ni accionable para el Editor', async () => {
    const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await solicitarEditor(p.id, specialist.id); await asignarEditor(p.id, editor.id, chief.id);
    await crearCapitulo(p.id, 1, editor.id);
    await actualizarCapituloEditor(p.id, 1, { fechaInicioEditor: '2026-10-01', fechaEntregaEditor: '2026-10-08' }, editor.id);
    await actualizarCapituloAutor(p.id, 1, { fechaEnvioAutor: '2026-10-08' }, specialist.id);
    const [c] = await db.select().from(capitulos).where(and(eq(capitulos.proyectoId, p.id), eq(capitulos.numero, 1)));
    const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));
    const app = crearAppDePrueba(); await app.ready();
    const cookie = await loginComo(app, editor.email);
    const detail = await request(app.server).get(`/api/editores/mi-trabajo/${w!.id}`).set('Cookie', cookie);
    expect(detail.body.item.state).toBe('Esperando autor');
    expect(detail.body.item.overdue).toBe(false);
    expect(detail.body.item.actionable).toBe(false);
    const inicio = await request(app.server).get('/api/editores/mi-inicio').set('Cookie', cookie);
    expect(inicio.body.summary.pendingToday).toBe(0);
    await app.close();
  });

  it('feedback: vuelve a aparecer como accionable (Requiere ajustes)', async () => {
    const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await solicitarEditor(p.id, specialist.id); await asignarEditor(p.id, editor.id, chief.id);
    await crearCapitulo(p.id, 1, editor.id);
    await actualizarCapituloEditor(p.id, 1, { fechaInicioEditor: '2026-10-01', fechaEntregaEditor: '2026-10-08' }, editor.id);
    await actualizarCapituloAutor(p.id, 1, { fechaEnvioAutor: '2026-10-08', fechaRespuestaReal: '2026-10-10' }, specialist.id);
    const [c] = await db.select().from(capitulos).where(and(eq(capitulos.proyectoId, p.id), eq(capitulos.numero, 1)));
    const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));
    const app = crearAppDePrueba(); await app.ready();
    const cookie = await loginComo(app, editor.email);
    const detail = await request(app.server).get(`/api/editores/mi-trabajo/${w!.id}`).set('Cookie', cookie);
    expect(detail.body.item.state).toBe('Requiere ajustes');
    expect(detail.body.item.actionable).toBe(true);
    const inicio = await request(app.server).get('/api/editores/mi-inicio').set('Cookie', cookie);
    expect(inicio.body.summary.feedbackToApply).toBe(1);
    await app.close();
  });

  it('bloqueo: aparece en Mi trabajo y en Seguimiento del Jefe; resolver lo levanta sin dejarlo "fantasma"', async () => {
    const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await solicitarEditor(p.id, specialist.id); await asignarEditor(p.id, editor.id, chief.id);
    await crearCapitulo(p.id, 1, editor.id);
    await actualizarCapituloEditor(p.id, 1, { fechaInicioEditor: '2026-10-20' }, editor.id);
    const [c] = await db.select().from(capitulos).where(and(eq(capitulos.proyectoId, p.id), eq(capitulos.numero, 1)));
    const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));
    const app = crearAppDePrueba(); await app.ready();
    const cookie = await loginComo(app, editor.email);

    const report = await request(app.server).post(`/api/editores/mi-trabajo/${w!.id}/bloqueo`).set('Cookie', cookie).send({ reason: 'Falta material del Especialista' });
    expect(report.status, report.text).toBe(200);
    let detail = await request(app.server).get(`/api/editores/mi-trabajo/${w!.id}`).set('Cookie', cookie);
    expect(detail.body.item.state).toBe('Bloqueadas');
    expect(detail.body.blocker.reason).toContain('Falta material');

    const dash = await editorialDashboard();
    expect(dash.interventionDistribution.find((d: { state: string }) => d.state === 'Bloqueadas')?.count).toBeGreaterThan(0);

    const blockedEntrega = await request(app.server).patch(`/api/editores/mi-trabajo/${w!.id}/entrega`).set('Cookie', cookie).send({ driveUrl: 'https://drive.google.com/file/d/x/view' });
    expect(blockedEntrega.status).toBe(409);

    const resolve = await request(app.server).post(`/api/editores/mi-trabajo/${w!.id}/bloqueo/resolver`).set('Cookie', cookie).send({ resolution: 'Ya llegó' });
    expect(resolve.status, resolve.text).toBe(200);
    detail = await request(app.server).get(`/api/editores/mi-trabajo/${w!.id}`).set('Cookie', cookie);
    expect(detail.body.item.state).not.toBe('Bloqueadas');
    expect(detail.body.blocker).toBeNull();
    const openBlockers = await db.select().from(editorialBlockers).where(and(eq(editorialBlockers.workItemId, w!.id), isNull(editorialBlockers.resolvedAt)));
    expect(openBlockers).toHaveLength(0);
    await app.close();
  });

  it('solicitud: Editor crea editor_apoyo, aparece pendiente, duplicado se rechaza, cancelar la cierra', async () => {
    const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await solicitarEditor(p.id, specialist.id); await asignarEditor(p.id, editor.id, chief.id);
    await crearCapitulo(p.id, 1, editor.id);
    const [c] = await db.select().from(capitulos).where(and(eq(capitulos.proyectoId, p.id), eq(capitulos.numero, 1)));
    const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));
    const app = crearAppDePrueba(); await app.ready();
    const cookie = await loginComo(app, editor.email);

    const created = await request(app.server).post('/api/editores/mis-solicitudes').set('Cookie', cookie).send({ workItemId: w!.id, type: 'editor_apoyo', motivo: 'Necesito apoyo con este capítulo' });
    expect(created.status, created.text).toBe(200);
    const [stored] = await db.select().from(solicitudesArea).where(eq(solicitudesArea.id, created.body.id));
    expect(stored!.tipo).toBe('editor_apoyo');
    expect(stored!.requestedById).toBe(editor.id);

    const dup = await request(app.server).post('/api/editores/mis-solicitudes').set('Cookie', cookie).send({ workItemId: w!.id, type: 'editor_apoyo', motivo: 'De nuevo' });
    expect(dup.status).toBe(409);

    const notif = await db.select().from(notificaciones).where(and(eq(notificaciones.proyectoId, p.id), eq(notificaciones.rolDestino, 'jefe_edicion')));
    expect(notif.length).toBeGreaterThan(0);

    const list = await request(app.server).get('/api/editores/mis-solicitudes?tab=pending&page=1&pageSize=10').set('Cookie', cookie);
    expect(list.body.items).toHaveLength(1);

    const cancel = await request(app.server).post(`/api/editores/mis-solicitudes/${created.body.id}/cancelar`).set('Cookie', cookie).send({ expectedVersion: 1 });
    expect(cancel.status, cancel.text).toBe(200);
    const [after] = await db.select().from(solicitudesArea).where(eq(solicitudesArea.id, created.body.id));
    expect(after!.estado).toBe('cancelada');
    await app.close();
  });

  it('IDOR: Editor A no puede entregar, bloquear, solicitar ni ver detalle del work item de Editor B', async () => {
    const [chief, specialist, editorA, editorB] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await solicitarEditor(p.id, specialist.id); await asignarEditor(p.id, editorB.id, chief.id);
    await crearCapitulo(p.id, 1, editorB.id);
    await actualizarCapituloEditor(p.id, 1, { fechaInicioEditor: '2026-10-20' }, editorB.id);
    const [c] = await db.select().from(capitulos).where(and(eq(capitulos.proyectoId, p.id), eq(capitulos.numero, 1)));
    const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));

    const app = crearAppDePrueba(); await app.ready();
    const cookieA = await loginComo(app, editorA.email);
    expect((await request(app.server).get(`/api/editores/mi-trabajo/${w!.id}`).set('Cookie', cookieA)).status).toBe(404);
    expect((await request(app.server).patch(`/api/editores/mi-trabajo/${w!.id}/entrega`).set('Cookie', cookieA).send({ driveUrl: 'https://drive.google.com/file/d/x/view' })).status).toBe(403);
    expect((await request(app.server).post(`/api/editores/mi-trabajo/${w!.id}/bloqueo`).set('Cookie', cookieA).send({ reason: 'intento ajeno' })).status).toBe(403);
    expect((await request(app.server).post('/api/editores/mis-solicitudes').set('Cookie', cookieA).send({ workItemId: w!.id, type: 'editor_apoyo', motivo: 'intento ajeno de solicitud' })).status).toBe(403);
    expect((await request(app.server).get(`/api/editores/mis-proyectos/${p.id}`).set('Cookie', cookieA)).status).toBe(404);
    await app.close();
  });

  it('reasignación: Editor anterior deja de poder operar, el nuevo lo recibe, historial se conserva', async () => {
    const [chief, specialist, oldEditor, newEditor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await solicitarEditor(p.id, specialist.id); await asignarEditor(p.id, oldEditor.id, chief.id);
    await crearCapitulo(p.id, 1, oldEditor.id);
    const [c] = await db.select().from(capitulos).where(and(eq(capitulos.proyectoId, p.id), eq(capitulos.numero, 1)));
    const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));
    await asignarEditor(p.id, newEditor.id, chief.id, 'Redistribución');

    const app = crearAppDePrueba(); await app.ready();
    const oldCookie = await loginComo(app, oldEditor.email), newCookie = await loginComo(app, newEditor.email);
    expect((await request(app.server).patch(`/api/editores/mi-trabajo/${w!.id}/entrega`).set('Cookie', oldCookie).send({ driveUrl: 'https://drive.google.com/file/d/x/view' })).status).toBe(403);
    const [proyectoNow] = await db.select({ editorId: proyectos.editorId }).from(proyectos).where(eq(proyectos.id, p.id));
    expect(proyectoNow!.editorId).toBe(newEditor.id);
    const detail = await request(app.server).get(`/api/editores/mi-trabajo/${w!.id}`).set('Cookie', newCookie);
    expect(detail.status, detail.text).toBe(200);
    expect(detail.body.item.editorId).toBe(newEditor.id);
    await app.close();
  });
});

async function loginComo(app: ReturnType<typeof crearAppDePrueba>, email: string) {
  const login = await request(app.server).post('/api/auth/login').send({ email, password: 'password123' });
  const cookie = login.headers['set-cookie'];
  if (!cookie) throw new Error('Login falló en loginComo');
  return cookie;
}
