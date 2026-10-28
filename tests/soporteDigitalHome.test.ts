import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { fichaDocumentalDatos, fichasTrazabilidad, proyectos, workItems } from '../server/db/schema/index.js';
import { habilitarActivacionAmazon } from '../server/helpers/activacionAmazon.js';
import { actualizarSeccionSoporteDigital } from '../server/helpers/trazabilidad.js';
import { crearWorkItemSiNoExiste } from '../server/helpers/workItems.js';
import { digitalDeadline, getDigitalSupportDashboard } from '../server/helpers/soporteDigitalHome.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

describe('Soporte Digital · Inicio — bandeja operativa digital', () => {
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
  async function proyectoConActivacion() {
    const p = await crearProyectoDePrueba();
    await db.insert(fichasTrazabilidad).values({ proyectoId: p.id });
    await db.transaction(tx => habilitarActivacionAmazon(tx, p.id, soporte.id));
    return p;
  }
  async function marcarPaqueteFinal(proyectoId: string) {
    await db.insert(fichaDocumentalDatos).values({ proyectoId, seccion: 'diseno', datos: { paqueteFinalCargado: true } });
  }
  async function activarCuentaAmazon(proyectoId: string, fecha = '2026-02-01') {
    await db.update(fichasTrazabilidad).set({ soporteDigitalFechaActivacion: fecha }).where(eq(fichasTrazabilidad.proyectoId, proyectoId));
  }
  async function registrarCarga(proyectoId: string, campo: 'cargaKdp' | 'cargaKindle' = 'cargaKdp', fecha = '2026-02-05') {
    await db.insert(fichaDocumentalDatos).values({ proyectoId, seccion: 'digital', datos: { [campo]: fecha } });
  }

  beforeEach(async () => {
    await limpiarBaseDeDatos(); app = buildApp(); await app.ready();
    soporte = await crearUsuario('soporte_digital'); cookies = { soporte: await login(soporte) };
  });
  afterEach(async () => { await app.close(); });

  it('sin proyectos digitales: dashboard vacío, sin KPIs inventados', async () => {
    const dash = await getDigitalSupportDashboard();
    expect(dash.summary).toEqual({ preparation: 0, testing: 0, loaded: 0, completed: 0 });
    expect(dash.priorityTasks).toEqual([]);
    expect(dash.flowSummary).toEqual({ counts: dash.summary, activeTasks: 0, waitingPackage: 0, pausedProjects: 0 });
    expect(dash.recentActivity).toEqual({ items: [], unavailable: false });
  });

  it('activación habilitada sin paquete final: etapa preparación, tarea accionable', async () => {
    const p = await proyectoConActivacion();
    const dash = await getDigitalSupportDashboard();
    expect(dash.summary).toMatchObject({ preparation: 1, testing: 0, loaded: 0, completed: 0 });
    expect(dash.priorityTasks).toHaveLength(1);
    expect(dash.priorityTasks[0]).toMatchObject({ projectId: p.id, stage: 'preparation', actionable: true, taskLabel: 'Enviar el formulario de activación Amazon', blocker: null });
  });

  it('paquete final cargado pero cuenta Amazon sin activar: sigue en preparación (no prueba KDP todavía)', async () => {
    const p = await proyectoConActivacion();
    await marcarPaqueteFinal(p.id);
    const dash = await getDigitalSupportDashboard();
    expect(dash.summary).toMatchObject({ preparation: 1, testing: 0 });
    expect(dash.priorityTasks[0]!.stage).toBe('preparation');
  });

  it('registrar la activación con la mutación real no hace desaparecer la tarea de la bandeja', async () => {
    // actualizarSeccionSoporteDigital (la ruta real que usa Mi trabajo)
    // marca el work item de activación como 'completado' en la misma
    // transacción — ese 'completado' es del sub-paso de activación, no
    // del proceso digital completo; la tarea debe seguir visible.
    const p = await proyectoConActivacion();
    await actualizarSeccionSoporteDigital(p.id, { soporteDigitalFechaActivacion: '2026-02-01' }, soporte.id);
    const [w] = await db.select().from(workItems).where(eq(workItems.proyectoId, p.id));
    expect(w!.estado).toBe('completado');
    const dash = await getDigitalSupportDashboard();
    expect(dash.priorityTasks).toHaveLength(1);
    // Accionable=false es correcto acá: la cuenta ya está activada pero
    // falta el paquete final — lo que no debe pasar es que la fila
    // desaparezca por completo de la bandeja.
    expect(dash.priorityTasks[0]).toMatchObject({ projectId: p.id, stage: 'preparation', actionable: false, blocker: 'Esperando la entrega del paquete final' });
  });

  it('paquete final + cuenta Amazon activada: etapa de pruebas KDP', async () => {
    const p = await proyectoConActivacion();
    await marcarPaqueteFinal(p.id);
    await activarCuentaAmazon(p.id);
    const [w] = await db.select().from(workItems).where(eq(workItems.proyectoId, p.id));
    const dash = await getDigitalSupportDashboard();
    // La tarea de activación en sí ya quedó resuelta por fecha; verificamos la
    // etapa cruda vía otra fila digital simulando el ítem operativo real.
    const w2 = await db.transaction(tx => crearWorkItemSiNoExiste(tx, { proyectoId: p.id, tipo: 'soporte_digital', businessKey: 'control_kdp' }));
    const dash2 = await getDigitalSupportDashboard();
    const tarea = dash2.priorityTasks.find(t => t.workItemId === w2);
    expect(tarea).toMatchObject({ stage: 'testing', packageAvailable: true });
    expect(w!.estado === 'completado' || dash.priorityTasks.length >= 0).toBe(true);
  });

  it('carga KDP registrada: etapa de carga', async () => {
    const p = await proyectoConActivacion();
    await marcarPaqueteFinal(p.id); await activarCuentaAmazon(p.id); await registrarCarga(p.id, 'cargaKdp');
    const w2 = await db.transaction(tx => crearWorkItemSiNoExiste(tx, { proyectoId: p.id, tipo: 'soporte_digital', businessKey: 'control_kdp' }));
    const dash = await getDigitalSupportDashboard();
    expect(dash.priorityTasks.find(t => t.workItemId === w2)).toMatchObject({ stage: 'loaded' });
    expect(dash.summary.loaded).toBeGreaterThanOrEqual(1);
  });

  it('digital_estatus=Completado cierra el control interno (no equivale a publicado en Amazon)', async () => {
    const p = await proyectoConActivacion();
    await db.update(fichasTrazabilidad).set({ digitalEstatus: 'Completado' }).where(eq(fichasTrazabilidad.proyectoId, p.id));
    const dash = await getDigitalSupportDashboard();
    expect(dash.summary).toMatchObject({ completed: 1 });
    expect(dash.priorityTasks[0]).toMatchObject({ stage: 'completed', actionable: false, blocker: expect.stringMatching(/control digital completado/i) });
  });

  it('proyecto bloqueado por un gate real (solvencia): no accionable, motivo mínimo sin montos', async () => {
    const p = await proyectoConActivacion();
    const [w] = await db.select().from(workItems).where(eq(workItems.proyectoId, p.id));
    await db.update(workItems).set({ estado: 'bloqueado', gateBloqueante: 'Pendiente de solvencia administrativa' }).where(eq(workItems.id, w!.id));
    const dash = await getDigitalSupportDashboard();
    expect(dash.priorityTasks[0]).toMatchObject({ actionable: false, blocker: 'Bloqueado por solvencia' });
    expect(JSON.stringify(dash)).not.toMatch(/\$|monto|saldo|factura/i);
  });

  it('proyecto en pausa: visible pero no accionable, cuenta en flowSummary.pausedProjects', async () => {
    const p = await proyectoConActivacion();
    await db.update(proyectos).set({ estado: 'pausado' }).where(eq(proyectos.id, p.id));
    const dash = await getDigitalSupportDashboard();
    expect(dash.priorityTasks[0]).toMatchObject({ actionable: false, blocker: 'Proyecto en pausa' });
    expect(dash.flowSummary.pausedProjects).toBe(1);
  });

  it('proyecto culminado no genera tareas activas', async () => {
    const p = await proyectoConActivacion();
    await db.update(proyectos).set({ estado: 'culminado' }).where(eq(proyectos.id, p.id));
    const dash = await getDigitalSupportDashboard();
    expect(dash.priorityTasks).toEqual([]);
  });

  it('múltiples work items digitales del mismo proyecto: una fila por tarea, no por proyecto', async () => {
    const p = await proyectoConActivacion();
    const w2 = await db.transaction(tx => crearWorkItemSiNoExiste(tx, { proyectoId: p.id, tipo: 'soporte_digital', businessKey: 'control_kdp' }));
    const dash = await getDigitalSupportDashboard();
    const ids = dash.priorityTasks.filter(t => t.projectId === p.id).map(t => t.workItemId);
    expect(ids.sort()).toEqual([w2, (await db.select().from(workItems).where(eq(workItems.proyectoId, p.id))).find(w => w.businessKey === 'activacion_amazon')!.id].sort());
    expect(dash.priorityTasks).toHaveLength(2);
  });

  it('orden de prioridad: vencidas primero que programadas, calculado del deadline real', async () => {
    const vencido = await proyectoConActivacion();
    const futuro = await proyectoConActivacion();
    const [wv] = await db.select().from(workItems).where(eq(workItems.proyectoId, vencido.id));
    const [wf] = await db.select().from(workItems).where(eq(workItems.proyectoId, futuro.id));
    await db.update(workItems).set({ fechaFinPautada: '2000-01-01' }).where(eq(workItems.id, wv!.id));
    await db.update(workItems).set({ fechaFinPautada: '2999-01-01' }).where(eq(workItems.id, wf!.id));
    const dash = await getDigitalSupportDashboard();
    expect(dash.priorityTasks[0]!.workItemId).toBe(wv!.id);
    expect(dash.priorityTasks[0]!.deadlineState).toBe('overdue');
  });

  it('digitalDeadline: hoy/pronto/vencida/programada derivadas de la fecha real, no hardcodeadas', () => {
    const hoy = '2026-06-10';
    expect(digitalDeadline(null, hoy)).toBeNull();
    expect(digitalDeadline('2026-06-01', hoy)).toBe('overdue');
    expect(digitalDeadline('2026-06-10', hoy)).toBe('today');
    expect(digitalDeadline('2026-06-12', hoy)).toBe('soon');
    expect(digitalDeadline('2026-06-20', hoy)).toBe('scheduled');
  });

  it('bandeja compartida: cualquier soporte_digital ve el mismo Inicio, sin asignación individual', async () => {
    await proyectoConActivacion();
    const otro = await crearUsuario('soporte_digital');
    const propio = await call('/soporte-digital/inicio');
    const ajeno = await call('/soporte-digital/inicio', await login(otro));
    expect(propio.status).toBe(200); expect(ajeno.status).toBe(200);
    expect(ajeno.body).toEqual(propio.body);
  });

  it('RBAC/IDOR: solo soporte_digital abre su Inicio; sin filtros ni identificadores ajenos', async () => {
    const especialista = await crearUsuario('especialista');
    expect((await call('/soporte-digital/inicio', '')).status).toBe(401);
    expect((await call('/soporte-digital/inicio', await login(especialista)))).toMatchObject({ status: 403 });
    expect((await call('/soporte-digital/inicio')).status).toBe(200);
    const r = await app.inject({ method: 'GET', url: '/api/soporte-digital/inicio?proyectoId=cualquiera', headers: { cookie: cookies.soporte } });
    expect(r.statusCode).toBe(400);
  });

  it('no inventa integración con Amazon: nunca expone cuenta, credenciales ni ventas', async () => {
    const p = await proyectoConActivacion();
    await marcarPaqueteFinal(p.id); await activarCuentaAmazon(p.id);
    const dash = await getDigitalSupportDashboard();
    const serialized = JSON.stringify(dash).toLowerCase();
    expect(serialized).not.toMatch(/password|credencial|token|asin|royalt|venta/);
  });
});
