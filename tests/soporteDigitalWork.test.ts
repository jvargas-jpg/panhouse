import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { fichaDocumentalDatos, fichasTrazabilidad, projectDriveFolders, projectDriveWorkspaces, proyectos, workItems } from '../server/db/schema/index.js';
import { habilitarActivacionAmazon } from '../server/helpers/activacionAmazon.js';
import { actualizarSeccionDigitalControl, actualizarSeccionSoporteDigital } from '../server/helpers/trazabilidad.js';
import { listarMiTrabajoDigital, obtenerDetalleTrabajoDigital } from '../server/helpers/soporteDigitalWork.js';
import { crearProyectoDePrueba, crearUsuario, completarPreparacionDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

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
    const r = await call(`/soporte-digital/mi-trabajo/${workItemId}/archivos`);
    expect(r.status).toBe(200);
    expect(r.body.items).toEqual([]);
  });
});
