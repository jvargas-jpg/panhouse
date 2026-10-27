import * as chapterCommands from '../server/helpers/capitulos.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { capitulos, editorialBlockers, editorialDeliveries, notificaciones, solicitudesArea, workItems, proyectos, auditLogs, projectDriveWorkspaces, projectDriveFolders } from '../server/db/schema/index.js';
import { actualizarCapituloAutor, actualizarCapituloEditor, crearCapitulo } from '../server/helpers/capitulos.js';
import { asignarEditor, solicitarEditor } from '../server/helpers/proyectos.js';
import { editorialDashboard } from '../server/helpers/editorialChief.js';
import { completarPreparacionDePrueba, crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { registrarYLoguear } from './helpers/auth.js';
import { crearAppDePrueba } from './helpers/testApp.js';

// Only Google is replaced; commands, transactions, auth and projections use PostgreSQL.
const driveControl=vi.hoisted(()=>({uploads:0,lastMime:'',lastParent:'',deleted:[] as string[],beforeUpload:undefined as undefined|(()=>Promise<void>),metadataCalls:0,beforeRead:undefined as undefined|(()=>Promise<void>)}));
vi.mock('../server/modules/integrations/google-drive/corporate.js',()=>({withCorporateDrive:async(work:any)=>{
  const {db}=await import('../server/db/client.js');const {externalIntegrations,projectDriveWorkspaces}=await import('../server/db/schema/index.js');
  const [integration]=await db.select().from(externalIntegrations);const [workspace]=await db.select().from(projectDriveWorkspaces);
  return work({integration,storage:{getMetadata:async(id:string)=>{driveControl.metadataCalls++;
    if(driveControl.beforeRead){const next=driveControl.beforeRead;driveControl.beforeRead=undefined;await next();}
    if(id==='inaccessible-file')throw Object.assign(new Error('Archivo no accesible'),{statusCode:404});
    return {providerFileId:id,name:'Entrega de prueba.docx',mimeType:id==='folder-file'?'application/vnd.google-apps.folder':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',parents:id==='outside-file'?['unrelated-parent']:id==='unrelated-parent'?[]:[workspace!.rootFolderId],webViewLink:null,appProperties:{}};
  },deleteFileOrFolder:async(id:string)=>{driveControl.deleted.push(id);},uploadFile:async(input:any)=>{driveControl.uploads++;driveControl.lastMime=input.mimeType;driveControl.lastParent=input.parentFolderId;if(driveControl.beforeUpload)await driveControl.beforeUpload();return {providerFileId:'uploaded-file',name:input.name,mimeType:input.mimeType,parents:[input.parentFolderId],webViewLink:null,appProperties:{}};},listFiles:async()=>({items:[],nextPageToken:null})}});
}}));

describe('Editor · Inicio / Mi trabajo / Mis proyectos / Mis solicitudes', () => {
  beforeEach(async()=>{driveControl.beforeRead=undefined;driveControl.beforeUpload=undefined;driveControl.metadataCalls=0;driveControl.uploads=0;driveControl.deleted=[];await limpiarBaseDeDatos();});

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
    await completarPreparacionDePrueba(p.id);
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
    await completarPreparacionDePrueba(p.id);
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
    const list = await request(app.server).get('/api/editores/mi-trabajo?tab=all&search=&page=1&pageSize=10').set('Cookie', cookie);
    const row = list.body.items.find((i: { id: string }) => i.id === w!.id);
    expect(row.lastActivity?.label).toBe('Editor registró una entrega');
    await app.close();
  });

  it('entrega idempotente: dos llamadas concurrentes devuelven la misma entrega y una sola auditoría', async () => {
    const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await completarPreparacionDePrueba(p.id);
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
    expect(statuses).toEqual([200,200]);
    expect(r1.body.deliveryId).toBe(r2.body.deliveryId);
    const deliveries = await db.select().from(editorialDeliveries).where(eq(editorialDeliveries.workItemId, w!.id));
    expect(deliveries).toHaveLength(1);
    const events=await db.select().from(auditLogs).where(and(eq(auditLogs.entityId,w!.id),eq(auditLogs.accion,'EDITOR_ENTREGA_REGISTRADA')));
    expect(events).toHaveLength(1);
    await app.close();
  });

  it('espera de autor: tras envío, no vencida ni accionable para el Editor', async () => {
    const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await completarPreparacionDePrueba(p.id);
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
    await completarPreparacionDePrueba(p.id);
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
    await completarPreparacionDePrueba(p.id);
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
    await completarPreparacionDePrueba(p.id);
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
    await completarPreparacionDePrueba(p.id);
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
    expect((await request(app.server).get(`/api/editores/mi-trabajo?project=${p.id}`).set('Cookie', cookieA)).body.total).toBe(0);
    expect((await request(app.server).post(`/api/editores/mi-trabajo/${w!.id}/iniciar`).set('Cookie', cookieA).send({})).status).toBe(403);
    expect((await request(app.server).get(`/api/editores/mi-trabajo/${w!.id}/archivos?folderKey=EDITING_OUTPUT`).set('Cookie', cookieA)).status).toBe(403);
    const cookieB=await loginComo(app,editorB.email);
    const ownRequest=await request(app.server).post('/api/editores/mis-solicitudes').set('Cookie',cookieB).send({workItemId:w!.id,type:'editor_apoyo',motivo:'Solicitud propia del Editor B'});
    expect(ownRequest.status,ownRequest.text).toBe(200);
    expect((await request(app.server).get(`/api/editores/mis-solicitudes/${ownRequest.body.id}`).set('Cookie',cookieA)).status).toBe(404);
    expect((await request(app.server).post(`/api/editores/mis-solicitudes/${ownRequest.body.id}/cancelar`).set('Cookie',cookieA).send({expectedVersion:1})).status).toBe(404);
    await app.close();
  });

  it('reasignación: Editor anterior deja de poder operar, el nuevo lo recibe, historial se conserva', async () => {
    const [chief, specialist, oldEditor, newEditor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor'), crearUsuario('editor')]);
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await completarPreparacionDePrueba(p.id);
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
    expect(detail.body.history.some((h:any)=>h.label==='Editor asignado')).toBe(true);
    expect(detail.body.history.some((h:any)=>h.label==='Editor reasignado · Redistribución')).toBe(true);
    expect(detail.status, detail.text).toBe(200);
    expect(detail.body.item.editorId).toBe(newEditor.id);
    await app.close();
  });
  it('abrir no inicia; iniciar capítulo calcula su SLA central y registrar avance conserva observaciones en auditoría',async()=>{
    const f=await scenario();
    const before=await request(f.app.server).get(`/api/editores/mi-trabajo/${f.w.id}`).set('Cookie',f.cookie);
    expect(before.body.item.startedAt).toBeNull();
    expect((await request(f.app.server).post(`/api/editores/mi-trabajo/${f.w.id}/iniciar`).set('Cookie',f.cookie).send({})).status).toBe(200);
    const started=await request(f.app.server).get(`/api/editores/mi-trabajo/${f.w.id}`).set('Cookie',f.cookie);
    expect(started.body.item.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);expect(started.body.item.dueDate).not.toBeNull();
    const progress=await request(f.app.server).post(`/api/editores/mi-trabajo/${f.w.id}/avance`).set('Cookie',f.cookie).send({note:'Estructura revisada y observaciones del autor contrastadas'});
    expect(progress.status,progress.text).toBe(200);
    const after=await request(f.app.server).get(`/api/editores/mi-trabajo/${f.w.id}`).set('Cookie',f.cookie);
    expect(after.body.history.some((h:any)=>h.label.includes('Estructura revisada'))).toBe(true);
    await f.app.close();
  });

  it('Drive rechaza enlaces externos, carpetas, archivos de otro workspace y archivos inaccesibles sin registrar entrega',async()=>{
    const f=await scenario();
    for(const [url,code] of [['https://example.com/file/d/valid-file/view',400],['https://drive.google.com/drive/folders/folder-file',400],['https://drive.google.com/file/d/folder-file/view',400],['https://drive.google.com/file/d/outside-file/view',403],['https://drive.google.com/file/d/inaccessible-file/view',404]] as const){
      const r=await request(f.app.server).patch(`/api/editores/mi-trabajo/${f.w.id}/entrega`).set('Cookie',f.cookie).send({driveUrl:url});expect(r.status,r.text).toBe(code);
    }
    expect(await db.select().from(editorialDeliveries)).toHaveLength(0);
    const [chapter]=await db.select().from(capitulos).where(eq(capitulos.id,f.c.id));expect(chapter!.fechaEntregaEditor).toBeNull();
    const docs=await request(f.app.server).patch(`/api/editores/mi-trabajo/${f.w.id}/entrega`).set('Cookie',f.cookie).send({driveUrl:'https://docs.google.com/document/d/valid-document/edit'});expect(docs.status,docs.text).toBe(200);
    await f.app.close();
  });

  it('reasignación durante validación Drive se revalida dentro de la transacción y no deja deliverable huérfano',async()=>{
    const f=await scenario();const next=await crearUsuario('editor');
    driveControl.beforeRead=()=>asignarEditor(f.p.id,next.id,f.chief.id,'Redistribución durante validación');
    const r=await request(f.app.server).patch(`/api/editores/mi-trabajo/${f.w.id}/entrega`).set('Cookie',f.cookie).send({driveUrl:'https://drive.google.com/file/d/valid-file/view'});
    expect(r.status,r.text).toBe(403);expect(await db.select().from(editorialDeliveries)).toHaveLength(0);
    await f.app.close();
  });

  it('solicitudes: aparece en inbox del jefe, devolución, respuesta, revisión, resolución y notificación contextual',async()=>{
    const f=await scenario();const chiefCookie=await loginComo(f.app,f.chief.email);
    const created=await request(f.app.server).post('/api/editores/mis-solicitudes').set('Cookie',f.cookie).send({workItemId:f.w.id,type:'editor_apoyo',motivo:'Necesito criterio de estructura para continuar'});
    expect(created.status,created.text).toBe(200);const id=created.body.id;
    const inbox=await request(f.app.server).get('/api/editores/solicitudes?tab=pending').set('Cookie',chiefCookie);
    expect(inbox.status,inbox.text).toBe(200);expect(inbox.body.items.some((r:any)=>r.id===id&&r.requestType==='editor_apoyo')).toBe(true);
    const decide=(version:number,action:string,text:string)=>request(f.app.server).post(`/api/editores/solicitudes-editor/${id}/decidir`).set('Cookie',chiefCookie).send({expectedVersion:version,action,text});
    expect((await decide(1,'return','Indica el capítulo y el criterio pendiente')).status).toBe(200);
    const response=await request(f.app.server).post(`/api/editores/mis-solicitudes/${id}/responder`).set('Cookie',f.cookie).send({expectedVersion:2,text:'Capítulo uno, necesitamos validar el enfoque narrativo'});expect(response.status,response.text).toBe(200);
    expect((await decide(2,'resolve','Respuesta con versión antigua')).status).toBe(409);
    expect((await decide(3,'review','Revisando el enfoque con el Especialista')).status).toBe(200);
    expect((await decide(4,'resolve','Mantener el enfoque narrativo del autor')).status).toBe(200);
    const detail=await request(f.app.server).get(`/api/editores/mis-solicitudes/${id}`).set('Cookie',f.cookie);
    expect(detail.body.summary.status).toBe('resuelta');expect(detail.body.summary.outcome).toContain('enfoque narrativo');expect(detail.body.observations[0].answer).toContain('Capítulo uno');
    const notices=await db.select().from(notificaciones).where(eq(notificaciones.usuarioDestinoId,f.editor.id));expect(notices.some(n=>n.targetPath===`/?vista=mis-solicitudes&request=${id}`)).toBe(true);
    await f.app.close();
  });

  it('aclaración: solo el Especialista actual puede responder; no rompe la outbox del Especialista',async()=>{
    const f=await scenario();const foreign=await crearUsuario('especialista');const own=await loginComo(f.app,f.specialist.email),other=await loginComo(f.app,foreign.email);
    const created=await request(f.app.server).post('/api/editores/mis-solicitudes').set('Cookie',f.cookie).send({workItemId:f.w.id,type:'editor_aclaracion',motivo:'Aclara cuál es el material de referencia'});expect(created.status,created.text).toBe(200);
    const inbox=await request(f.app.server).get('/api/editores/aclaraciones-recibidas').set('Cookie',own);expect(inbox.body.items).toHaveLength(1);
    expect((await request(f.app.server).get('/api/editores/aclaraciones-recibidas').set('Cookie',other)).body.items).toHaveLength(0);
    const decide=(cookie:string)=>request(f.app.server).post(`/api/editores/solicitudes-editor/${created.body.id}/decidir`).set('Cookie',cookie).send({expectedVersion:1,action:'resolve',text:'El material está en la carpeta de entrada del proyecto'});
    expect((await decide(other)).status).toBe(403);expect((await decide(own)).status).toBe(200);
    const outbox=await request(f.app.server).get('/api/especialistas/solicitudes').set('Cookie',own);expect(outbox.status,outbox.text).toBe(200);
    await f.app.close();
  });

  it('un proyecto con tres capítulos tiene tres work items, una card y filtros propios sin exponer otros Editores',async()=>{
    const f=await scenario();await crearCapitulo(f.p.id,2,f.editor.id);await crearCapitulo(f.p.id,3,f.editor.id);
    const other=await crearUsuario('editor');const otherProject=await crearProyectoDePrueba({especialistaId:f.specialist.id});await solicitarEditor(otherProject.id,f.specialist.id);await asignarEditor(otherProject.id,other.id,f.chief.id);
    const work=await request(f.app.server).get('/api/editores/mi-trabajo').set('Cookie',f.cookie);expect(work.body.total).toBe(3);
    const projects=await request(f.app.server).get('/api/editores/mis-proyectos').set('Cookie',f.cookie);expect(projects.status,projects.text).toBe(200);expect(projects.body.items).toHaveLength(1);expect(projects.body.items[0].progress).toBeNull();expect(projects.body.options.editors.every((e:any)=>e.id===f.editor.id)).toBe(true);
    const filtered=await request(f.app.server).get('/api/editores/mi-trabajo?interventionType=feedback').set('Cookie',f.cookie);expect(filtered.body.total).toBe(0);
    await f.app.close();
  });

  it('Mi trabajo cuenta pendientes y bloqueadas antes de paginar, ordena y filtra en servidor',async()=>{
    const f=await scenario();
    try {
      for(let n=2;n<=12;n++)await crearCapitulo(f.p.id,n,f.editor.id);
      const list=(query:string)=>request(f.app.server).get('/api/editores/mi-trabajo?'+query).set('Cookie',f.cookie);
      expect((await request(f.app.server).post(`/api/editores/mi-trabajo/${f.w.id}/iniciar`).set('Cookie',f.cookie).send({})).status).toBe(200);
      let all=await list('pageSize=10');expect(all.status,all.text).toBe(200);expect(all.body.items).toHaveLength(10);expect(all.body.total).toBe(12);
      const blockId=all.body.items.find((i:any)=>i.id!==f.w.id).id;
      expect((await request(f.app.server).post(`/api/editores/mi-trabajo/${blockId}/bloqueo`).set('Cookie',f.cookie).send({reason:'Falta material para continuar'})).status).toBe(200);
      all=await list('pageSize=10&page=2');expect(all.body.items).toHaveLength(2);expect(all.body.counts).toMatchObject({all:12,pending:10,inProgress:1,blocked:1});
      const pending=await list('tab=pending&pageSize=10');expect(pending.body.total).toBe(10);expect(pending.body.items.every((i:any)=>!i.startedAt&&i.state!=='Bloqueadas')).toBe(true);
      const blocked=await list('tab=blocked');expect(blocked.body.items.map((i:any)=>i.id)).toEqual([blockId]);
      const due=await list('sort=due');expect(due.body.items[0].id).toBe(f.w.id);
      const filtered=await list('search='+encodeURIComponent('Capítulo 12'));expect(filtered.body.total).toBe(1);expect(filtered.body.items[0].label).toBe('Capítulo 12');
      expect((await list('sort=unsupported')).status).toBe(400);
      expect((await list('pageSize=5')).status).toBe(400);
      expect(driveControl.metadataCalls).toBe(0);
    } finally { await f.app.close(); }
  });

  it('el feedback del historial no desaparece después de ocho avances de la misma intervención',async()=>{
    const f=await scenario();
    try {
      await actualizarCapituloEditor(f.p.id,1,{fechaInicioEditor:'2026-10-01',fechaEntregaEditor:'2026-10-02'},f.editor.id);
      await actualizarCapituloAutor(f.p.id,1,{fechaEnvioAutor:'2026-10-02',fechaRespuestaReal:'2026-10-05'},f.specialist.id);
      for(let n=0;n<9;n++)expect((await request(f.app.server).post(`/api/editores/mi-trabajo/${f.w.id}/avance`).set('Cookie',f.cookie).send({note:'Avance posterior al feedback '+n})).status).toBe(200);
      const detail=await request(f.app.server).get(`/api/editores/mi-trabajo/${f.w.id}`).set('Cookie',f.cookie);
      expect(detail.status,detail.text).toBe(200);expect(detail.body.history.length).toBeGreaterThan(8);
      expect(detail.body.history.some((h:any)=>h.label==='Feedback del autor registrado')).toBe(true);
      expect(detail.body.slaLabel).toBeNull();expect(driveControl.metadataCalls).toBe(0);
    } finally { await f.app.close(); }
  });

  it('participación histórica conserva contexto y pierde material y escritura tras reasignar',async()=>{
    const f=await scenario();const next=await crearUsuario('editor');await asignarEditor(f.p.id,next.id,f.chief.id,'Rotación de carga');
    const active=await request(f.app.server).get('/api/editores/mis-proyectos').set('Cookie',f.cookie);expect(active.body.items).toHaveLength(0);
    const history=await request(f.app.server).get('/api/editores/mis-proyectos?participation=history').set('Cookie',f.cookie);expect(history.body.items).toHaveLength(1);
    const detail=await request(f.app.server).get(`/api/editores/mis-proyectos/${f.p.id}`).set('Cookie',f.cookie);expect(detail.status,detail.text).toBe(200);expect(detail.body.drive.rootUrl).toBeNull();expect(detail.body.interventions).toHaveLength(0);
    await f.app.close();
  });

  it('listas y detalle no llaman Drive; selector autoriza folderKey y usa IDs persistidos de una plantilla legacy',async()=>{
    const f=await scenario();const [ws]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,f.p.id));
    await db.update(projectDriveWorkspaces).set({templateVersion:'legacy-v1'}).where(eq(projectDriveWorkspaces.id,ws!.id));
    await db.insert(projectDriveFolders).values({workspaceId:ws!.id,key:'EDITING_OUTPUT',driveFolderId:'legacy-editing-folder',displayName:'Carpeta antigua',templatePath:'/estructura-anterior',status:'READY',driveUrl:'https://drive.google.com/drive/folders/legacy-editing-folder'});
    for(const path of ['/api/editores/mi-inicio','/api/editores/mi-trabajo','/api/editores/mis-proyectos',`/api/editores/mi-trabajo/${f.w.id}`])expect((await request(f.app.server).get(path).set('Cookie',f.cookie)).status).toBe(200);
    expect(driveControl.metadataCalls).toBe(0);
    const detail=await request(f.app.server).get(`/api/editores/mi-trabajo/${f.w.id}`).set('Cookie',f.cookie);expect(detail.body.folders.some((v:any)=>v.driveUrl.includes('legacy-editing-folder'))).toBe(true);
    expect((await request(f.app.server).get(`/api/editores/mi-trabajo/${f.w.id}/archivos?folderKey=ROOT`).set('Cookie',f.cookie)).status).toBe(403);
    expect((await request(f.app.server).get(`/api/editores/mi-trabajo/${f.w.id}/archivos?folderKey=EDITING_OUTPUT`).set('Cookie',f.cookie)).status).toBe(200);
    const [after]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.id,ws!.id));expect(after!.templateVersion).toBe('legacy-v1');
    await f.app.close();
  });

  it('entrega atómica: un fallo de transición revierte deliverable, capítulo, auditoría y aviso',async()=>{
    const f=await scenario();const command=vi.spyOn(chapterCommands,'actualizarCapituloEditor').mockRejectedValueOnce(new Error('QA transition failure'));
    try{
      const r=await request(f.app.server).patch(`/api/editores/mi-trabajo/${f.w.id}/entrega`).set('Cookie',f.cookie).send({driveUrl:'https://drive.google.com/file/d/valid-file/view'});
      expect(r.status).toBe(500);expect(await db.select().from(editorialDeliveries)).toHaveLength(0);
      const [chapter]=await db.select().from(capitulos).where(eq(capitulos.id,f.c.id));expect(chapter!.fechaEntregaEditor).toBeNull();
      const events=await db.select().from(auditLogs).where(eq(auditLogs.accion,'EDITOR_ENTREGA_REGISTRADA'));expect(events).toHaveLength(0);
    }finally{command.mockRestore();await f.app.close();}
  });

  it('carga documental usa la carpeta persistida, fija MIME por extensión y no registra entrega hasta confirmarla',async()=>{
    const f=await scenario();const [ws]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,f.p.id));
    await db.insert(projectDriveFolders).values({workspaceId:ws!.id,key:'EDITING_OUTPUT',driveFolderId:'legacy-output-id',displayName:'Salida histórica',templatePath:'/ruta-anterior',status:'READY',driveUrl:'https://drive.google.com/drive/folders/legacy-output-id'});
    const input={folderKey:'EDITING_OUTPUT',name:'Capitulo.pdf',mimeType:'application/vnd.google-apps.folder',contentBase64:Buffer.from('Documento de prueba').toString('base64')};
    const invalid=await request(f.app.server).post(`/api/editores/mi-trabajo/${f.w.id}/archivos`).set('Cookie',f.cookie).send({...input,folderKey:'ROOT'});expect(invalid.status).toBe(403);expect(driveControl.uploads).toBe(0);
    const result=await request(f.app.server).post(`/api/editores/mi-trabajo/${f.w.id}/archivos`).set('Cookie',f.cookie).send(input);expect(result.status,result.text).toBe(200);expect(driveControl.lastMime).toBe('application/pdf');expect(driveControl.lastParent).toBe('legacy-output-id');expect(await db.select().from(editorialDeliveries)).toHaveLength(0);
    const deliver=await request(f.app.server).patch(`/api/editores/mi-trabajo/${f.w.id}/entrega`).set('Cookie',f.cookie).send({driveUrl:result.body.url});expect(deliver.status,deliver.text).toBe(200);expect(driveControl.uploads).toBe(1);
    await f.app.close();
  });

  it('una reasignación durante carga elimina solo el archivo recién creado y rechaza al Editor anterior',async()=>{
    const f=await scenario();const [ws]=await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId,f.p.id));
    await db.insert(projectDriveFolders).values({workspaceId:ws!.id,key:'EDITING_OUTPUT',driveFolderId:'output-id',displayName:'Salida',templatePath:'/salida',status:'READY',driveUrl:'https://drive.google.com/drive/folders/output-id'});
    const next=await crearUsuario('editor');driveControl.beforeUpload=()=>asignarEditor(f.p.id,next.id,f.chief.id,'Redistribución durante carga');
    const r=await request(f.app.server).post(`/api/editores/mi-trabajo/${f.w.id}/archivos`).set('Cookie',f.cookie).send({folderKey:'EDITING_OUTPUT',name:'Capitulo.pdf',mimeType:'application/pdf',contentBase64:Buffer.from('Documento').toString('base64')});expect(r.status,r.text).toBe(403);expect(driveControl.deleted).toEqual(['uploaded-file']);expect(await db.select().from(editorialDeliveries)).toHaveLength(0);
    await f.app.close();
  });

  it('reasignación solicitada no se cierra antes de cambiar Editor y muestra ambos actores del historial real',async()=>{
    const f=await scenario();const chiefCookie=await loginComo(f.app,f.chief.email),next=await crearUsuario('editor');
    const support=await request(f.app.server).post('/api/editores/mis-solicitudes').set('Cookie',f.cookie).send({workItemId:f.w.id,type:'editor_apoyo',motivo:'Solicitud distinta que no debe aparecer en el detalle de reasignación'});expect(support.status,support.text).toBe(200);
    const created=await request(f.app.server).post('/api/editores/mis-solicitudes').set('Cookie',f.cookie).send({workItemId:f.w.id,type:'editor_reasignacion',motivo:'Necesito una redistribución de este trabajo'});expect(created.status,created.text).toBe(200);
    const decide=()=>request(f.app.server).post(`/api/editores/solicitudes-editor/${created.body.id}/decidir`).set('Cookie',chiefCookie).send({expectedVersion:1,action:'resolve',text:'Reasignación atendida por Jefatura de Edición'});
    expect((await decide()).status).toBe(409);await asignarEditor(f.p.id,next.id,f.chief.id,'Solicitud de redistribución atendida');expect((await decide()).status).toBe(200);
    const detail=await request(f.app.server).get(`/api/editores/mis-solicitudes/${created.body.id}`).set('Cookie',f.cookie);expect(detail.status,detail.text).toBe(200);expect(detail.body.summary.id).toBe(created.body.id);expect(detail.body.summary.reassignment).toMatchObject({previousEditor:f.editor.nombre,nextEditor:next.nombre});expect(detail.body.summary.status).toBe('resuelta');
    await f.app.close();
  });

});

async function loginComo(app: ReturnType<typeof crearAppDePrueba>, email: string) {
  const login = await request(app.server).post('/api/auth/login').send({ email, password: 'password123' });
  const cookie = login.headers['set-cookie'];
  if (!cookie) throw new Error('Login falló en loginComo');
  return cookie;
}

async function scenario(){
 const [chief,specialist,editor]=await Promise.all([crearUsuario('jefe_edicion'),crearUsuario('especialista'),crearUsuario('editor')]);
 const p=await crearProyectoDePrueba({especialistaId:specialist.id});await completarPreparacionDePrueba(p.id);await solicitarEditor(p.id,specialist.id);await asignarEditor(p.id,editor.id,chief.id);await crearCapitulo(p.id,1,editor.id);
 const [c]=await db.select().from(capitulos).where(and(eq(capitulos.proyectoId,p.id),eq(capitulos.numero,1)));const [w]=await db.select().from(workItems).where(eq(workItems.businessKey,'capitulo:'+c!.id));
 const app=crearAppDePrueba();await app.ready();const cookie=await loginComo(app,editor.email);return {chief,specialist,editor,p,c:c!,w:w!,app,cookie};
}
