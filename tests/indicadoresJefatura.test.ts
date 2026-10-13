import { randomUUID } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { and, eq } from 'drizzle-orm';
import { buildApp } from '../server/app.js';
import { db, pool } from '../server/db/client.js';
import {
  auditLogs,
  proyectos,
  users,
  servicios,
  projectAssignments,
  correcciones,
  workItems,
  fichasTrazabilidad,
  fichaCalidadFases,
  pausas,
} from '../server/db/schema/index.js';
import {
  obtenerIndicadoresJefatura,
  csvIndicadoresJefatura,
} from '../server/helpers/indicadoresJefatura.js';
import { actualizarProyecto } from '../server/helpers/proyectos.js';
import {
  obtenerDashboardJefatura,
  decidirExpressJefatura,
} from '../server/helpers/jefatura.js';
import { createSession } from '../server/helpers/session.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearProyectoDePrueba } from './helpers/fixtures.js';

const app = buildApp(),
  ahora = new Date('2026-10-11T16:00:00Z');
const rango = { from: '2026-10-01', to: '2026-10-11' };
let jefe: string, a: string, b: string, cookie: string;
async function usuario(
  rol: typeof users.$inferInsert.rol,
  nombre = rol as string,
) {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    rol,
    nombre,
    email: `${id}@panhouse.test`,
    passwordHash: 'session-only',
  });
  return id;
}
async function proyecto(extra: Partial<typeof proyectos.$inferInsert> = {}) {
  const p = await crearProyectoDePrueba();
  await db
    .update(proyectos)
    .set({
      notificadoJefatura: true,
      fechaProgramadaInicio: '2026-10-01',
      ...extra,
    })
    .where(eq(proyectos.id, p.id));
  return p;
}
async function evento(
  id: string,
  accion: string,
  fecha: string,
  detalles?: object,
) {
  await db.insert(auditLogs).values({
    actorId: jefe,
    proyectoId: id,
    entityType: 'proyecto',
    entityId: id,
    accion,
    detalles,
    createdAt: new Date(fecha),
  });
}
const get = (url: string, session = cookie) =>
  app.inject({
    method: 'GET',
    url,
    headers: session ? { cookie: session } : {},
  });
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(async () => {
  await limpiarBaseDeDatos();
  jefe = await usuario('jefe_area');
  a = await usuario('especialista', 'Ana');
  b = await usuario('especialista', 'Beatriz');
  cookie = `panhouse_sid=${await createSession(jefe)}`;
});
describe('Indicadores: fuentes nativas, filtros y exportación', () => {
  it('Express confirmado se distingue de posible y no cambia la carga', async () => {
    const p = await proyecto({
      especialistaId: a,
      fechaDeseadaAutor: '2026-10-31',
    });
    await proyecto({ especialistaId: b, fechaDeseadaAutor: '2026-10-31' });
    const ex = (await obtenerDashboardJefatura(ahora)).proyectos.find(
      (x) => x.id === p.id,
    )!.express;
    await decidirExpressJefatura(p.id, jefe, {
      decision: 'confirmado',
      fechaDeseada: ex.fechaDeseada!,
      fechaEstandar: ex.fechaEstandar!,
      motivo: 'Compromiso confirmado',
    });
    const d = await obtenerIndicadoresJefatura(rango, ahora);
    expect(d.resumen).toMatchObject({
      express: 1,
      expressPosibles: 1,
      cargaEquipo: 8,
    });
    expect(
      (
        await obtenerIndicadoresJefatura(
          { ...rango, prioridad: 'confirmado' },
          ahora,
        )
      ).resumen.activos,
    ).toBe(1);
  });
  it('Crudo conserva el mismo peso para los dos subtipos y los desglosa', async () => {
    const p = await proyecto({ especialistaId: a });
    await db
      .update(servicios)
      .set({ codigo: 'CR', nombre: 'Crudo', pesoComplejidad: 3 })
      .where(eq(servicios.id, p.servicioId));
    await db
      .insert(fichasTrazabilidad)
      .values({ proyectoId: p.id, ingresoServicioSubtipoCrudo: 'Tripa' });
    const q = await proyecto({ especialistaId: b, servicioId: p.servicioId });
    await db
      .insert(fichasTrazabilidad)
      .values({ proyectoId: q.id, ingresoServicioSubtipoCrudo: 'Capítulo' });
    const d = await obtenerIndicadoresJefatura(rango, ahora);
    expect(d.resumen.cargaEquipo).toBe(6);
    expect(d.servicios).toHaveLength(2);
    expect(d.servicios.map((s) => s.carga)).toEqual([3, 3]);
  });
  it('Calidad sin deadline no fabrica SLA y el promedio excluye pausas', async () => {
    const p = await proyecto({ especialistaId: a });
    const [f] = await db
      .insert(fichasTrazabilidad)
      .values({ proyectoId: p.id })
      .returning();
    await db
      .insert(fichaCalidadFases)
      .values({
        fichaId: f!.id,
        numeroFase: 1,
        aprobado: false,
        iniciadoEn: new Date('2026-10-03T12:00:00Z'),
        revisadoEn: new Date('2026-10-03T18:00:00Z'),
      });
    await db
      .insert(pausas)
      .values({
        proyectoId: p.id,
        causa: 'autor',
        fechaInicio: new Date('2026-10-03T13:00:00Z'),
        fechaFin: new Date('2026-10-03T15:00:00Z'),
      });
    const d = await obtenerIndicadoresJefatura(rango, ahora);
    expect(d.sla).toMatchObject({
      entregas: 1,
      medibles: 0,
      cumplimiento: null,
      promedioHoras: 4,
    });
    expect(d.etapas.find((e) => e.id === 'fase_calidad_1')?.sla.entregas).toBe(
      1,
    );
  });
  it('eventos futuros no cuentan y personas inactivas mantienen carga sin recomendarse', async () => {
    const p = await proyecto({ especialistaId: a });
    await db.update(users).set({ activo: false }).where(eq(users.id, a));
    await evento(p.id, 'JEFATURA_NOTIFICADA', '2026-10-12T12:00:00Z');
    const d = await obtenerIndicadoresJefatura(rango, ahora);
    expect(d.actividad.ingresos).toBe(0);
    expect(d.equipo.find((e) => e.id === a)).toMatchObject({
      habilitado: false,
      activos: 1,
      carga: 4,
    });
    expect(d.menorCargaId).toBe(b);
  });
  it('protege JSON y CSV por rol, incluso Dirección', async () => {
    for (const url of [
      '/api/jefatura/indicadores',
      '/api/jefatura/indicadores/export.csv',
    ]) {
      expect((await get(url, '')).statusCode).toBe(401);
      for (const rol of [
        'especialista',
        'direccion',
        'soporte_editorial',
      ] as const) {
        const id = await usuario(rol);
        expect(
          (await get(url, `panhouse_sid=${await createSession(id)}`))
            .statusCode,
        ).toBe(403);
      }
      expect((await get(url)).statusCode).toBe(200);
    }
  });
  it('rechaza fechas imposibles, rangos incompletos, largos y filtros ajenos', async () => {
    for (const q of [
      'from=2026-02-30&to=2026-03-01',
      'from=2026-10-01',
      'from=2026-10-11&to=2026-10-01',
      'from=2025-01-01&to=2026-10-11',
      'estado=otro',
      'especialistaId=no-uuid',
      'ahora=2026-01-01',
    ])
      expect((await get(`/api/jefatura/indicadores?${q}`)).statusCode).toBe(
        400,
      );
  });
  it('vacío distingue cero observado y SLA sin muestras', async () => {
    const d = await obtenerIndicadoresJefatura(rango, ahora);
    expect(d.resumen.activos).toBe(0);
    expect(d.resumen.cierres).toBe(0);
    expect(d.equipo).toHaveLength(2);
    expect(d.sla.cumplimiento).toBeNull();
    expect(d.sla.promedioHoras).toBeNull();
    expect(d.meses).toHaveLength(12);
  });
  it('carga usa el peso del catálogo, incluye pausados y respeta asignación canónica', async () => {
    const p = await proyecto({ especialistaId: a, estado: 'pausado' });
    await db
      .update(servicios)
      .set({ pesoComplejidad: 9 })
      .where(eq(servicios.id, p.servicioId));
    await db.insert(projectAssignments).values({
      proyectoId: p.id,
      usuarioId: b,
      tipo: 'especialista',
      asignadoPorId: jefe,
    });
    const u = await proyecto();
    await db
      .update(servicios)
      .set({ pesoComplejidad: 2 })
      .where(eq(servicios.id, u.servicioId));
    const d = await obtenerIndicadoresJefatura(rango, ahora);
    expect(d.resumen).toMatchObject({
      activos: 2,
      porAsignar: 1,
      cargaEquipo: 9,
      cargaSinAsignar: 2,
    });
    expect(d.equipo.find((e) => e.id === b)?.carga).toBe(9);
    expect(d.equipo.find((e) => e.id === a)?.carga).toBe(0);
    expect(d.proyectos.find((x) => x.id === p.id)?.especialistaId).toBe(b);
  });
  it('el período no convierte la cartera actual en una reconstrucción histórica', async () => {
    await proyecto({ especialistaId: a });
    const d = await obtenerIndicadoresJefatura(
      { from: '2026-01-01', to: '2026-01-31' },
      ahora,
    );
    expect(d.resumen.activos).toBe(1);
    expect(d.actividad.ingresos).toBe(0);
  });
  it('ingresos provienen del traspaso a Jefatura y usan el día de Caracas', async () => {
    const p = await proyecto({ createdAt: new Date('2026-01-01T12:00:00Z') });
    await evento(p.id, 'JEFATURA_NOTIFICADA', '2026-10-01T03:59:59Z');
    const q = await proyecto();
    await evento(q.id, 'JEFATURA_NOTIFICADA', '2026-10-01T04:00:00Z');
    await proyecto();
    const d = await obtenerIndicadoresJefatura(rango, ahora);
    expect(d.actividad.ingresos).toBe(1);
    expect(d.actividad.anterior.ingresos).toBe(1);
    expect(d.cobertura.ingresosSinFecha).toBe(1);
  });
  it('culminados heredados no usan updatedAt como fecha ni atribuyen falsos cierres', async () => {
    await proyecto({
      especialistaId: a,
      estado: 'culminado',
      updatedAt: ahora,
    });
    const d = await obtenerIndicadoresJefatura(rango, ahora);
    expect(d.resumen.cierres).toBeNull();
    expect(d.cobertura.culminadosSinFecha).toBe(1);
    expect(d.meses.every((m) => m.cierres === null)).toBe(true);
  });
  it('el cierre conserva el responsable original después de una reasignación y no duplica reaperturas', async () => {
    const p = await proyecto({ especialistaId: b, estado: 'culminado' });
    await evento(p.id, 'PROYECTO_ESTADO_CAMBIADO', '2026-10-03T12:00:00Z', {
      anterior: 'en_proceso',
      nuevo: 'culminado',
      especialistaId: a,
    });
    await evento(p.id, 'PROYECTO_ESTADO_CAMBIADO', '2026-10-08T12:00:00Z', {
      anterior: 'en_proceso',
      nuevo: 'culminado',
      especialistaId: b,
    });
    const d = await obtenerIndicadoresJefatura(
      { ...rango, especialistaId: a },
      ahora,
    );
    expect(d.resumen.cierres).toBe(1);
    expect(d.equipo.find((e) => e.id === a)?.cierres).toBe(1);
    expect(d.proyectos).toHaveLength(1);
    expect(
      (await obtenerIndicadoresJefatura({ ...rango, especialistaId: b }, ahora))
        .resumen.cierres,
    ).toBe(0);
  });
  it('registrar el cambio de estado es atómico e idempotente para repeticiones', async () => {
    const p = await proyecto({ especialistaId: a });
    const actor = { id: a, rol: 'especialista' as const };
    await actualizarProyecto(p.id, { estado: 'culminado' }, actor);
    await actualizarProyecto(p.id, { estado: 'culminado' }, actor);
    const logs = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.proyectoId, p.id),
          eq(auditLogs.accion, 'PROYECTO_ESTADO_CAMBIADO'),
        ),
      );
    expect(logs).toHaveLength(1);
    expect(logs[0]?.detalles).toEqual({
      anterior: 'en_proceso',
      nuevo: 'culminado',
      especialistaId: a,
    });
    const q = await proyecto({ especialistaId: a });
    await expect(
      actualizarProyecto(
        q.id,
        { estado: 'culminado' },
        { ...actor, id: randomUUID() },
      ),
    ).rejects.toThrow();
    expect(
      (await db.select().from(proyectos).where(eq(proyectos.id, q.id)))[0]
        ?.estado,
    ).toBe('en_proceso');
  });
  it('filtros de servicio, estado y especialista restringen el mismo ámbito', async () => {
    const p = await proyecto({ especialistaId: a });
    await proyecto({ especialistaId: b, estado: 'stand_by' });
    const d = await obtenerIndicadoresJefatura(
      {
        ...rango,
        servicioId: p.servicioId,
        especialistaId: a,
        estado: 'en_proceso',
      },
      ahora,
    );
    expect(d.resumen.activos).toBe(1);
    expect(d.equipo).toHaveLength(1);
    expect(d.servicios).toHaveLength(1);
    expect(
      (
        await obtenerIndicadoresJefatura(
          { ...rango, especialistaId: 'sin_asignar' },
          ahora,
        )
      ).equipo,
    ).toHaveLength(0);
  });
  it('las entregas sin hora cuentan como entrega pero no fabrican un SLA', async () => {
    const p = await proyecto({ especialistaId: a });
    for (let i = 0; i < 2; i++) {
      const [w] = await db
        .insert(workItems)
        .values({
          proyectoId: p.id,
          tipo: 'correccion',
          businessKey: `ronda-${i}`,
          estado: 'completado',
        })
        .returning();
      await db.insert(correcciones).values({
        proyectoId: p.id,
        workItemId: w!.id,
        alcance: 'preliminares',
        fechaEntrega: '2026-10-03',
        ...(i
          ? {
              entregadoEn: new Date('2026-10-03T18:00:00Z'),
              iniciadoEn: new Date('2026-10-03T12:00:00Z'),
              dueAt: new Date('2026-10-03T17:00:00Z'),
            }
          : {}),
      });
    }
    const d = await obtenerIndicadoresJefatura(rango, ahora);
    expect(d.sla).toMatchObject({
      entregas: 2,
      medibles: 1,
      enPlazo: 0,
      fueraPlazo: 1,
      cumplimiento: 0,
      promedioHoras: 6,
      muestrasTiempo: 1,
    });
    expect(d.etapas.find((e) => e.id === 'correccion')?.sla.entregas).toBe(2);
  });
  it('CSV conserva Unicode, comillas y filtros; neutraliza fórmulas', async () => {
    await db
      .update(users)
      .set({ nombre: '=SUM(1,2) "Ána"\nOtra' })
      .where(eq(users.id, a));
    const d = await obtenerIndicadoresJefatura(rango, ahora),
      csv = csvIndicadoresJefatura(d);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"\'=SUM(1,2) ""Ána""\nOtra"');
    expect(csv).toContain('"2026-10-01","2026-10-11"');
    const r = await get(
      '/api/jefatura/indicadores/export.csv?from=2026-10-01&to=2026-10-11',
    );
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['cache-control']).toBe('private, no-store');
  });
  it('consulta en lotes: las fuentes adicionales no crecen por proyecto', async () => {
    await proyecto();
    const query = vi.spyOn(pool, 'query');
    await obtenerIndicadoresJefatura(rango, ahora);
    const firstCount = query.mock.calls.length;
    query.mockClear();
    for (let i = 0; i < 10; i++) await proyecto();
    query.mockClear();
    try {
      expect(
        (await obtenerIndicadoresJefatura(rango, ahora)).proyectos,
      ).toHaveLength(11);
      expect(query.mock.calls.length).toBe(firstCount);
      expect(firstCount).toBeLessThanOrEqual(15);
    } finally {
      query.mockRestore();
    }
  });
});
