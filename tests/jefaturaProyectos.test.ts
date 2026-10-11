import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import {
  auditLogs,
  autores,
  fichasTrazabilidad,
  projectAssignments,
  proyectos,
  proyectosAutores,
  servicios,
  users,
  workItems,
} from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import { decidirExpressJefatura } from '../server/helpers/jefatura.js';
import { obtenerPortafolioJefatura } from '../server/helpers/jefaturaProyectos.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import {
  crearFichaComercialCompleta,
  crearProyectoDePrueba,
} from './helpers/fixtures.js';

const app = buildApp();
let cookie: string;
let jefe: string;
let especialista: string;
const base = '/api/jefatura/proyectos';
async function user(
  rol:
    | 'jefe_area'
    | 'especialista'
    | 'comercial'
    | 'rrpp'
    | 'editor' = 'especialista',
  activo = true,
) {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    rol,
    activo,
    nombre: `Persona ${id.slice(0, 5)}`,
    email: `${id}@panhouse.test`,
    passwordHash: 'session-only',
  });
  return id;
}
async function p(extra: Partial<typeof proyectos.$inferInsert> = {}) {
  const project = await crearProyectoDePrueba();
  await db
    .update(proyectos)
    .set({
      notificadoJefatura: true,
      notificadoRrpp: true,
      fechaProgramadaInicio: '2026-10-10',
      ...extra,
    })
    .where(eq(proyectos.id, project.id));
  return project;
}
const get = (path = '', session = cookie) =>
  app.inject({
    method: 'GET',
    url: `${base}${path}`,
    headers: session ? { cookie: session } : {},
  });
beforeAll(async () => app.ready());
afterAll(async () => app.close());
beforeEach(async () => {
  await limpiarBaseDeDatos();
  jefe = await user('jefe_area');
  especialista = await user();
  cookie = `panhouse_sid=${await createSession(jefe)}`;
});

describe('Explorador de proyectos de Jefatura', () => {
  it('Jefatura no puede crear proyectos por la API', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/proyectos',
      headers: { cookie },
      payload: {},
    });
    expect(response.statusCode).toBe(403);
  });
  it('vacío: contadores, paginación y filtros sin datos ficticios', async () => {
    const r = await get();
    expect(r.statusCode).toBe(200);
    expect(r.json().counts).toEqual({
      todos: 0,
      porAsignar: 0,
      enProduccion: 0,
      enRiesgo: 0,
      express: 0,
      completados: 0,
    });
    expect(r.json().pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 0,
      pages: 1,
    });
  });
  it('excluye pre-handoff y retirados; incluye entregados y culminados', async () => {
    await p({ notificadoJefatura: false });
    await p({ estado: 'retirado' });
    const entregado = await p();
    const cerrado = await p({ estado: 'culminado' });
    const r = (await get()).json();
    expect(r.items.map((i: { id: string }) => i.id).sort()).toEqual(
      [entregado.id, cerrado.id].sort(),
    );
    expect(r.counts.porAsignar).toBe(1);
    expect(r.counts.completados).toBe(1);
  });
  it('mantiene compatibilidad de asignados legacy sin handoff', async () => {
    const legacy = await p({
      notificadoJefatura: false,
      especialistaId: especialista,
    });
    expect((await get()).json().items[0].id).toBe(legacy.id);
    expect((await get(`/${legacy.id}/resumen`)).statusCode).toBe(200);
  });
  it('Por asignar coincide exactamente con Inicio y Asignaciones', async () => {
    await p();
    await p();
    await p({ especialistaId: especialista });
    await p({ estado: 'culminado' });
    const port = (await get('?tab=porAsignar')).json();
    const home = (
      await app.inject({ url: '/api/jefatura/dashboard', headers: { cookie } })
    ).json();
    const assignments = (
      await app.inject({
        url: '/api/jefatura/asignaciones',
        headers: { cookie },
      })
    ).json();
    expect(port.counts.porAsignar).toBe(home.summary.porAsignar);
    expect(port.items.map((i: { id: string }) => i.id).sort()).toEqual(
      assignments.proyectos.map((i: { id: string }) => i.id).sort(),
    );
  });
  it('assignment activo gana sobre FK y el historial finalizado no es equipo actual', async () => {
    const old = await user();
    const project = await p({ especialistaId: old });
    await db.insert(projectAssignments).values([
      {
        proyectoId: project.id,
        usuarioId: old,
        tipo: 'especialista',
        finalizadoEn: new Date(),
      },
      { proyectoId: project.id, usuarioId: especialista, tipo: 'especialista' },
    ]);
    const detail = (await get(`/${project.id}/resumen`)).json();
    expect(detail.proyecto.especialista.id).toBe(especialista);
    expect(
      detail.equipo.filter((a: { rol: string }) => a.rol === 'especialista'),
    ).toHaveLength(1);
    expect((await get('?tab=porAsignar')).json().items).toHaveLength(0);
  });
  it('asignar por el flujo existente actualiza listado, quick view y CTA', async () => {
    const project = await p();
    expect(
      (await get(`/${project.id}/resumen`)).json().proyecto.recomendacion,
    ).toBeTruthy();
    const res = await app.inject({
      method: 'PATCH',
      url: `${base}/${project.id}/especialista`,
      headers: { cookie },
      payload: {
        especialistaId: especialista,
        especialistaActualEsperado: null,
      },
    });
    expect(res.statusCode).toBe(200);
    const detail = (await get(`/${project.id}/resumen`)).json();
    expect(detail.proyecto.especialista.id).toBe(especialista);
    expect(detail.proyecto.porAsignar).toBe(false);
    expect(detail.proyecto.recomendacion).toBeNull();
    expect((await get('?tab=porAsignar')).json().pagination.total).toBe(0);
    const [persona] = await db
      .select({ nombre: users.nombre })
      .from(users)
      .where(eq(users.id, especialista));
    const activity = (await get(`/${project.id}/actividad`)).json();
    expect(
      activity.actividad.some((a: { texto: string }) =>
        a.texto.includes(persona!.nombre),
      ),
    ).toBe(true);
  });
  it('producción exige Especialista y procesos editoriales abiertos; pausa conserva ámbito', async () => {
    const project = await p({ especialistaId: especialista });
    await p({ especialistaId: especialista });
    await p({ estado: 'pausado', especialistaId: especialista });
    await p({ estado: 'stand_by' });
    await db.insert(workItems).values({
      proyectoId: project.id,
      tipo: 'edicion',
      estado: 'en_progreso',
    });
    expect(
      (await get('?tab=enProduccion'))
        .json()
        .items.map((i: { id: string }) => i.id),
    ).toEqual([project.id]);
    expect((await get('?estado=pausado')).json().pagination.total).toBe(1);
    expect((await get('?estado=standBy')).json().pagination.total).toBe(1);
    expect((await get()).json().counts.todos).toBe(4);
  });
  it('filtro Servicio proviene del catálogo y solo devuelve ese servicio', async () => {
    const a = await p();
    await p();
    const result = (await get(`?servicioId=${a.servicioId}`)).json();
    expect(result.items.map((i: { id: string }) => i.id)).toEqual([a.id]);
    expect(
      result.filters.servicios.some(
        (s: { id: string }) => s.id === a.servicioId,
      ),
    ).toBe(true);
  });
  it('Especialista / Sin asignar usa ownership canónico y solo ofrece activos', async () => {
    await user('especialista', false);
    const a = await p({ especialistaId: especialista });
    const b = await p();
    expect(
      (await get(`?especialistaId=${especialista}`)).json().items[0].id,
    ).toBe(a.id);
    expect((await get('?especialistaId=sinAsignar')).json().items[0].id).toBe(
      b.id,
    );
    expect((await get()).json().filters.especialistas).toHaveLength(1);
  });
  it('busca título, código, autor y coautor sin distinguir acentos', async () => {
    const project = await p({
      tituloDefinitivo: 'El jardín de octubre',
      codigo: 'LIB2026',
    });
    const coautorId = randomUUID();
    await db
      .insert(autores)
      .values({ id: coautorId, nombre: 'María Coautora' });
    await db
      .insert(proyectosAutores)
      .values({ proyectoId: project.id, autorId: coautorId });
    for (const q of ['jardin', 'LIB2026', 'Maria Coautora'])
      expect(
        (await get(`?q=${encodeURIComponent(q)}`)).json().pagination.total,
      ).toBe(1);
    expect((await get(`?q=${project.id}`)).json().pagination.total).toBe(0);
  });
  it('Express solo cuenta confirmados vigentes, no posibles ni históricos', async () => {
    const project = await p({ fechaDeseadaAutor: '2027-01-01' });
    const posible = await p({ fechaDeseadaAutor: '2027-01-01' });
    const detail = (await get(`/${project.id}/resumen`)).json();
    await decidirExpressJefatura(project.id, jefe, {
      decision: 'confirmado',
      fechaDeseada: detail.proyecto.express.fechaDeseada,
      fechaEstandar: detail.proyecto.express.fechaEstandar,
    });
    const r = (await get('?tab=express')).json();
    expect(r.counts.express).toBe(1);
    expect(r.items[0].id).toBe(project.id);
    expect(
      (await get(`/${posible.id}/resumen`)).json().proyecto.express.estado,
    ).toBe('posible');
    expect(
      (await get(`/${project.id}/resumen`)).json().proyecto.express
        .compresionDias,
    ).toBe(detail.proyecto.express.compresionDias);
    await db
      .update(proyectos)
      .set({ estado: 'culminado' })
      .where(eq(proyectos.id, project.id));
    expect((await get('?tab=express')).json().counts.express).toBe(0);
  });
  it('riesgo coincide con Inicio y su contador produce exactamente el mismo conjunto', async () => {
    const a = await p({ estado: 'retrasado' });
    const b = await p({ especialistaId: especialista });
    await p();
    await db
      .insert(workItems)
      .values({ proyectoId: b.id, tipo: 'diseno', estado: 'bloqueado' });
    const result = (await get('?tab=enRiesgo')).json();
    const home = (
      await app.inject({ url: '/api/jefatura/dashboard', headers: { cookie } })
    ).json();
    expect(result.counts.enRiesgo).toBe(home.summary.enRiesgo);
    expect(result.pagination.total).toBe(result.counts.enRiesgo);
    expect(result.items.map((i: { id: string }) => i.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    expect(
      (await get(`/${b.id}/resumen`)).json().proyecto.riesgo.causas,
    ).toContain('Proceso bloqueado');
  });
  it('culminado explícito no requiere ausencia de tareas; no genera riesgo ni asignación', async () => {
    const project = await p({
      estado: 'culminado',
      fechaProgramadaInicio: '2020-01-01',
    });
    await db
      .insert(workItems)
      .values({ proyectoId: project.id, tipo: 'diseno', estado: 'bloqueado' });
    const d = (await get(`/${project.id}/resumen`)).json();
    expect(d.proyecto.riesgo.atencion).toBe(false);
    expect(d.proyecto.porAsignar).toBe(false);
    expect(d.proyecto.recomendacion).toBeNull();
    expect((await get('?tab=completados')).json().items[0].id).toBe(project.id);
  });
  it.each(['Tripa', 'Capítulo'] as const)(
    'Crudo %s usa dato canónico RRPP y plazo central',
    async (subtipo) => {
      const project = await p();
      await db
        .update(servicios)
        .set({ codigo: 'CR', nombre: 'Crudo' })
        .where(eq(servicios.id, project.servicioId));
      await crearFichaComercialCompleta(project.id);
      await db
        .update(fichasTrazabilidad)
        .set({
          ingresoServicioSubtipoCrudo: subtipo,
          matrizDiagnosticoGenerado: true,
          matrizIngresoGenerado: true,
        })
        .where(eq(fichasTrazabilidad.proyectoId, project.id));
      const list = (await get()).json().items[0];
      const detail = (await get(`/${project.id}/resumen`)).json();
      expect(list.servicio.nombre).toContain(subtipo);
      expect(detail.proyecto.servicio.nombre).toBe(list.servicio.nombre);
      expect(detail.contexto.subtipoCrudo).toBe(subtipo);
      expect(list.express.plazoBaseDias).toBe(subtipo === 'Tripa' ? 90 : 150);
      expect(detail.contexto.rrpp).toBe('Completo');
    },
  );
  it('Crudo legacy sin subtipo no inventa clasificación, objetivo ni plazo', async () => {
    const project = await p();
    await db
      .update(servicios)
      .set({ codigo: 'CR', nombre: 'Crudo' })
      .where(eq(servicios.id, project.servicioId));
    const d = (await get(`/${project.id}/resumen`)).json();
    expect(d.proyecto.datoIncompleto).toBe(true);
    expect(d.proyecto.fechaObjetivo).toBeNull();
    expect(d.proyecto.express.plazoBaseDias).toBeNull();
    expect(d.contexto.rrpp).toBe('Dato incompleto');
  });
  it('quick view: ingreso real, portada aprobada, equipo y hitos paralelos', async () => {
    const project = await p({
      especialistaId: especialista,
      propuestaPortadaUrl: 'https://example.test/cover.webp',
      portadaDecisionAutor: 'aprobada',
    });
    await crearFichaComercialCompleta(project.id);
    const editor = await user('editor');
    await db
      .insert(projectAssignments)
      .values({ proyectoId: project.id, tipo: 'editor', usuarioId: editor });
    await db.insert(workItems).values([
      { proyectoId: project.id, tipo: 'edicion', estado: 'en_progreso' },
      { proyectoId: project.id, tipo: 'diseno', estado: 'en_progreso' },
    ]);
    const d = (await get(`/${project.id}/resumen`)).json();
    expect(d.contexto.comercial).toBe('Completo');
    expect(d.contexto.paginas).toBe('100');
    expect(d.proyecto.portadaUrl).toContain('cover.webp');
    expect(d.equipo.map((a: { rol: string }) => a.rol).sort()).toEqual([
      'editor',
      'especialista',
    ]);
    expect(d.hitos).toHaveLength(2);
  });
  it('actividad es local al proyecto, legible y no expone JSON', async () => {
    const project = await p();
    const other = await p();
    await db.insert(auditLogs).values([
      {
        proyectoId: project.id,
        entityId: project.id,
        entityType: 'proyecto',
        accion: 'CORRECCION_INICIADA',
        actorId: jefe,
        detalles: { interno: 'No exponer' },
      },
      {
        proyectoId: other.id,
        entityId: other.id,
        entityType: 'proyecto',
        accion: 'JEFATURA_NOTIFICADA',
      },
    ]);
    const r = await get(`/${project.id}/actividad`);
    expect(r.json().actividad).toHaveLength(1);
    expect(r.json().actividad[0].texto.toLocaleLowerCase('es')).toContain('corrección');
    expect(r.body).not.toContain('No exponer');
  });
  it('paginación real, orden estable y límite de página; counts independientes de filtros', async () => {
    for (let i = 0; i < 12; i++)
      await p({ codigo: `BOOK${String(i).padStart(2, '0')}` });
    const first = (await get('?page=1')).json();
    const second = (await get('?page=2')).json();
    expect(first.items).toHaveLength(10);
    expect(second.items).toHaveLength(2);
    expect(second.pagination).toEqual({
      page: 2,
      pageSize: 10,
      pages: 2,
      total: 12,
    });
    expect(
      second.items.some((a: { id: string }) =>
        first.items.some((b: { id: string }) => a.id === b.id),
      ),
    ).toBe(false);
    expect((await get('?page=999')).json().pagination.page).toBe(2);
    expect((await get('?q=imposible')).json().counts.todos).toBe(12);
    expect((await get('?q=imposible')).json().tabCounts.todos).toBe(0);
  });
  it('RBAC y validación de filtros rechazan consultas no autorizadas o inválidas', async () => {
    expect((await get('', '')).statusCode).toBe(401);
    for (const rol of ['rrpp', 'comercial', 'editor', 'especialista'] as const)
      expect(
        (await get('', `panhouse_sid=${await createSession(await user(rol))}`))
          .statusCode,
      ).toBe(403);
    for (const q of [
      '?tab=inválido',
      '?page=0',
      '?pageSize=100',
      '?servicioId=mal',
      '?especialistaId=mal',
      '?estado=otro',
      '?extra=1',
    ])
      expect((await get(q)).statusCode).toBe(400);
  });
  it('IDOR: resumen y actividad ocultan proyectos ajenos al ámbito e IDs inexistentes', async () => {
    const project = await p({ notificadoJefatura: false });
    for (const id of [project.id, randomUUID()])
      for (const route of ['resumen', 'actividad'])
        expect((await get(`/${id}/${route}`)).statusCode).toBe(404);
    expect((await get('/invalid/resumen')).statusCode).toBe(400);
    expect(
      (
        await get(
          `/${project.id}/resumen`,
          `panhouse_sid=${await createSession(especialista)}`,
        )
      ).statusCode,
    ).toBe(403);
  });
  it('ocho lecturas por lotes con 1 y 31 proyectos; nunca una consulta por fila', async () => {
    const project = await p();
    const [row] = await db
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, project.id));
    const filtros = {
      tab: 'todos' as const,
      q: '',
      orden: 'urgentes' as const,
      page: 1,
      pageSize: 10,
    };
    const reads = vi.spyOn(db, 'select');
    try {
      expect((await obtenerPortafolioJefatura(filtros)).pagination.total).toBe(
        1,
      );
      expect(reads).toHaveBeenCalledTimes(8);
      reads.mockClear();
      await db.insert(proyectos).values(
        Array.from({ length: 30 }, (_, i) => ({
          ...row!,
          id: randomUUID(),
          codigo: `PERF-${i}`,
        })),
      );
      const result = await obtenerPortafolioJefatura(filtros);
      expect(reads).toHaveBeenCalledTimes(8);
      expect(result.pagination).toMatchObject({ total: 31, pages: 4 });
      expect(result.items).toHaveLength(10);
    } finally {
      reads.mockRestore();
    }
  });
});
