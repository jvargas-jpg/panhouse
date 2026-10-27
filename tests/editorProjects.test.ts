import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { db } from '../server/db/client.js';
import { auditLogs, capitulos, editorialDeliveries, projectDriveFolders, projectDriveWorkspaces, proyectos, workItems } from '../server/db/schema/index.js';
import { crearProyectoDePrueba, crearUsuario, completarPreparacionDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { asignarEditor } from '../server/helpers/proyectos.js';
import { crearCapitulo, actualizarCapituloAutor, actualizarCapituloEditor } from '../server/helpers/capitulos.js';
import { reportarBloqueoEditorial } from '../server/helpers/editorialBlockers.js';
import { listarMisProyectos, obtenerMiProyecto } from '../server/helpers/editorProjects.js';

const google = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../server/modules/integrations/google-drive/corporate.js', () => ({ withCorporateDrive: async () => { google.calls++; throw Error('Google must not be called by the portfolio'); } }));
const now = new Date('2026-10-23T16:00:00Z');
beforeEach(async () => { google.calls = 0; await limpiarBaseDeDatos(); });
async function scenario() {
  const [editor, specialist, chief] = await Promise.all([crearUsuario('editor'), crearUsuario('especialista'), crearUsuario('jefe_edicion')]);
  const project = async (title: string) => {
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
    await completarPreparacionDePrueba(p.id);
    await db.update(proyectos).set({ titulo: title, tituloDefinitivo: title }).where(eq(proyectos.id, p.id));
    await asignarEditor(p.id, editor.id, chief.id);
    return p;
  };
  const p = await project('Portafolio editorial de prueba');
  const list = (f = {}) => listarMisProyectos(editor.id, { search: '', page: 1, pageSize: 25, sort: 'priority', ...f }, now);
  const chapter = async (number: number) => {
    await crearCapitulo(p.id, number, editor.id);
    const [c] = await db.select().from(capitulos).where(and(eq(capitulos.proyectoId, p.id), eq(capitulos.numero, number)));
    const [w] = await db.select().from(workItems).where(eq(workItems.businessKey, 'capitulo:' + c!.id));
    return { c: c!, w: w! };
  };
  return { editor, specialist, chief, project, p, list, chapter };
}
describe('Editor · Mis proyectos · portafolio personal', () => {
  it('cinco work items son una fila; varios proyectos son filas distintas, sin progreso contractual', async () => {
    const f = await scenario(); for (let n = 1; n <= 5; n++) await f.chapter(n);
    await f.project('Segundo proyecto'); await f.project('Tercer proyecto');
    const list = await f.list(); expect(list.total).toBe(3); expect(new Set(list.items.map(p => p.projectId)).size).toBe(3);
    const row = list.items.find(p => p.projectId === f.p.id)!;
    expect(row.workCounts).toMatchObject({ known: 5, pending: 5, completed: 0 }); expect(row.progress).toBeNull();
    expect(row.stateLabel).toBe('Por iniciar'); expect(row.interventionSummary).not.toMatch(/%|\d+ de \d+/);
    const detail = await obtenerMiProyecto(f.editor.id, f.p.id, now); expect(detail?.interventions).toHaveLength(5);
    expect(detail?.summary.assignedAt).toBeTruthy(); expect(google.calls).toBe(0);
  });
  it('elige trabajo accionable frente a espera y usa la próxima fecha de intervención', async () => {
    const f = await scenario(); await f.chapter(5); const active = await f.chapter(6);
    await actualizarCapituloEditor(f.p.id, 5, { fechaInicioEditor: '2026-10-01', fechaEntregaEditor: '2026-10-02' }, f.editor.id);
    await actualizarCapituloAutor(f.p.id, 5, { fechaEnvioAutor: '2026-10-05' }, f.specialist.id);
    await actualizarCapituloEditor(f.p.id, 6, { fechaInicioEditor: '2026-10-20' }, f.editor.id);
    const row = (await f.list()).items[0]!;
    expect(row.currentWork?.id).toBe(active.w.id); expect(row.currentIntervention).toBe('Capítulo 6');
    expect(row.workCounts.waiting).toBe(1); expect(row.stateLabel).toBe('En edición'); expect(row.nextDelivery?.date).toBe('2026-10-23');
  });
  it('solo espera al autor: conserva proceso, responsable externo y no imputa vencimiento', async () => {
    const f = await scenario(); await f.chapter(1);
    await actualizarCapituloEditor(f.p.id, 1, { fechaInicioEditor: '2026-09-01', fechaEntregaEditor: '2026-09-02' }, f.editor.id);
    await actualizarCapituloAutor(f.p.id, 1, { fechaEnvioAutor: '2026-09-03' }, f.specialist.id);
    const row = (await f.list()).items[0]!;
    expect(row.stateLabel).toBe('Esperando autor'); expect(row.overdue).toBe(false); expect(row.nextDelivery).toBeNull();
    expect(row.currentWork?.waitingOn).toBe('author'); expect(row.responsibleNow).toBe('autor');
  });
  it('el bloqueo conserva motivo y fecha reales sin convertir el portafolio en ejecución', async () => {
    const f = await scenario(); const { w } = await f.chapter(1);
    await reportarBloqueoEditorial(w.id, 'Falta el documento fuente del capítulo', f.editor.id);
    const detail = await obtenerMiProyecto(f.editor.id, f.p.id, now);
    expect(detail?.summary.stateLabel).toBe('Bloqueado'); expect(detail?.blockers[0]).toMatchObject({ workItemId: w.id, reason: 'Falta el documento fuente del capítulo' });
    expect(detail?.blockers[0]?.createdAt).toBeTruthy(); expect(detail?.summary.workCounts.blocked).toBe(1);
  });
  it('una participación sin work items no inventa trabajo por iniciar', async () => {
    const f = await scenario(); await db.delete(workItems).where(eq(workItems.proyectoId, f.p.id));
    const row = (await f.list()).items[0]!; expect(row.stateLabel).toBe('Sin trabajo activo'); expect(row.currentWork).toBeNull(); expect(row.workCounts.known).toBe(0);
    expect((await obtenerMiProyecto(f.editor.id, f.p.id, now))?.interventions).toEqual([]);
  });
  it('el ciclo completado se muestra como edición finalizada, sin porcentaje', async () => {
    const f = await scenario(); await f.chapter(1);
    await actualizarCapituloEditor(f.p.id, 1, { fechaInicioEditor: '2026-10-01', fechaEntregaEditor: '2026-10-02' }, f.editor.id);
    await actualizarCapituloAutor(f.p.id, 1, { fechaEnvioAutor: '2026-10-05', fechaRespuestaReal: '2026-10-06' }, f.specialist.id);
    await actualizarCapituloEditor(f.p.id, 1, { fechaEntregaEditor: '2026-10-07' }, f.editor.id);
    const row = (await f.list()).items[0]!; expect(row.stateLabel).toBe('Edición finalizada'); expect(row.workCounts.completed).toBe(1); expect(row.currentWork).toBeNull(); expect(row.progress).toBeNull();
  });
  it('búsqueda por código, título y autor; filtros, orden y paginación se aplican al conjunto completo', async () => {
    const f = await scenario(); await f.chapter(1); await f.project('Alfa'); await f.project('Zeta');
    const page = await f.list({ pageSize: 1, page: 2, sort: 'title' }); expect(page.total).toBe(3); expect(page.pages).toBe(3); expect(page.items[0]?.title).toBe('Portafolio editorial de prueba');
    expect((await f.list({ search: f.p.codigo })).items.map(p => p.projectId)).toEqual([f.p.id]);
    expect((await f.list({ search: 'Alfa' })).items).toHaveLength(1);
    const row = (await f.list()).items[0]!;
    expect((await f.list({ search: row.authors })).total).toBeGreaterThan(0);
    expect((await f.list({ service: row.serviceId, state: 'Por iniciar' })).total).toBe(1);
    expect((await f.list({ specialist: f.specialist.id })).total).toBe(3);
    expect((await f.list({ participation: 'history' })).total).toBe(0);
    expect((await f.list()).options.editors.map(e => e.id)).toEqual([f.editor.id]);
  });
  it('actividad y feedback incluyen al Especialista y excluyen otros departamentos', async () => {
    const f = await scenario(); const { c } = await f.chapter(1);
    await actualizarCapituloEditor(f.p.id, 1, { fechaInicioEditor: '2026-10-01', fechaEntregaEditor: '2026-10-02' }, f.editor.id);
    await actualizarCapituloAutor(f.p.id, 1, { fechaEnvioAutor: '2026-10-05', fechaRespuestaReal: '2026-10-06' }, f.specialist.id);
    await db.insert(auditLogs).values([
      { proyectoId: f.p.id, actorId: f.specialist.id, entityType: 'capitulo', entityId: c.id, accion: 'CAPITULO_FEEDBACK_REGISTRADO', createdAt: new Date(Date.now() + 1000) },
      { proyectoId: f.p.id, actorId: f.specialist.id, entityType: 'proyecto', entityId: f.p.id, accion: 'PAGO_REGISTRADO', createdAt: new Date(Date.now() + 2000) },
    ]);
    const detail = await obtenerMiProyecto(f.editor.id, f.p.id, now);
    expect(detail?.summary.lastActivity?.label).toBe('Feedback del autor registrado');
    expect(detail?.feedback[0]).toMatchObject({ pending: true, actor: f.specialist.nombre });
    expect(detail?.feedback.filter(f => f.pending)).toHaveLength(1); expect(detail?.history.some(h => h.label.includes('PAGO'))).toBe(false);
  });
  it('entregas propias; histórico conserva versiones propias y revoca links, material y operación', async () => {
    const f = await scenario(); const { w } = await f.chapter(1); const other = await crearUsuario('editor');
    await db.insert(editorialDeliveries).values([
      { projectId: f.p.id, workItemId: w.id, driveFileId: 'own-file', driveUrl: 'https://drive.google.com/file/d/own-file/view', submittedBy: f.editor.id },
      { projectId: f.p.id, workItemId: w.id, driveFileId: 'other-file', driveUrl: 'https://drive.google.com/file/d/other-file/view', submittedBy: other.id },
    ]);
    expect((await obtenerMiProyecto(f.editor.id, f.p.id, now))?.deliveries).toHaveLength(1);
    await asignarEditor(f.p.id, other.id, f.chief.id, 'Redistribución de prueba'); await crearCapitulo(f.p.id, 2, other.id);
    const [foreignEvent] = await db.insert(auditLogs).values({ proyectoId: f.p.id, actorId: other.id, entityType: 'work_item', entityId: w.id, accion: 'EDITOR_AVANCE_REGISTRADO' }).returning();
    expect((await f.list()).total).toBe(0); expect((await f.list({ participation: 'history' })).total).toBe(1);
    const detail = await obtenerMiProyecto(f.editor.id, f.p.id, now);
    expect(detail?.summary.participation).toBe('history'); expect(detail?.summary.currentWork).toBeNull(); expect(detail?.drive).toEqual({ rootUrl: null, links: [] });
    expect(detail?.interventions).toHaveLength(1); expect(detail?.interventions[0]).toMatchObject({ historical: true, actionable: false, label: 'Capítulo 1' });
    expect(detail?.deliveries[0]?.driveUrl).toBeNull(); expect(detail?.history.some(h => h.id === foreignEvent!.id)).toBe(false);
  });
  it('Drive usa el ID editorial persistido, filtra material ajeno y no migra plantillas legacy', async () => {
    const f = await scenario(); const [ws] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, f.p.id));
    await db.update(projectDriveWorkspaces).set({ templateVersion: 'legacy-v1' }).where(eq(projectDriveWorkspaces.id, ws!.id));
    await db.insert(projectDriveFolders).values([
      { workspaceId: ws!.id, key: 'EDITING', driveFolderId: 'persisted-editorial-legacy', driveUrl: 'https://drive.google.com/drive/folders/persisted-editorial-legacy', displayName: 'Nombre antiguo', templatePath: '/ruta-antigua', status: 'READY' },
      { workspaceId: ws!.id, key: 'RRPP', driveFolderId: 'private-rrpp', driveUrl: 'https://drive.google.com/drive/folders/private-rrpp', displayName: 'RRPP', templatePath: '/rrpp', status: 'READY' },
    ]);
    const detail = await obtenerMiProyecto(f.editor.id, f.p.id, now);
    expect(detail?.drive.rootUrl).toBe('https://drive.google.com/drive/folders/persisted-editorial-legacy'); expect(detail?.drive.links.map(f => f.key)).toEqual(['EDITING']);
    expect((await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.id, ws!.id)))[0]?.templateVersion).toBe('legacy-v1'); expect(google.calls).toBe(0);
  });
  it('RBAC/IDOR: sesión, rol, proyecto y archivos ajenos permanecen protegidos', async () => {
    const f = await scenario(); const { w } = await f.chapter(1); const outsider = await crearUsuario('editor');
    const app = crearAppDePrueba(); await app.ready();
    try {
      const login = async (email: string) => {
        const response = await request(app.server).post('/api/auth/login').send({ email, password: 'password123' });
        const cookie = response.headers['set-cookie'];
        if (!cookie) throw Error('QA login failed');
        return cookie;
      };
      const own = await login(f.editor.email), other = await login(outsider.email), chief = await login(f.chief.email);
      expect((await request(app.server).get('/api/editores/mis-proyectos')).status).toBe(401);
      expect((await request(app.server).get('/api/editores/mis-proyectos').set('Cookie', chief)).status).toBe(403);
      expect((await request(app.server).get('/api/editores/mis-proyectos').set('Cookie', other)).body.items).toEqual([]);
      expect((await request(app.server).get(`/api/editores/mis-proyectos/${f.p.id}`).set('Cookie', other)).status).toBe(404);
      expect((await request(app.server).get(`/api/editores/mi-trabajo/${w.id}/archivos?folderKey=EDITING_OUTPUT`).set('Cookie', other)).status).toBe(403);
      expect((await request(app.server).get(`/api/editores/mi-trabajo/${w.id}`).set('Cookie', other)).status).toBe(404);
      expect((await request(app.server).get('/api/editores/mis-proyectos?pageSize=2').set('Cookie', own)).status).toBe(400);
      expect((await request(app.server).get('/api/editores/mis-proyectos?sort=invalid').set('Cookie', own)).status).toBe(400);
      // A stale projection cannot grant the outsider an assignment.
      await db.update(proyectos).set({ editorId: outsider.id }).where(eq(proyectos.id, f.p.id));
      expect((await request(app.server).get(`/api/editores/mis-proyectos/${f.p.id}`).set('Cookie', other)).status).toBe(404);
      expect((await request(app.server).get(`/api/editores/mis-proyectos/${f.p.id}`).set('Cookie', own)).status).toBe(200);
    } finally { await app.close(); }
  });
});
