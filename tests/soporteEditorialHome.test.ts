import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { direccionesCreativas, disenos, disenoVersiones, fichasTrazabilidad, proyectos, workItems } from '../server/db/schema/index.js';
import { criteriosDeFase } from '../server/helpers/calidad.js';
import { getValidatorDashboard } from '../server/helpers/soporteEditorialHome.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

describe('Soporte Editorial · Inicio — bandeja compartida de Calidad', () => {
  let app: ReturnType<typeof buildApp>;
  let p: Awaited<ReturnType<typeof crearProyectoDePrueba>>;
  let especialista: Awaited<ReturnType<typeof crearUsuario>>;
  let disenador: Awaited<ReturnType<typeof crearUsuario>>;
  let soporte: Awaited<ReturnType<typeof crearUsuario>>;
  let cookies: Record<string, string>;
  let disenoId: string; let versionId: string; let faseId: string;
  const lista = (fase = 1) => Object.fromEntries(criteriosDeFase(fase).map(c => [c, { cumple: true }]));
  async function login(u: Awaited<ReturnType<typeof crearUsuario>>) {
    const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: u.email, password: 'password123' } });
    return r.cookies.map(c => `${c.name}=${c.value}`).join('; ');
  }
  async function call(method: 'GET' | 'POST' | 'PATCH', path: string, payload?: any, cookie = cookies.soporte) {
    const r = await app.inject({ method, url: `/api${path}`, headers: { cookie }, payload }); return { status: r.statusCode, body: r.json() };
  }
  async function entregar() {
    const r = await call('POST', `/diseno/${disenoId}/versiones`, { enlace: `https://drive.google.com/${randomUUID()}`, entregaKey: randomUUID() }, cookies.disenador);
    expect(r.status).toBe(201); versionId = r.body.id;
    expect((await call('PATCH', `/diseno/${disenoId}/versiones/${versionId}`, { accion: 'handoff_calidad' }, cookies.especialista)).status).toBe(200);
    const [v] = await db.select().from(disenoVersiones).where(eq(disenoVersiones.id, versionId)); faseId = v!.calidadFaseId!;
  }
  beforeEach(async () => {
    await limpiarBaseDeDatos(); app = buildApp(); await app.ready();
    especialista = await crearUsuario('especialista'); disenador = await crearUsuario('disenador'); soporte = await crearUsuario('soporte_editorial');
    p = await crearProyectoDePrueba({ especialistaId: especialista.id, disenadorId: disenador.id });
    await db.insert(fichasTrazabilidad).values({ proyectoId: p.id });
    const [cw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'direccion_creativa', estado: 'completado' }).returning();
    const [dc] = await db.insert(direccionesCreativas).values({ proyectoId: p.id, workItemId: cw!.id, tipo: 'concepto_portada', resultadoFinal: 'aprobado' }).returning();
    const [dw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno', estado: 'en_progreso' }).returning();
    const [d] = await db.insert(disenos).values({ proyectoId: p.id, workItemId: dw!.id, tipo: 'diagramacion', direccionCreativaId: dc!.id, fuenteUrl: 'https://drive.google.com/tripa', solicitudKey: randomUUID(), preparacionConfirmada: true }).returning();
    disenoId = d!.id; cookies = { especialista: await login(especialista), disenador: await login(disenador), soporte: await login(soporte) };
    await entregar();
  });
  afterEach(async () => { await app.close(); });

  it('ronda recién entregada cuenta como nueva ronda activa, sin KPI falsos', async () => {
    const dash = await getValidatorDashboard();
    expect(dash.summary).toEqual({ active: 1, dueSoon: 0, overdue: 0, newRounds: 1 });
    expect(dash.attentionItems).toHaveLength(1);
    const item = dash.attentionItems[0]!;
    expect(item).toMatchObject({ faseId, projectId: p.id, numeroFase: 1, ronda: 1, validationType: 'Validación de textos diagramados', state: 'new', stateLabel: 'Nueva ronda', cta: 'Abrir validación', deadline: null, deadlineState: null });
    expect(dash.recentActivity[0]).toMatchObject({ label: 'Nueva ronda disponible' });
  });

  it('vencida y vence pronto se calculan del due_at real, nunca hardcodeados', async () => {
    const pasado = new Date(Date.now() - 86400000).toISOString();
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, { dueAt: pasado })).status).toBe(200);
    const dash = await getValidatorDashboard();
    expect(dash.summary).toMatchObject({ active: 1, overdue: 1, dueSoon: 0, newRounds: 0 });
    expect(dash.attentionItems[0]).toMatchObject({ state: 'inProgress', stateLabel: 'En revisión', cta: 'Continuar validación', deadlineState: 'vencido' });
  });

  it('vence pronto (dentro de 24h) se distingue de vencida', async () => {
    const pronto = new Date(Date.now() + 3600000).toISOString();
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, { dueAt: pronto })).status).toBe(200);
    const dash = await getValidatorDashboard();
    expect(dash.summary).toMatchObject({ overdue: 0, dueSoon: 1 });
    expect(dash.upcomingDeadlines).toHaveLength(1);
    expect(dash.upcomingDeadlines[0]).toMatchObject({ faseId, deadlineState: 'proximo_a_vencer' });
  });

  it('ronda resuelta sale de activas y aparece como actividad reciente, sin sobrescribir la ronda anterior al crear la siguiente', async () => {
    expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: false, cantidadComentarios: 1, comentariosUrl: 'https://drive.google.com/x', checklist: lista() }))).toMatchObject({ status: 200 });
    let dash = await getValidatorDashboard();
    expect(dash.summary).toEqual({ active: 0, dueSoon: 0, overdue: 0, newRounds: 0 });
    expect(dash.recentActivity[0]).toMatchObject({ label: 'Validación devuelta con comentarios' });

    await entregar();
    dash = await getValidatorDashboard();
    expect(dash.summary).toMatchObject({ active: 1, newRounds: 1 });
    expect(dash.attentionItems[0]).toMatchObject({ numeroFase: 2, ronda: 1 });
  });

  it('proyecto retirado no cuenta como trabajo activo del validador', async () => {
    await db.update(proyectos).set({ estado: 'retirado' }).where(eq(proyectos.id, p.id));
    const dash = await getValidatorDashboard();
    expect(dash.summary).toEqual({ active: 0, dueSoon: 0, overdue: 0, newRounds: 0 });
  });

  it('bandeja compartida: cualquier soporte_editorial ve exactamente las mismas rondas, sin asignación individual', async () => {
    const otro = await crearUsuario('soporte_editorial');
    const propio = await call('GET', '/calidad/inicio', undefined, cookies.soporte);
    const ajeno = await call('GET', '/calidad/inicio', undefined, await login(otro));
    expect(propio.status).toBe(200); expect(ajeno.status).toBe(200);
    expect(ajeno.body).toEqual(propio.body);
  });

  it('RBAC: solo soporte_editorial abre su Inicio; sesión anónima rechazada', async () => {
    expect((await call('GET', '/calidad/inicio', undefined, '')).status).toBe(401);
    expect((await call('GET', '/calidad/inicio', undefined, cookies.especialista)).status).toBe(403);
    expect((await call('GET', '/calidad/inicio', undefined, cookies.disenador)).status).toBe(403);
    expect((await call('GET', '/calidad/inicio')).status).toBe(200);
  });
});
