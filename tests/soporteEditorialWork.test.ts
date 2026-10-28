import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../server/app.js';
import { db, pool } from '../server/db/client.js';
import { direccionesCreativas, disenos, disenoVersiones, fichasTrazabilidad, proyectos, workItems } from '../server/db/schema/index.js';
import { criteriosDeFase } from '../server/helpers/calidad.js';
import { listarMiTrabajoValidador, obtenerDetalleTrabajoValidador } from '../server/helpers/soporteEditorialWork.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

const FILTROS = { tab: 'active' as const, search: '', page: 1, pageSize: 10 };

describe('Soporte Editorial · Mi trabajo — bandeja compartida de Calidad', () => {
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

  it('una fila es una ronda (no un proyecto), con ronda y versión separadas', async () => {
    const list = await listarMiTrabajoValidador(FILTROS);
    expect(list.items).toHaveLength(1);
    const row = list.items[0]!;
    expect(row).toMatchObject({ id: faseId, projectId: p.id, numeroFase: 1, ronda: 1, validationType: 'Validación de textos diagramados', status: 'new_round', statusLabel: 'Nueva ronda', cta: 'Iniciar validación', actionable: true });
    expect(row.versionLabel).toBe('V1'); // ronda=1 y versión=V1 coinciden acá por casualidad, nunca por regla
    expect(list.counts).toEqual({ active: 1, waiting: 0, completed: 0, all: 1 });
  });

  it('iniciar la ronda la mueve a "en revisión" y habilita continuar', async () => {
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, {})).status).toBe(200);
    const list = await listarMiTrabajoValidador(FILTROS);
    expect(list.items[0]).toMatchObject({ status: 'in_review', statusLabel: 'En revisión', cta: 'Continuar validación' });
  });

  it('vencida y vence pronto vienen del due_at real, nunca hardcodeados; sin deadline cuando no accionable', async () => {
    const pasado = new Date(Date.now() - 86400000).toISOString();
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, { dueAt: pasado })).status).toBe(200);
    let list = await listarMiTrabajoValidador(FILTROS);
    expect(list.items[0]).toMatchObject({ deadlineState: 'vencido' });
    expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: false, cantidadComentarios: 1, comentariosUrl: 'https://drive.google.com/x', checklist: lista() }))).toMatchObject({ status: 200 });
    list = await listarMiTrabajoValidador({ ...FILTROS, tab: 'waiting' });
    expect(list.items[0]).toMatchObject({ status: 'waiting_design', deadline: null, deadlineState: null, actionable: false, cta: 'Ver contexto' });
  });

  it('resolver con observaciones pasa a "esperando Diseño"; la nueva versión abre ronda 2 y deja la 1 en completadas sin sobrescribirla', async () => {
    expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: false, cantidadComentarios: 2, comentariosUrl: 'https://drive.google.com/x', checklist: lista() }))).toMatchObject({ status: 200 });
    let waiting = await listarMiTrabajoValidador({ ...FILTROS, tab: 'waiting' });
    expect(waiting.items).toHaveLength(1);
    expect(waiting.items[0]).toMatchObject({ id: faseId, numeroFase: 1, ronda: 1 });

    const primeraRondaId = faseId;
    await entregar(); // Diseño entrega V2 -> nace F2.1, F1.1 deja de estar activa
    expect(faseId).not.toBe(primeraRondaId);

    const activos = await listarMiTrabajoValidador(FILTROS);
    expect(activos.items).toHaveLength(1);
    expect(activos.items[0]).toMatchObject({ id: faseId, numeroFase: 2, ronda: 1, status: 'new_round' });

    const completados = await listarMiTrabajoValidador({ ...FILTROS, tab: 'completed' });
    expect(completados.items.map(i => i.id)).toContain(primeraRondaId);
    const historica = completados.items.find(i => i.id === primeraRondaId)!;
    expect(historica).toMatchObject({ numeroFase: 1, ronda: 1, status: 'completed' });

    const todas = await listarMiTrabajoValidador({ ...FILTROS, tab: 'all' });
    expect(todas.total).toBe(2);

    const detalle = await obtenerDetalleTrabajoValidador(faseId);
    expect(detalle?.previousRound).toEqual({ id: primeraRondaId, label: 'F1.1' });
  });

  it('aprobar sin comentarios ni criterios pendientes resuelve la ronda como completada', async () => {
    expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: true, cantidadComentarios: 0, checklist: lista() }))).toMatchObject({ status: 200 });
    const list = await listarMiTrabajoValidador({ ...FILTROS, tab: 'completed' });
    expect(list.items[0]).toMatchObject({ id: faseId, status: 'completed', statusLabel: 'Completada', cta: 'Ver resultado', actionable: false });
  });

  it('detalle: especialista, diseñador, materiales y checklist real (sin inventar categorías/scores)', async () => {
    const detalle = await obtenerDetalleTrabajoValidador(faseId);
    expect(detalle).toMatchObject({ specialist: especialista.nombre, designer: disenador.nombre, approved: null, observations: null });
    expect(detalle!.materials.map(m => m.role)).toEqual(expect.arrayContaining(['diagrammed', 'source']));
    expect(detalle!.criteria).toHaveLength(26);
    expect(detalle!.criteria.every(c => c.cumple === null)).toBe(true);
    expect(detalle!.history[0]).toMatchObject({ label: 'Ronda creada' });
    // Nunca inventar score/severidad/porcentaje
    expect(JSON.stringify(detalle)).not.toMatch(/score|severidad|porcentaje/i);
  });

  it('búsqueda y filtros por proyecto/estado operan sobre datos reales', async () => {
    const porCodigo = await listarMiTrabajoValidador({ ...FILTROS, search: p.codigo });
    expect(porCodigo.items).toHaveLength(1);
    const sinMatch = await listarMiTrabajoValidador({ ...FILTROS, search: 'zzz-no-existe' });
    expect(sinMatch.items).toHaveLength(0);
    const porProyecto = await listarMiTrabajoValidador({ ...FILTROS, project: p.id });
    expect(porProyecto.items).toHaveLength(1);
    const porEstado = await listarMiTrabajoValidador({ ...FILTROS, status: 'waiting_design' });
    expect(porEstado.items).toHaveLength(0);
  });

  it('bandeja compartida: cualquier soporte_editorial ve exactamente las mismas rondas, sin asignación individual', async () => {
    const otro = await crearUsuario('soporte_editorial');
    const propio = await call('GET', '/calidad/mi-trabajo?tab=all');
    const ajeno = await call('GET', '/calidad/mi-trabajo?tab=all', undefined, await login(otro));
    expect(propio.status).toBe(200); expect(ajeno.status).toBe(200);
    expect(ajeno.body).toEqual(propio.body);
  });

  it('RBAC: solo soporte_editorial abre Mi trabajo; sesión anónima y otros roles rechazados', async () => {
    expect((await call('GET', '/calidad/mi-trabajo', undefined, '')).status).toBe(401);
    expect((await call('GET', '/calidad/mi-trabajo', undefined, cookies.especialista)).status).toBe(403);
    expect((await call('GET', '/calidad/mi-trabajo', undefined, cookies.disenador)).status).toBe(403);
    expect((await call('GET', '/calidad/mi-trabajo')).status).toBe(200);
    expect((await call('GET', `/calidad/mi-trabajo/${faseId}`, undefined, cookies.especialista)).status).toBe(403);
  });

  it('detalle inexistente responde 404, no una ronda ajena', async () => {
    expect((await call('GET', `/calidad/mi-trabajo/${randomUUID()}`)).status).toBe(404);
  });

  it('proyecto retirado no aparece como trabajo activo del validador', async () => {
    await db.update(proyectos).set({ estado: 'retirado' }).where(eq(proyectos.id, p.id));
    const list = await listarMiTrabajoValidador({ ...FILTROS, tab: 'all' });
    expect(list.items).toHaveLength(0);
  });

  it('busca versión y ronda por separado, pagina en SQL y agrega todos los resultados sin N+1', async () => {
    for (let i = 0; i < 11; i++) {
      expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: false, cantidadComentarios: 1, comentariosUrl: 'https://drive.google.com/comentado', checklist: i === 0 ? lista() : undefined, ...(i > 0 ? { cambiosPendientesPorAplicar: 1, cambiosNuevosSugeridos: 0 } : {}) })).status).toBe(200);
      await entregar();
    }
    const spy = vi.spyOn(pool, 'query');
    try {
      const first = await listarMiTrabajoValidador({ ...FILTROS, tab: 'all' });
      expect(first).toMatchObject({ total: 12, pages: 2, counts: { active: 1, completed: 11, all: 12 } });
      expect(first.items).toHaveLength(10);
      expect(spy.mock.calls.length).toBe(4);
      const last = await listarMiTrabajoValidador({ ...FILTROS, tab: 'all', page: 999 });
      expect(last).toMatchObject({ page: 2, total: 12 });
      expect(last.items).toHaveLength(2);
      expect(new Set([...first.items, ...last.items].map(r => r.id)).size).toBe(12);
      const version = await listarMiTrabajoValidador({ ...FILTROS, search: 'V12' });
      expect(version.items[0]).toMatchObject({ ronda: 11, versionLabel: 'V12', numeroFase: 2 });
      expect((await listarMiTrabajoValidador({ ...FILTROS, search: 'ronda 11' })).total).toBe(1);
    } finally { spy.mockRestore(); }
  });

  it('no crea nueva ronda ni termina la espera al subir un PDF antes del handoff de Calidad', async () => {
    expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: false, cantidadComentarios: 1, comentariosUrl: 'https://drive.google.com/comentado', checklist: lista() })).status).toBe(200);
    expect((await call('POST', `/diseno/${disenoId}/versiones`, { enlace: 'https://drive.google.com/nuevo-pdf', entregaKey: randomUUID() }, cookies.disenador)).status).toBe(201);
    const waiting = await listarMiTrabajoValidador({ ...FILTROS, tab: 'waiting' });
    expect(waiting).toMatchObject({ total: 1, counts: { active: 0, waiting: 1, completed: 0, all: 1 } });
    expect(waiting.items[0]).toMatchObject({ id: faseId, actionable: false });
  });

  it('pausa y bloqueo impiden iniciar y resolver incluso accediendo directamente a la API', async () => {
    await db.update(proyectos).set({ estado: 'pausado' }).where(eq(proyectos.id, p.id));
    expect((await obtenerDetalleTrabajoValidador(faseId))?.summary).toMatchObject({ actionable: false, paused: true, deadline: null });
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, {})).status).toBe(409);
    expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: true, cantidadComentarios: 0, checklist: lista() })).status).toBe(409);
    await db.update(proyectos).set({ estado: 'en_proceso' }).where(eq(proyectos.id, p.id));
    const detail = await obtenerDetalleTrabajoValidador(faseId);
    await db.update(workItems).set({ estado: 'bloqueado', gateBloqueante: 'Falta confirmar el material fuente' }).where(eq(workItems.id, detail!.summary.workItemId));
    expect((await obtenerDetalleTrabajoValidador(faseId))?.summary).toMatchObject({ actionable: false, blockedReason: 'Falta confirmar el material fuente' });
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, {})).status).toBe(409);
    expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: true, cantidadComentarios: 0, checklist: lista() })).status).toBe(409);
  });

  it('preserva resultado y materiales al culminar el proyecto y rechaza modificaciones históricas', async () => {
    expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: true, cantidadComentarios: 0, checklist: lista(), observaciones: 'Revisión registrada.' })).status).toBe(200);
    await db.update(proyectos).set({ estado: 'culminado' }).where(eq(proyectos.id, p.id));
    const detail = await obtenerDetalleTrabajoValidador(faseId);
    expect(detail).toMatchObject({ approved: true, observations: 'Revisión registrada.', summary: { status: 'completed', actionable: false } });
    expect(detail!.materials).toHaveLength(2);
    expect((await call('PATCH', `/calidad/${faseId}/inicio`, {})).status).toBe(409);
  });

  it('revisión final de la misma versión referencia la ronda anterior sin confundir ronda y archivo', async () => {
    const previousId = faseId;
    expect((await call('PATCH', `/calidad/${faseId}/resultado`, { aprobar: true, cantidadComentarios: 0, checklist: lista() })).status).toBe(200);
    expect((await call('PATCH', `/calidad/${faseId}/coordinacion`, { accion: 'enviar_autor' }, cookies.especialista)).status).toBe(200);
    expect((await call('PATCH', `/calidad/${faseId}/coordinacion`, { accion: 'aprobar_autor' }, cookies.especialista)).status).toBe(200);
    expect((await call('PATCH', `/calidad/${faseId}/coordinacion`, { accion: 'revision_final' }, cookies.especialista)).status).toBe(200);
    const list = await listarMiTrabajoValidador(FILTROS), detail = await obtenerDetalleTrabajoValidador(list.items[0]!.id);
    expect(detail).toMatchObject({ summary: { numeroFase: 3, ronda: 1, versionLabel: 'V1', cta: 'Iniciar revisión final' }, previousRound: { id: previousId, label: 'F1.1' } });
    expect((await obtenerDetalleTrabajoValidador(previousId))?.reviewedBy).toBe(soporte.nombre);
  });
});
