import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { auditLogs, fichaDocumentalDatos, fichasTrazabilidad, projectDriveFolders, projectDriveWorkspaces, proyectos, workItems } from '../server/db/schema/index.js';
import { habilitarActivacionAmazon } from '../server/helpers/activacionAmazon.js';
import { actualizarSeccionDigitalControl, actualizarSeccionSoporteDigital } from '../server/helpers/trazabilidad.js';
import { listarMiTrabajoDigital, obtenerDetalleTrabajoDigital } from '../server/helpers/soporteDigitalWork.js';
import { crearProyectoDePrueba, crearUsuario, completarPreparacionDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import type { DigitalWorkAction } from '../shared/soporteDigitalWork.js';

const driveControl = vi.hoisted(() => ({ listCalls: 0 }));
vi.mock('../server/modules/integrations/google-drive/corporate.js', () => ({
  withCorporateDrive: async (work: any) => {
    const { db } = await import('../server/db/client.js');
    const { externalIntegrations, projectDriveWorkspaces } = await import('../server/db/schema/index.js');
    const [integration] = await db.select().from(externalIntegrations);
    const [workspace] = await db.select().from(projectDriveWorkspaces);
    return work({
      integration, storage: {
        getMetadata: async () => { throw new Error('not used'); },
        listFiles: async () => { driveControl.listCalls++; return { items: [{ providerFileId: 'kdp-file-1', name: 'Interior.epub' }], nextPageToken: null }; },
      },
    });
  },
}));

const FILTERS = { tab: 'all' as const, search: '', page: 1, pageSize: 10 };

describe('Soporte Digital · Mi trabajo', () => {
  let app: ReturnType<typeof buildApp>;
  let soporte: Awaited<ReturnType<typeof crearUsuario>>;
  let cookies: Record<string, string>;
  async function login(u: Awaited<ReturnType<typeof crearUsuario>>) {
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: u.email, password: 'password123' } });
    return r.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }
  async function call(path: string, cookie = cookies.soporte) {
    const r = await app.inject({ method: 'GET', url: `/api${path}`, headers: { cookie } });
    return { status: r.statusCode, body: r.json() };
  }
  async function proyectoConActivacion(titulo?: string) {
    const p = await crearProyectoDePrueba();
    if (titulo) await db.update(proyectos).set({ titulo }).where(eq(proyectos.id, p.id));
    await db.insert(fichasTrazabilidad).values({ proyectoId: p.id });
    const workItemId = await db.transaction(tx => habilitarActivacionAmazon(tx, p.id, soporte.id));
    return { p, workItemId };
  }
  async function action(workItemId: string, kind: DigitalWorkAction['kind'], extra: Partial<DigitalWorkAction> = {}, cookie = cookies.soporte) {
    const d = await obtenerDetalleTrabajoDigital(workItemId);
    const input = { kind, requestId: randomUUID(), expectedRevision: d?.revision ?? '0'.repeat(64), ...(!['iniciarTarea', 'actualizarDatos'].includes(kind) ? { date: '2026-01-20' } : {}), ...extra };
    const response = await app.inject({ method: 'POST', url: `/api/soporte-digital/mi-trabajo/${workItemId}/acciones`, headers: { cookie }, payload: input });
    return { status: response.statusCode, body: response.json(), input };
  }
  async function paqueteFinal(projectId: string) {
    await db.insert(fichaDocumentalDatos).values({ proyectoId: projectId, seccion: 'diseno', datos: { paqueteFinalCargado: true } });
  }

  beforeEach(async () => {
    driveControl.listCalls = 0;
    await limpiarBaseDeDatos(); app = buildApp(); await app.ready();
    soporte = await crearUsuario('soporte_digital'); cookies = { soporte: await login(soporte) };
  });
  afterEach(async () => { await app.close(); });

  it('lista vacía cuando no hay tareas digitales', async () => {
    const list = await listarMiTrabajoDigital(FILTERS);
    expect(list.items).toEqual([]); expect(list.total).toBe(0);
    expect(list.counts).toEqual({ all: 0, preparation: 0, testing: 0, loaded: 0, completed: 0 });
  });

  it('una fila por work item, con el próximo paso real: enviar formulario', async () => {
    const { p, workItemId } = await proyectoConActivacion('Sombras del valle');
    const list = await listarMiTrabajoDigital(FILTERS);
    const row = list.items.find(r => r.workItemId === workItemId);
    expect(row).toMatchObject({ projectId: p.id, projectTitle: 'Sombras del valle', stage: 'preparation', actionable: true });
    expect(list.counts.preparation).toBe(1);
  });

  it('filtra por etapa (tab) y por búsqueda de texto', async () => {
    await proyectoConActivacion('Las voces del viento');
    const { workItemId: w2 } = await proyectoConActivacion('Ciudad de papel');
    await actualizarSeccionSoporteDigital((await db.select().from(workItems).where(eq(workItems.id, w2)))[0]!.proyectoId, { soporteDigitalFechaActivacion: '2026-01-01' }, soporte.id);
    await db.insert(fichaDocumentalDatos).values({ proyectoId: (await db.select().from(workItems).where(eq(workItems.id, w2)))[0]!.proyectoId, seccion: 'diseno', datos: { paqueteFinalCargado: true } });

    const testing = await listarMiTrabajoDigital({ ...FILTERS, tab: 'testing' });
    expect(testing.items).toHaveLength(1);
    expect(testing.items[0]!.projectTitle).toBe('Ciudad de papel');

    const bySearch = await listarMiTrabajoDigital({ ...FILTERS, search: 'voces' });
    expect(bySearch.items).toHaveLength(1);
    expect(bySearch.items[0]!.projectTitle).toBe('Las voces del viento');
  });

  it('filtra por proyecto y pagina correctamente', async () => {
    const { p: p1 } = await proyectoConActivacion('Proyecto A');
    await proyectoConActivacion('Proyecto B');
    const byProject = await listarMiTrabajoDigital({ ...FILTERS, project: p1.id });
    expect(byProject.items).toHaveLength(1);
    expect(byProject.items[0]!.projectId).toBe(p1.id);

    const page1 = await listarMiTrabajoDigital({ ...FILTERS, pageSize: 1, page: 1 });
    const page2 = await listarMiTrabajoDigital({ ...FILTERS, pageSize: 1, page: 2 });
    expect(page1.items).toHaveLength(1); expect(page2.items).toHaveLength(1);
    expect(page1.items[0]!.workItemId).not.toBe(page2.items[0]!.workItemId);
    expect(page1.pages).toBe(2); expect(page1.total).toBe(2);
  });

  it('última actividad real viene de audit_logs, no se inventa', async () => {
    const { workItemId } = await proyectoConActivacion();
    const list = await listarMiTrabajoDigital(FILTERS);
    const row = list.items.find(r => r.workItemId === workItemId);
    expect(row!.lastActivity).toMatchObject({ label: 'Activación Amazon habilitada' });
  });

  it('detalle: próximo paso avanza con cada hito real registrado', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    let d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toEqual({ kind: 'enviarFormulario' });

    await actualizarSeccionSoporteDigital(p.id, { soporteDigitalFechaEnvioFormulario: '2026-01-05' }, soporte.id);
    d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toEqual({ kind: 'registrarActivacion' });

    await actualizarSeccionSoporteDigital(p.id, { soporteDigitalFechaActivacion: '2026-01-10' }, soporte.id);
    d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toBeNull();
    expect(d!.waitingOn).toBe('Diseño/Calidad — paquete final');

    await db.insert(fichaDocumentalDatos).values({ proyectoId: p.id, seccion: 'diseno', datos: { paqueteFinalCargado: true } });
    d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toEqual({ kind: 'registrarPrueba' });
    expect(d!.waitingOn).toBeNull();

    await db.insert(fichaDocumentalDatos).values({ proyectoId: p.id, seccion: 'digital', datos: { pruebaArchivos: '2026-01-15' } });
    d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toEqual({ kind: 'registrarCarga' });

    await db.insert(fichaDocumentalDatos).values({ proyectoId: p.id, seccion: 'digital', datos: { pruebaArchivos: '2026-01-15', cargaKdp: '2026-01-20' } }).onConflictDoUpdate({ target: [fichaDocumentalDatos.proyectoId, fichaDocumentalDatos.seccion], set: { datos: { pruebaArchivos: '2026-01-15', cargaKdp: '2026-01-20' } } });
    d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toEqual({ kind: 'marcarCompletado' });

    await actualizarSeccionDigitalControl(p.id, { digitalEstatus: 'Completado' });
    d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toBeNull();
    expect(d!.summary.stage).toBe('completed');
  });

  it('detalle: cuenta activada sin fecha de envío explícita no retrocede a "enviar formulario"', async () => {
    // La cuenta activada es la señal más avanzada -- aunque
    // soporteDigitalFechaEnvioFormulario nunca se haya registrado (dato
    // cargado fuera de orden), el siguiente paso debe reflejar que la
    // activación ya ocurrió, no pedir un paso anterior ya superado.
    const { p, workItemId } = await proyectoConActivacion();
    await actualizarSeccionSoporteDigital(p.id, { soporteDigitalFechaActivacion: '2026-01-10' }, soporte.id);
    const d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toBeNull();
    expect(d!.waitingOn).toBe('Diseño/Calidad — paquete final');
  });

  it('detalle: no hay próxima acción si el proyecto está en pausa o bloqueado', async () => {
    const { p: pPaused, workItemId: wPaused } = await proyectoConActivacion();
    await db.update(proyectos).set({ estado: 'pausado' }).where(eq(proyectos.id, pPaused.id));
    expect((await obtenerDetalleTrabajoDigital(wPaused))!.nextAction).toBeNull();

    const { workItemId: wBlocked } = await proyectoConActivacion();
    await db.update(workItems).set({ estado: 'bloqueado', gateBloqueante: 'Pendiente de solvencia' }).where(eq(workItems.id, wBlocked));
    expect((await obtenerDetalleTrabajoDigital(wBlocked))!.nextAction).toBeNull();
  });

  it('detalle: catálogo real del área digital, agrupado, sin inventar campos', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    await db.insert(fichaDocumentalDatos).values({ proyectoId: p.id, seccion: 'digital', datos: { tapa: 'Mate', precioKdp: '12.99', induccion: '2026-03-01' } });
    const d = await obtenerDetalleTrabajoDigital(workItemId);
    const allFields = d!.catalog.flatMap(g => g.fields);
    expect(allFields.find(f => f.key === 'tapa')).toMatchObject({ label: 'Tapa Amazon', value: 'Mate' });
    expect(allFields.find(f => f.key === 'precioKdp')).toMatchObject({ value: '12.99' });
    expect(allFields.find(f => f.key === 'papel')!.value).toBeNull();
    expect(d!.catalog.map(g => g.label)).toEqual(['Formulario y cuenta', 'Criterios de la ficha Amazon', 'Pruebas y carga KDP', 'Inducción y cierre']);
  });

  it('detalle: nunca expone la cuenta Amazon ni datos financieros', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    await actualizarSeccionSoporteDigital(p.id, { soporteDigitalCuentaAmazon: 'editorial@panhouse.test' }, soporte.id);
    const d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.cuentaAmazon).toBeNull();
    expect(JSON.stringify(d)).not.toContain('editorial@panhouse.test');
  });

  it('detalle: especialista del proyecto y work item inexistente', async () => {
    const especialista = await crearUsuario('especialista');
    const p = await crearProyectoDePrueba({ especialistaId: especialista.id });
    await db.insert(fichasTrazabilidad).values({ proyectoId: p.id });
    const workItemId = await db.transaction(tx => habilitarActivacionAmazon(tx, p.id, soporte.id));
    const d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.specialist).toBe(especialista.nombre);
    expect(await obtenerDetalleTrabajoDigital('00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('bandeja compartida: cualquier soporte_digital ve y abre la misma tarea', async () => {
    const { workItemId } = await proyectoConActivacion();
    const otro = await crearUsuario('soporte_digital');
    const propio = await call('/soporte-digital/mi-trabajo');
    const ajeno = await call('/soporte-digital/mi-trabajo', await login(otro));
    expect(propio.body.items).toHaveLength(1); expect(ajeno.body.items).toHaveLength(1);
    expect(propio.body.items[0].workItemId).toBe(ajeno.body.items[0].workItemId);
    const detailOtro = await call(`/soporte-digital/mi-trabajo/${workItemId}`, await login(otro));
    expect(detailOtro.status).toBe(200);
  });

  it('RBAC: 401 sin sesión, 403 rol ajeno, 404 tarea inexistente', async () => {
    const especialista = await crearUsuario('especialista');
    expect((await call('/soporte-digital/mi-trabajo', '')).status).toBe(401);
    expect((await call('/soporte-digital/mi-trabajo', await login(especialista))).status).toBe(403);
    expect((await call('/soporte-digital/mi-trabajo/00000000-0000-0000-0000-000000000000')).status).toBe(404);
  });

  it('archivos: lista desde la carpeta real KDP del paquete final, sin llamada por fila de la lista', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    await completarPreparacionDePrueba(p.id);
    await paqueteFinal(p.id);
    const [ws] = await db.select().from(projectDriveWorkspaces).where(eq(projectDriveWorkspaces.projectId, p.id));
    await db.insert(projectDriveFolders).values({ workspaceId: ws!.id, key: 'FINAL_PACKAGE_KDP', driveFolderId: 'kdp-' + p.id, displayName: 'KDP', templatePath: '/paquete-final/kdp', status: 'READY', driveUrl: 'https://drive.google.com/drive/folders/kdp-' + p.id });

    expect(driveControl.listCalls).toBe(0);
    await listarMiTrabajoDigital(FILTERS); // la lista nunca debe tocar Drive
    expect(driveControl.listCalls).toBe(0);

    const r = await call(`/soporte-digital/mi-trabajo/${workItemId}/archivos`);
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([{ id: 'kdp-file-1', name: 'Interior.epub', url: 'https://drive.google.com/file/d/kdp-file-1/view' }]);
    expect(driveControl.listCalls).toBe(1);
  });

  it('archivos: sin carpeta KDP todavía, responde vacío en vez de error', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    await completarPreparacionDePrueba(p.id);
    await paqueteFinal(p.id);
    const r = await call(`/soporte-digital/mi-trabajo/${workItemId}/archivos`);
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([]);
  });

  it('abrir una tarea no la inicia; iniciar explícitamente guarda fecha y audit', async () => {
    const { workItemId } = await proyectoConActivacion();
    await call(`/soporte-digital/mi-trabajo/${workItemId}`);
    const [before] = await db.select().from(workItems).where(eq(workItems.id, workItemId));
    expect(before!.fechaInicioReal).toBeNull();
    expect((await action(workItemId, 'iniciarTarea')).status).toBe(200);
    const detail = await obtenerDetalleTrabajoDigital(workItemId);
    expect(detail!.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(detail!.canStart).toBe(false);
    expect(detail!.history.some(h => h.label === 'Tarea digital iniciada')).toBe(true);
  });

  it('operación completa sobre hitos existentes: preparación previa al paquete, prueba, carga atómica y cierre interno', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    expect((await action(workItemId, 'enviarFormulario')).status).toBe(200);
    expect((await action(workItemId, 'registrarActivacion')).status).toBe(200);
    expect((await obtenerDetalleTrabajoDigital(workItemId))!.waitingOn).toContain('Diseño/Calidad');
    expect((await action(workItemId, 'registrarPrueba')).status).toBe(409);
    await paqueteFinal(p.id);
    expect((await action(workItemId, 'registrarCarga')).status).toBe(409);
    expect((await action(workItemId, 'registrarPrueba')).status).toBe(200);
    expect((await action(workItemId, 'registrarCarga', { dateKindle: '2026-01-21' })).status).toBe(200);
    const [digital] = await db.select().from(fichaDocumentalDatos).where(and(eq(fichaDocumentalDatos.proyectoId, p.id), eq(fichaDocumentalDatos.seccion, 'digital')));
    expect(digital!.datos).toMatchObject({ pruebaArchivos: '2026-01-20', cargaKdp: '2026-01-20', cargaKindle: '2026-01-21' });
    expect((await obtenerDetalleTrabajoDigital(workItemId))!.summary.stage).toBe('loaded');
    expect((await action(workItemId, 'marcarCompletado')).status).toBe(200);
    const done = await obtenerDetalleTrabajoDigital(workItemId);
    expect(done!.summary.stage).toBe('completed'); expect(done!.nextAction).toBeNull();
    expect(done!.history.map(h => h.label)).toContain('Carga de archivos registrada');
  });

  it('doble clic concurrente y reintento no duplican eventos ni aceptan otro payload con el mismo requestId', async () => {
    const { workItemId } = await proyectoConActivacion();
    const d = await obtenerDetalleTrabajoDigital(workItemId);
    const payload = { kind: 'enviarFormulario', expectedRevision: d!.revision, requestId: randomUUID(), date: '2026-01-10' };
    const send = (input = payload) => app.inject({ method: 'POST', url: `/api/soporte-digital/mi-trabajo/${workItemId}/acciones`, headers: { cookie: cookies.soporte }, payload: input });
    const responses = await Promise.all([send(), send()]);
    expect(responses.map(r => r.statusCode)).toEqual([200, 200]);
    expect(responses.map(r => r.json().replayed).sort()).toEqual([false, true]);
    expect((await send({ ...payload, date: '2026-01-11' })).statusCode).toBe(409);
    const events = await db.select().from(auditLogs).where(and(eq(auditLogs.entityId, workItemId), eq(auditLogs.accion, 'DIGITAL_HITO_REGISTRADO')));
    expect(events).toHaveLength(1);
  });

  it('rechaza una transición si otra sesión bloqueó o canceló la tarea', async () => {
    const { workItemId } = await proyectoConActivacion();
    const revision = (await obtenerDetalleTrabajoDigital(workItemId))!.revision;
    await db.update(workItems).set({ estado: 'bloqueado', gateBloqueante: 'solvencia' }).where(eq(workItems.id, workItemId));
    expect((await action(workItemId, 'enviarFormulario', { expectedRevision: revision })).status).toBe(409);
    expect((await action(workItemId, 'enviarFormulario')).status).toBe(409);
    await db.update(workItems).set({ estado: 'cancelado' }).where(eq(workItems.id, workItemId));
    expect((await action(workItemId, 'enviarFormulario')).status).toBe(404);
    expect((await call(`/soporte-digital/mi-trabajo/${workItemId}/archivos`)).status).toBe(404);
  });

  it('IDOR: otras áreas, canceladas, retiradas y proyectos sin intervención digital quedan fuera del endpoint operativo', async () => {
    const p = await crearProyectoDePrueba();
    const [other] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno' }).returning();
    expect((await action(other!.id, 'enviarFormulario')).status).toBe(404);
    expect((await call(`/soporte-digital/mi-trabajo/${other!.id}/archivos`)).status).toBe(404);
    const { p: digital, workItemId } = await proyectoConActivacion();
    const editor = await crearUsuario('editor');
    expect((await action(workItemId, 'enviarFormulario', {}, await login(editor))).status).toBe(403);
    expect((await action(workItemId, 'enviarFormulario', {}, '')).status).toBe(401);
    await db.update(proyectos).set({ estado: 'retirado' }).where(eq(proyectos.id, digital.id));
    expect((await action(workItemId, 'enviarFormulario')).status).toBe(404);
  });

  it('Drive revalida el paquete final aunque se solicite directamente la URL', async () => {
    const { workItemId } = await proyectoConActivacion();
    expect((await call(`/soporte-digital/mi-trabajo/${workItemId}/archivos`)).status).toBe(409);
    expect(driveControl.listCalls).toBe(0);
  });

  it('varios work items de un proyecto conservan filas y totales fuera de la página visible', async () => {
    const { p, workItemId } = await proyectoConActivacion('Proyecto de múltiples tareas');
    const [second] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'soporte_digital', businessKey: 'paso-configurado' }).returning();
    const page = await listarMiTrabajoDigital({ ...FILTERS, pageSize: 1 });
    expect(page.items).toHaveLength(1); expect(page.counts.all).toBe(2); expect(page.total).toBe(2);
    const all = await listarMiTrabajoDigital(FILTERS);
    expect(new Set(all.items.map(r => r.workItemId))).toEqual(new Set([workItemId, second!.id]));
    expect((await obtenerDetalleTrabajoDigital(second!.id))!.nextAction).toBeNull();
  });

  it('filtros SQL por estado, bloqueo, etapa y vencimiento respetan la espera sin atraso', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    await db.update(workItems).set({ fechaFinPautada: '2026-01-01' }).where(eq(workItems.id, workItemId));
    expect((await listarMiTrabajoDigital({ ...FILTERS, deadline: 'overdue' })).total).toBe(1);
    await actualizarSeccionSoporteDigital(p.id, { soporteDigitalFechaActivacion: '2026-01-02' }, soporte.id);
    expect((await listarMiTrabajoDigital({ ...FILTERS, deadline: 'overdue' })).total).toBe(0);
    expect((await listarMiTrabajoDigital({ ...FILTERS, state: 'waiting_material', stage: 'preparation', blocked: 'no' })).total).toBe(1);
    expect((await listarMiTrabajoDigital({ ...FILTERS, state: 'blocked' })).total).toBe(0);
    expect((await listarMiTrabajoDigital({ ...FILTERS, search: 'preparación' })).total).toBe(1);
  });

  it('control completado sin carga histórica no vuelve a ofrecer una prueba', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    await actualizarSeccionDigitalControl(p.id, { digitalEstatus: 'Completado' });
    const d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toBeNull(); expect(d!.canStart).toBe(false);
  });

  it('preparación permite editar campos reales sin paquete final y rechaza datos ajenos o un bypass de carga', async () => {
    const { workItemId } = await proyectoConActivacion();
    expect((await action(workItemId, 'actualizarDatos', { datos: { precioKdp: '12.99', tapa: 'Mate' } })).status).toBe(200);
    expect((await action(workItemId, 'actualizarDatos', { datos: { cargaKdp: '2026-01-20' } })).status).toBe(400);
    expect((await action(workItemId, 'actualizarDatos', { datos: { password: 'no-permitido' } })).status).toBe(400);
    expect((await action(workItemId, 'actualizarDatos', { datos: { grabacionCriterios: 'javascript:alert(1)' } })).status).toBe(400);
    expect((await obtenerDetalleTrabajoDigital(workItemId))!.catalog.flatMap(g => g.fields).find(f => f.key === 'precioKdp')!.value).toBe('12.99');
  });

  it('permite cargar Kindle después de KDP y rechaza sobrescribir una carga del mismo paquete', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    await actualizarSeccionSoporteDigital(p.id, { soporteDigitalFechaActivacion: '2026-01-10' }, soporte.id);
    await paqueteFinal(p.id);
    expect((await action(workItemId, 'registrarPrueba')).status).toBe(200);
    expect((await action(workItemId, 'registrarCarga')).status).toBe(200);
    expect((await action(workItemId, 'registrarCarga')).status).toBe(409);
    expect((await action(workItemId, 'registrarCarga', { date: undefined, dateKindle: '2026-01-21' })).status).toBe(200);
    expect((await obtenerDetalleTrabajoDigital(workItemId))!.currentLoads).toEqual({ kdp: true, kindle: true });
  });

  it('un manifiesto nuevo requiere otra prueba y carga, conservando los resultados anteriores en audit', async () => {
    const { p, workItemId } = await proyectoConActivacion();
    await actualizarSeccionSoporteDigital(p.id, { soporteDigitalFechaActivacion: '2026-01-10' }, soporte.id);
    await paqueteFinal(p.id);
    expect((await action(workItemId, 'registrarPrueba')).status).toBe(200);
    expect((await action(workItemId, 'registrarCarga')).status).toBe(200);
    await db.update(fichaDocumentalDatos).set({ datos: { paqueteFinalCargado: true, paqueteFinalArchivos: 'Referencia del paquete revisado' } }).where(and(eq(fichaDocumentalDatos.proyectoId, p.id), eq(fichaDocumentalDatos.seccion, 'diseno')));
    const d = await obtenerDetalleTrabajoDigital(workItemId);
    expect(d!.nextAction).toEqual({ kind: 'registrarPrueba' });
    expect(d!.currentLoads).toEqual({ kdp: false, kindle: false });
    expect((await action(workItemId, 'registrarCarga')).status).toBe(409);
    expect((await action(workItemId, 'registrarPrueba', { date: '2026-01-22' })).status).toBe(200);
    const tests = await db.select().from(auditLogs).where(and(eq(auditLogs.entityId, workItemId), eq(auditLogs.accion, 'DIGITAL_HITO_REGISTRADO')));
    const proofs = tests.map(e => e.detalles as { kind: string; materialRevision: string; date: string }).filter(e => e.kind === 'registrarPrueba');
    expect(proofs).toHaveLength(2); expect(new Set(proofs.map(e => e.materialRevision)).size).toBe(2);
    expect(proofs.map(e => e.date)).toContain('2026-01-20');
  });
});
