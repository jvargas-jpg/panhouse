import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';
import { and, eq, isNull } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import {
  auditLogs,
  autores,
  correcciones,
  fichaCalidadFases,
  fichasTrazabilidad,
  pagos,
  pausas,
  projectAssignments,
  proyectos,
  seguimientoFases,
  users,
  workItems,
} from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import {
  solicitarCorreccion,
  asignarCorrector,
  marcarInicioCorreccion,
  registrarEntregaCorreccion,
} from '../server/helpers/correcciones.js';
import { listarIntervenciones } from '../server/helpers/seguimientoIntervenciones.js';
import { obtenerSeguimientoGeneral } from '../server/helpers/seguimientoGeneral.js';
import { crearAppDePrueba } from './helpers/testApp.js';
import { crearProyectoDePrueba } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

const app = crearAppDePrueba();
let jefe: typeof users.$inferSelect,
  especialista: typeof users.$inferSelect,
  corrector: typeof users.$inferSelect,
  soporte: typeof users.$inferSelect;
let p: typeof proyectos.$inferSelect,
  cookie: string,
  cookieEsp: string,
  cookieCorr: string;
const base = '/api/seguimiento';
const defaults = {
  q: '',
  grupo: 'todas' as const,
  orden: 'urgentes' as const,
  page: 1,
  pageSize: 10,
};
beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(async () => {
  await limpiarBaseDeDatos();
  [jefe, especialista, corrector, soporte] = (await db
    .insert(users)
    .values(
      ['jefe_area', 'especialista', 'corrector', 'soporte_editorial'].map(
        (rol, i) => ({
          rol: rol as typeof users.$inferInsert.rol,
          email: `tracking-${i}@test.local`,
          nombre: ['Jefatura', 'Elena Torres', 'Carlos Méndez', 'Laura Gil'][
            i
          ]!,
          passwordHash: 'session-only',
        }),
      ),
    )
    .returning()) as [
    typeof users.$inferSelect,
    typeof users.$inferSelect,
    typeof users.$inferSelect,
    typeof users.$inferSelect,
  ];
  p = await crearProyectoDePrueba({ especialistaId: especialista.id });
  await db
    .update(proyectos)
    .set({ titulo: 'Raíces del silencio', notificadoJefatura: true })
    .where(eq(proyectos.id, p.id));
  const cookies = await Promise.all(
    [jefe, especialista, corrector].map(
      async (u) => `panhouse_sid=${await createSession(u.id)}`,
    ),
  );
  cookie = cookies[0]!;
  cookieEsp = cookies[1]!;
  cookieCorr = cookies[2]!;
});
async function nueva(
  alcance:
    'tripa_completa' | 'preliminares' | 'cubierta_extendida' = 'preliminares',
  paginas = 20,
) {
  const r = await solicitarCorreccion(
    p.id,
    { alcance, paginas },
    especialista.id,
  );
  return r.id;
}
const list = (q: Record<string, string | number | undefined> = {}) =>
  request(app.server)
    .get(`${base}/intervenciones`)
    .query(q)
    .set('Cookie', cookie);
const patch = (id: string, b: object, origen = 'correccion') =>
  request(app.server)
    .patch(`${base}/intervenciones/${origen}/${id}`)
    .set('Cookie', cookie)
    .send(b);
async function fase(n = 1, ronda = 1, reviewed = false) {
  let [f] = await db
    .select()
    .from(fichasTrazabilidad)
    .where(eq(fichasTrazabilidad.proyectoId, p.id));
  if (!f)
    [f] = await db
      .insert(fichasTrazabilidad)
      .values({ proyectoId: p.id })
      .returning();
  const [q] = await db
    .insert(fichaCalidadFases)
    .values({
      fichaId: f!.id,
      numeroFase: n,
      ronda,
      solicitadoEn: new Date(),
      ...(reviewed
        ? {
            aprobado: true,
            revisadoEn: new Date(),
            revisadoPorId: soporte.id,
            cantidadComentarios: 7,
          }
        : {}),
    })
    .returning();
  return q!;
}
describe('Seguimiento operativo integrado', () => {
  it('Vista general conserva procesos paralelos, riesgo y filtros con ocho lecturas', async () => {
    await nueva();
    await db.insert(workItems).values({
      proyectoId: p.id,
      tipo: 'edicion',
      estado: 'bloqueado',
      fechaFinPautada: '2026-01-01',
    });
    await db
      .update(proyectos)
      .set({ estado: 'pausado' })
      .where(eq(proyectos.id, p.id));
    const f = { q: '', orden: 'urgentes' as const, page: 1, pageSize: 20 };
    const spy = vi.spyOn(pool, 'query');
    const uno = await obtenerSeguimientoGeneral(f);
    // 8, no 7: obtenerSeguimientoGeneral reutiliza obtenerDashboardJefatura
    // (ver import en server/helpers/seguimientoGeneral.ts), que desde
    // Jefatura · Decisiones (docs/arquitectura/17-jefatura-decisiones.md)
    // suma UNA consulta más (resumenDecisiones, para el KPI nuevo de
    // Inicio) -- costo real y deliberado, no una regresión de N+1.
    expect(spy.mock.calls.length).toBe(8);
    spy.mockRestore();
    expect(uno.items[0]?.procesos).toHaveLength(2);
    expect(uno.counts.bloqueados).toBe(1);
    expect(uno.counts.riesgo).toBe(1);
    expect(
      (await obtenerSeguimientoGeneral({ ...f, estado: 'en_proceso' })).items,
    ).toHaveLength(0);
    expect(
      (
        await obtenerSeguimientoGeneral({
          ...f,
          riesgo: 'bloqueados',
          q: 'raices',
        })
      ).items,
    ).toHaveLength(1);
    expect(
      (
        await request(app.server)
          .get(`${base}/general/${p.id}/actividad`)
          .set('Cookie', cookieCorr)
      ).status,
    ).toBe(403);
  });
  it('sirve actividad real de notas y reasignaciones sin exponer identificadores', async () => {
    const id = await nueva();
    await asignarCorrector(
      id,
      { correctorId: corrector.id, freelance: false, contratoConfirmado: true },
      especialista.id,
    );
    await asignarCorrector(
      id,
      {
        correctorNombre: 'Ana Externa',
        freelance: true,
        contratoConfirmado: true,
      },
      especialista.id,
    );
    await patch(id, {
      observaciones: 'Acuerdo de seguimiento',
      expectedUpdatedAt: null,
    });
    const r = await request(app.server)
      .get(`${base}/intervenciones/correccion/${id}/actividad`)
      .set('Cookie', cookie);
    expect(r.status).toBe(200);
    expect(
      r.body.actividad.some(
        (a: { nota: string }) => a.nota === 'Acuerdo de seguimiento',
      ),
    ).toBe(true);
    expect(
      r.body.actividad.some((a: { texto: string }) =>
        a.texto.includes('Carlos Méndez a Ana Externa'),
      ),
    ).toBe(true);
  });
  it('revierte una nota si el mismo cambio intenta evaluar una intervención no elegible', async () => {
    const id = await nueva();
    expect(
      (
        await patch(id, {
          observaciones: 'No debe persistir',
          resultadoSeguimiento: 'regular',
          expectedUpdatedAt: null,
        })
      ).status,
    ).toBe(409);
    expect(await db.select().from(seguimientoFases)).toHaveLength(0);
    expect(
      await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.accion, 'SEGUIMIENTO_NOTA_REGISTRADA')),
    ).toHaveLength(0);
  });
  it('proyecta una solicitud real sin crear seguimiento manual', async () => {
    const id = await nueva();
    const r = await list();
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0]).toMatchObject({
      id,
      origen: 'correccion',
      estado: 'pendiente',
      proceso: 'correccion',
      material: 'preliminares',
    });
    expect(await db.select().from(seguimientoFases)).toHaveLength(0);
  });
  it('preserva tres materiales del mismo proyecto como intervenciones separadas', async () => {
    await nueva();
    await nueva('tripa_completa');
    await nueva('cubierta_extendida');
    const r = await list();
    expect(r.body.items).toHaveLength(3);
    expect(new Set(r.body.items.map((i: { id: string }) => i.id)).size).toBe(3);
  });
  it('distingue rondas posteriores de Corrección', async () => {
    const id = await nueva();
    await registrarEntregaCorreccion(id, {}, especialista.id);
    await nueva();
    const r = await list();
    expect(r.body.items.map((i: { ronda: number }) => i.ronda).sort()).toEqual([
      1, 2,
    ]);
  });
  it('integra fases y rondas reales de Calidad sin SLA inventado', async () => {
    await fase(1, 1);
    await fase(1, 2);
    await fase(2);
    await fase(3);
    const r = await list();
    expect(r.body.items).toHaveLength(4);
    expect(
      r.body.items.every(
        (i: { sla: { estado: string } }) => i.sla.estado === 'sin_sla',
      ),
    ).toBe(true);
    expect(
      r.body.items
        .filter((i: { proceso: string }) => i.proceso === 'fase_calidad_1')
        .map((i: { ronda: number }) => i.ronda)
        .sort(),
    ).toEqual([1, 2]);
  });
  it('mantiene legacy sin inventar horas ni SLA', async () => {
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    await db.insert(seguimientoFases).values({
      proyectoId: p.id,
      especialistaId: corrector.id,
      asignacionTipo: 'TEXTO CONTRAPORTADA',
      tipoServicio: 'Edición',
      fechaInicio: '2026-10-01',
      estatus: 'Entregado',
      fechaEntrega: hoy,
      totalHoras: '18',
      tiempoCorrecto: '5',
    });
    const r = await list();
    expect(r.body.counts.entregadasHoy).toBe(1);
    expect(r.body.items[0]).toMatchObject({
      origen: 'legacy',
      material: 'texto_contraportada',
      proceso: 'edicion',
      ronda: null,
      tiempos: { iniciado: null, horasEfectivas: null },
      sla: { estado: 'sin_sla' },
      registroAnterior: { 'Especialista registrado': 'Carlos Méndez' },
    });
  });
  it('no duplica la intervención al guardar supervisión', async () => {
    const id = await nueva();
    expect(
      (
        await patch(id, {
          observaciones: 'Revisar acuerdos con el equipo',
          expectedUpdatedAt: null,
        })
      ).status,
    ).toBe(200);
    expect((await list()).body.items).toHaveLength(1);
    expect(await db.select().from(seguimientoFases)).toHaveLength(1);
    expect((await db.select().from(correcciones))[0]?.fechaInicio).toBeNull();
  });
  it('registra notas con actor y valores antes/después', async () => {
    const id = await nueva();
    const r = await patch(id, {
      observaciones: 'Primera nota',
      expectedUpdatedAt: null,
    });
    expect(r.status).toBe(200);
    expect(
      (
        await patch(id, {
          observaciones: 'Acuerdo actualizado',
          expectedUpdatedAt: r.body.updatedAt,
        })
      ).status,
    ).toBe(200);
    const a = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.accion, 'SEGUIMIENTO_NOTA_REGISTRADA'));
    expect(a).toHaveLength(2);
    expect(a[1]?.actorId).toBe(jefe.id);
    expect(a[1]?.detalles).toMatchObject({
      antes: { observaciones: 'Primera nota' },
      despues: { observaciones: 'Acuerdo actualizado' },
    });
  });
  it('rechaza una versión antigua sin sobrescribir ni auditar', async () => {
    const id = await nueva();
    await patch(id, { observaciones: 'Nota vigente', expectedUpdatedAt: null });
    const r = await patch(id, {
      observaciones: 'Nota antigua',
      expectedUpdatedAt: null,
    });
    expect(r.status).toBe(409);
    expect((await list()).body.items[0].observaciones).toBe('Nota vigente');
    expect(
      await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.accion, 'SEGUIMIENTO_NOTA_REGISTRADA')),
    ).toHaveLength(1);
  });
  it('impide cambiar responsables, fechas, estados y páginas del workflow', async () => {
    const id = await nueva();
    for (const b of [
      { analistaId: corrector.id },
      { estado: 'entregado' },
      { fechaInicio: '2026-01-01' },
      { freelance: true },
    ])
      expect((await patch(id, { ...b, expectedUpdatedAt: null })).status).toBe(
        400,
      );
    expect(
      (await patch(id, { paginas: 500, expectedUpdatedAt: null })).status,
    ).toBe(403);
  });
  it('evalúa F1 únicamente después de la revisión', async () => {
    const q = await fase();
    expect(
      (
        await patch(
          q.id,
          { resultadoSeguimiento: 'regular', expectedUpdatedAt: null },
          'calidad',
        )
      ).status,
    ).toBe(409);
    await db
      .update(fichaCalidadFases)
      .set({ aprobado: true, revisadoEn: new Date() })
      .where(eq(fichaCalidadFases.id, q.id));
    expect(
      (
        await patch(
          q.id,
          {
            resultadoSeguimiento: 'deficiente',
            observacionesF1: 'Se requiere supervisión adicional',
            expectedUpdatedAt: null,
          },
          'calidad',
        )
      ).status,
    ).toBe(200);
    expect((await db.select().from(fichaCalidadFases))[0]?.aprobado).toBe(true);
  });
  it('protege los resultados operativos y comentarios de Soporte Editorial', async () => {
    const id = await nueva();
    expect(
      (
        await patch(id, {
          resultadoSeguimiento: 'buena',
          expectedUpdatedAt: null,
        })
      ).status,
    ).toBe(409);
    const q = await fase(1, 1, true);
    expect(
      (
        await patch(
          q.id,
          { cantidadComentarios: 2, expectedUpdatedAt: null },
          'calidad',
        )
      ).status,
    ).toBe(403);
    expect(
      (await list()).body.items.find((i: { id: string }) => i.id === q.id)
        .cantidadComentarios,
    ).toBe(7);
  });
  it('solo permite comentarios de corrección después de entrega', async () => {
    const id = await nueva();
    expect(
      (await patch(id, { cantidadComentarios: 4, expectedUpdatedAt: null }))
        .status,
    ).toBe(403);
    await registrarEntregaCorreccion(id, {}, especialista.id);
    expect(
      (await patch(id, { cantidadComentarios: 4, expectedUpdatedAt: null }))
        .status,
    ).toBe(200);
  });
  it('registra 80/20 freelance sin generar pagos comerciales', async () => {
    const id = await nueva();
    expect(
      (await patch(id, { pago80: true, expectedUpdatedAt: null })).status,
    ).toBe(403);
    await asignarCorrector(
      id,
      {
        correctorNombre: 'Corrector externo',
        freelance: true,
        contratoConfirmado: true,
      },
      especialista.id,
    );
    const r = await patch(id, {
      pago80: true,
      pago20: false,
      expectedUpdatedAt: null,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      freelance: true,
      pago80: true,
      pago20: false,
    });
    expect(await db.select().from(pagos)).toHaveLength(0);
  });
  it('conserva el gate de 120 páginas en el flujo de asignación', async () => {
    const id = await nueva('tripa_completa', 150);
    const r = await asignarCorrector(
      id,
      { correctorId: corrector.id, freelance: false, contratoConfirmado: true },
      especialista.id,
    );
    expect(r.ok).toBe(false);
    expect((await list()).body.items[0].gate).toMatchObject({
      requerido: true,
      confirmado: false,
    });
  });
  it('asigna timestamps reales y mantiene SLA central de 12h', async () => {
    const id = await nueva();
    await asignarCorrector(
      id,
      { correctorId: corrector.id, freelance: false, contratoConfirmado: true },
      especialista.id,
    );
    expect(
      (
        await request(app.server)
          .patch(`/api/correcciones/${id}/inicio`)
          .set('Cookie', cookieCorr)
          .send({})
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.server)
          .patch(`/api/correcciones/${id}/entrega`)
          .set('Cookie', cookieCorr)
          .send({})
      ).status,
    ).toBe(200);
    const d = (await list()).body.items[0];
    expect(d.tiempos.iniciado).not.toBeNull();
    expect(d.tiempos.entregado).not.toBeNull();
    expect(d.sla.horasObjetivo).toBe(12);
    expect(d.estado).toBe('entregado');
  });
  it('requiere motivo histórico y conserva fecha sin hora cuando falta precisión', async () => {
    const id = await nueva();
    await asignarCorrector(
      id,
      { correctorId: corrector.id, freelance: false, contratoConfirmado: true },
      especialista.id,
    );
    const url = `/api/correcciones/${id}/entrega`;
    expect(
      (
        await request(app.server)
          .patch(url)
          .set('Cookie', cookieCorr)
          .send({ fecha: '2026-01-01' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.server)
          .patch(url)
          .set('Cookie', cookieCorr)
          .send({ fecha: '2026-01-01', motivo: 'Entrega histórica comprobada' })
      ).status,
    ).toBe(200);
    expect((await list()).body.items[0].tiempos.entregado).toBeNull();
  });
  it('cierra asignación interna al reasignar a un externo y refleja responsable actual', async () => {
    const id = await nueva();
    await asignarCorrector(
      id,
      { correctorId: corrector.id, freelance: false, contratoConfirmado: true },
      especialista.id,
    );
    await asignarCorrector(
      id,
      {
        correctorNombre: 'Externo actual',
        freelance: true,
        contratoConfirmado: true,
      },
      especialista.id,
    );
    const active = await db
      .select()
      .from(projectAssignments)
      .where(
        and(
          eq(projectAssignments.tipo, 'corrector'),
          isNull(projectAssignments.finalizadoEn),
        ),
      );
    expect(active).toHaveLength(0);
    expect((await list()).body.items[0].analista.nombre).toBe('Externo actual');
  });
  it('deriva duración efectiva descontando pausas reales', async () => {
    const id = await nueva();
    await db
      .update(correcciones)
      .set({
        iniciadoEn: new Date('2026-10-10T08:00Z'),
        fechaInicio: '2026-10-10',
        entregadoEn: new Date('2026-10-10T18:00Z'),
        fechaEntrega: '2026-10-10',
      })
      .where(eq(correcciones.id, id));
    await db.insert(pausas).values({
      proyectoId: p.id,
      causa: 'autor',
      fechaInicio: new Date('2026-10-10T10:00Z'),
      fechaFin: new Date('2026-10-10T12:00Z'),
    });
    const d = (await list()).body.items[0];
    expect(d.tiempos.horasTotales).toBe(10);
    expect(d.tiempos.horasEfectivas).toBe(8);
    expect(d.tiempos.horasPausadas).toBe(2);
  });
  it('resuelve cambios de autor y Especialista desde la fuente canónica', async () => {
    await nueva();
    await db
      .update(autores)
      .set({ nombre: 'Autor actualizado' })
      .where(eq(autores.id, p.autorId));
    await db
      .insert(projectAssignments)
      .values({ proyectoId: p.id, usuarioId: jefe.id, tipo: 'especialista' });
    const d = (await list()).body.items[0];
    expect(d.proyecto.autores).toBe('Autor actualizado');
    expect(d.especialista.id).toBe(jefe.id);
  });
  it('excluye retirados y prehandoff; permite historial de culminados', async () => {
    await nueva();
    await db
      .update(proyectos)
      .set({ estado: 'retirado' })
      .where(eq(proyectos.id, p.id));
    expect((await list()).body.items).toHaveLength(0);
    await db
      .update(proyectos)
      .set({
        estado: 'en_proceso',
        especialistaId: null,
        notificadoJefatura: false,
      })
      .where(eq(proyectos.id, p.id));
    expect((await list()).body.items).toHaveLength(0);
    await db
      .update(proyectos)
      .set({ estado: 'culminado', notificadoJefatura: true })
      .where(eq(proyectos.id, p.id));
    expect((await list()).body.items).toHaveLength(1);
    expect(
      (await request(app.server).get(`${base}/general`).set('Cookie', cookie))
        .body.items,
    ).toHaveLength(0);
  });
  it('filtra búsqueda sin acentos, material, grupo y rango', async () => {
    await nueva();
    await nueva('tripa_completa');
    expect(
      (
        await list({
          q: 'raices',
          material: 'preliminares',
          grupo: 'pendientes',
        })
      ).body.pagination.total,
    ).toBe(1);
    expect(
      (await list({ from: '2000-01-01', to: '2000-01-02' })).body.pagination
        .total,
    ).toBe(0);
  });
  it('pagina en backend, limita tamaño y no crece en consultas por fila', async () => {
    await db.insert(seguimientoFases).values(
      Array.from({ length: 31 }, () => ({
        proyectoId: p.id,
        estatus: 'Pendiente',
      })),
    );
    const spy = vi.spyOn(pool, 'query');
    const small = await listarIntervenciones({ ...defaults, pageSize: 10 });
    const smallCalls = spy.mock.calls.length;
    spy.mockClear();
    const large = await listarIntervenciones({ ...defaults, pageSize: 50 });
    expect(spy.mock.calls.length).toBe(smallCalls);
    expect(smallCalls).toBe(2);
    spy.mockRestore();
    expect(small.items).toHaveLength(10);
    expect(large.items).toHaveLength(31);
    expect((await list({ page: 900 })).body.pagination.page).toBe(4);
    expect((await list({ pageSize: 25 })).status).toBe(400);
  });
  it('valida fechas, catálogos y números sin coerción insegura', async () => {
    for (const q of [
      { from: '2026-02-30' },
      { from: '2026-10-10', to: '2026-01-01' },
      { page: -1 },
      { material: 'inventado' },
      { resultado: 'inventado' },
    ])
      expect((await list(q)).status).toBe(400);
    const id = await nueva();
    expect(
      (await patch(id, { cantidadComentarios: -1, expectedUpdatedAt: null }))
        .status,
    ).toBe(400);
  });
  it('protege RBAC, IDOR y origen de la identidad', async () => {
    const id = await nueva();
    expect(
      (await request(app.server).get(`${base}/intervenciones`)).status,
    ).toBe(401);
    expect(
      (
        await request(app.server)
          .get(`${base}/intervenciones`)
          .set('Cookie', cookieCorr)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.server)
          .get(`${base}/intervenciones/calidad/${id}`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(404);
    await db
      .update(proyectos)
      .set({ estado: 'retirado' })
      .where(eq(proyectos.id, p.id));
    expect(
      (
        await patch(id, {
          observaciones: 'No debe guardarse',
          expectedUpdatedAt: null,
        })
      ).status,
    ).toBe(404);
  });
  it('deniega acciones operativas a Jefatura y creación de registros libres', async () => {
    const id = await nueva();
    for (const action of ['inicio', 'entrega', 'asignar', 'cierre'])
      expect(
        (
          await request(app.server)
            .patch(`/api/correcciones/${id}/${action}`)
            .set('Cookie', cookie)
            .send({})
        ).status,
      ).toBe(403);
    expect(
      (
        await request(app.server)
          .post(base)
          .set('Cookie', cookie)
          .send({ proyectoId: p.id })
      ).status,
    ).toBe(410);
  });
});
