import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it, afterAll } from 'vitest';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import {
  auditLogs,
  correcciones,
  fichaCalidadFases,
  disenos,
  disenoVersiones,
  direccionesCreativas,
  fichasTrazabilidad,
  notificaciones,
  pausas,
  projectAssignments,
  rolEnum,
  proyectos,
  servicios,
  users,
  workItems,
  type Rol,
} from '../server/db/schema/index.js';
import {
  obtenerDashboardJefatura,
  decidirExpressJefatura,
  obtenerActividadJefatura,
} from '../server/helpers/jefatura.js';
import {
  asignarEspecialista,
  notificarJefaturaFichaCompletada,
} from '../server/helpers/proyectos.js';
import { createSession } from '../server/helpers/session.js';
import { listarCargaEspecialistas } from '../server/helpers/carga.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import {
  crearProyectoDePrueba,
  crearFichaComercialCompleta,
} from './helpers/fixtures.js';

const app = buildApp();
const ahora = new Date('2026-10-10T16:00:00Z');
let jefe: string;
let a: string;
let b: string;
let cookie: string;
async function usuario(rol: Rol, nombre: string = rol) {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `${id}@panhouse.test`,
    nombre,
    rol,
    passwordHash: 'fixture-session-only',
  });
  return id;
}
async function proyecto(
  enviado = true,
  extra: Partial<typeof proyectos.$inferInsert> = {},
) {
  const p = await crearProyectoDePrueba();
  await db
    .update(proyectos)
    .set({
      fechaProgramadaInicio: '2026-10-10',
      notificadoRrpp: true,
      notificadoJefatura: enviado,
      ...extra,
    })
    .where(eq(proyectos.id, p.id));
  return p;
}
async function peticion(url: string, payload?: object, session = cookie) {
  return app.inject({
    method: payload ? 'PATCH' : 'GET',
    url,
    headers: session ? { cookie: session } : {},
    ...(payload ? { payload } : {}),
  });
}
beforeAll(async () => app.ready());
afterAll(async () => app.close());
beforeEach(async () => {
  await limpiarBaseDeDatos();
  jefe = await usuario('jefe_area');
  a = await usuario('especialista', 'Ana');
  b = await usuario('especialista', 'Beatriz');
  cookie = `panhouse_sid=${await createSession(jefe)}`;
});

describe('Inicio de Jefatura: snapshot, carga y ownership', () => {
  it('vacío: cuatro KPIs cero y especialistas sin carga', async () => {
    const d = await obtenerDashboardJefatura(ahora);
    expect(d.summary).toEqual({
      porAsignar: 0,
      solicitudes: 0,
      enRiesgo: 0,
      express: 0,
    });
    expect(d.teamCapacity.map((c) => c.carga)).toEqual([0, 0]);
  });
  it('RRPP listo sin handoff no aparece; el handoff formal crea la cola', async () => {
    const p = await proyecto(false);
    await crearFichaComercialCompleta(p.id);
    await db
      .update(fichasTrazabilidad)
      .set({ matrizDiagnosticoGenerado: true, matrizIngresoGenerado: true })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    expect((await obtenerDashboardJefatura(ahora)).proyectos).toHaveLength(0);
    expect((await notificarJefaturaFichaCompletada(p.id, jefe)).ok).toBe(true);
    const d = await obtenerDashboardJefatura(ahora);
    expect(d.summary.porAsignar).toBe(1);
    expect(d.proyectos[0]?.id).toBe(p.id);
    const [item] = await db
      .select()
      .from(workItems)
      .where(
        and(
          eq(workItems.proyectoId, p.id),
          eq(workItems.tipo, 'asignacion_especialista'),
        ),
      );
    expect(item?.estado).toBe('pendiente');
  });
  it('asignados, cerrados y assignment activo sin FK no entran en por asignar', async () => {
    await proyecto(true, { especialistaId: a });
    await proyecto(true, { estado: 'culminado' });
    const p = await proyecto();
    await db.insert(projectAssignments).values({
      proyectoId: p.id,
      tipo: 'especialista',
      usuarioId: b,
      asignadoPorId: jefe,
    });
    const d = await obtenerDashboardJefatura(ahora);
    expect(d.summary.porAsignar).toBe(0);
    expect(d.proyectos.find((x) => x.id === p.id)?.especialista?.id).toBe(b);
  });
  it('recomienda mayor cantidad pero menor carga; conserva pesos y composición', async () => {
    for (let i = 0; i < 2; i++) await proyecto(true, { especialistaId: a });
    for (let i = 0; i < 3; i++) {
      const p = await proyecto(true, { especialistaId: b });
      await db
        .update(servicios)
        .set({ pesoComplejidad: 1 })
        .where(eq(servicios.id, p.servicioId));
    }
    const p = await proyecto();
    const d = await obtenerDashboardJefatura(ahora);
    expect(d.teamCapacity.find((c) => c.id === a)).toMatchObject({
      carga: 8,
      activos: 2,
    });
    expect(d.teamCapacity.find((c) => c.id === b)).toMatchObject({
      carga: 3,
      activos: 3,
    });
    expect(d.proyectos.find((x) => x.id === p.id)?.recomendacion).toMatchObject(
      { especialistaId: b },
    );
    expect(
      d.proyectos.find((x) => x.id === p.id)?.recomendacion?.razones[0],
    ).toContain('3 puntos');
    const carga = await listarCargaEspecialistas();
    expect(carga.find((c) => c.id === a)?.carga).toBe(8);
  });
  it('pausados y stand-by mantienen carga; inactivos no son candidatos', async () => {
    await proyecto(true, { especialistaId: a, estado: 'pausado' });
    await proyecto(true, { especialistaId: a, estado: 'stand_by' });
    await db.update(users).set({ activo: false }).where(eq(users.id, b));
    const d = await obtenerDashboardJefatura(ahora);
    expect(d.teamCapacity).toHaveLength(1);
    expect(d.teamCapacity[0]).toMatchObject({ carga: 8, activos: 2 });
  });
  it('desempata carga por riesgo y luego Express confirmado, explicando el criterio', async () => {
    const pa = await proyecto(true, { especialistaId: a, estado: 'retrasado' });
    const pb = await proyecto(true, {
      especialistaId: b,
      fechaDeseadaAutor: '2027-01-01',
    });
    const pendiente = await proyecto();
    await decidirExpressJefatura(pb.id, jefe, {
      decision: 'confirmado',
      fechaEstandar: '2027-04-08',
      fechaDeseada: '2027-01-01',
    });
    let d = await obtenerDashboardJefatura(ahora);
    expect(
      d.proyectos.find((p) => p.id === pendiente.id)?.recomendacion
        ?.especialistaId,
    ).toBe(b);
    expect(
      d.proyectos
        .find((p) => p.id === pendiente.id)
        ?.recomendacion?.razones.join(' '),
    ).toContain('menos proyectos en riesgo');
    await db
      .update(proyectos)
      .set({ estado: 'en_proceso' })
      .where(eq(proyectos.id, pa.id));
    d = await obtenerDashboardJefatura(ahora);
    expect(
      d.proyectos.find((p) => p.id === pendiente.id)?.recomendacion
        ?.especialistaId,
    ).toBe(a);
    expect(
      d.proyectos
        .find((p) => p.id === pendiente.id)
        ?.recomendacion?.razones.join(' '),
    ).toContain('menos Express confirmados');
  });
  it('riesgo conserva el umbral central y descuenta pausas', async () => {
    const riesgo = await proyecto(true, {
      especialistaId: a,
      fechaProgramadaInicio: '2026-04-20',
    });
    const pausado = await proyecto(true, {
      especialistaId: b,
      fechaProgramadaInicio: '2026-04-20',
    });
    await db.insert(pausas).values({
      proyectoId: pausado.id,
      causa: 'autor',
      fechaInicio: new Date('2026-04-20T00:00:00Z'),
      fechaFin: new Date('2026-09-20T00:00:00Z'),
    });
    const d = await obtenerDashboardJefatura(ahora);
    expect(d.proyectos.find((p) => p.id === riesgo.id)?.riesgo.atencion).toBe(
      true,
    );
    expect(d.proyectos.find((p) => p.id === pausado.id)?.riesgo.atencion).toBe(
      false,
    );
    expect(
      d.proyectos.find((p) => p.id === pausado.id)?.riesgo.diasEfectivos,
    ).toBeCloseTo(20.6667, 3);
  });
  it('seguimiento conserva paralelismo, bloqueo, vencimiento y responsable', async () => {
    const p = await proyecto(true, { especialistaId: a });
    const [item] = await db
      .insert(workItems)
      .values({
        proyectoId: p.id,
        tipo: 'edicion',
        estado: 'en_progreso',
        fechaFinPautada: '2026-10-09',
      })
      .returning();
    await db.insert(workItems).values({
      proyectoId: p.id,
      tipo: 'direccion_creativa',
      estado: 'bloqueado',
    });
    await db.insert(projectAssignments).values({
      proyectoId: p.id,
      workItemId: item!.id,
      tipo: 'editor',
      usuarioId: b,
      asignadoPorId: jefe,
    });
    const d = await obtenerDashboardJefatura(ahora);
    const t = d.priorityTracking[0]!;
    expect(t.procesos).toHaveLength(2);
    expect(t.procesos.find((i) => i.tipo === 'edicion')).toMatchObject({
      vencido: true,
      responsable: 'Beatriz',
    });
    expect(t.riesgo.causas).toContain('Proceso bloqueado');
    expect(d.summary.enRiesgo).toBe(1);
  });
  it('respeta la hora del SLA de Corrección y el responsable freelance', async () => {
    const p = await proyecto(true, { especialistaId: a });
    const [wi] = await db
      .insert(workItems)
      .values({ proyectoId: p.id, tipo: 'correccion', estado: 'en_progreso' })
      .returning();
    await db
      .insert(correcciones)
      .values({
        proyectoId: p.id,
        workItemId: wi!.id,
        alcance: 'preliminares',
        dueAt: new Date('2026-10-10T15:30:00Z'),
        correctorNombre: 'Correctora freelance',
        freelance: true,
      });
    const antes = await obtenerDashboardJefatura(
      new Date('2026-10-10T15:00:00Z'),
    );
    expect(antes.summary.enRiesgo).toBe(0);
    const despues = await obtenerDashboardJefatura(ahora);
    expect(despues.summary.enRiesgo).toBe(1);
    expect(despues.priorityTracking[0]?.procesos[0]).toMatchObject({
      vence: '2026-10-10T15:30:00.000Z',
      vencido: true,
      responsable: 'Correctora freelance',
    });
    await db
      .update(workItems)
      .set({ estado: 'completado' })
      .where(eq(workItems.id, wi!.id));
    expect((await obtenerDashboardJefatura(ahora)).summary.enRiesgo).toBe(0);
  });
  it('usa plazos fijados de Calidad y Diseño sin fabricar SLA ni ignorar entregas puntuales', async () => {
    const p = await proyecto(true, { especialistaId: a });
    const f = await crearFichaComercialCompleta(p.id);
    const [q, c, w] = await db
      .insert(workItems)
      .values([
        { proyectoId: p.id, tipo: 'calidad', estado: 'en_progreso' },
        { proyectoId: p.id, tipo: 'direccion_creativa', estado: 'en_progreso' },
        { proyectoId: p.id, tipo: 'diseno', estado: 'en_progreso' },
      ])
      .returning();
    const [fase] = await db
      .insert(fichaCalidadFases)
      .values({
        fichaId: f.id,
        numeroFase: 1,
        workItemId: q!.id,
        dueAt: new Date('2026-10-10T15:00:00Z'),
      })
      .returning();
    const [creativa] = await db
      .insert(direccionesCreativas)
      .values({ proyectoId: p.id, workItemId: c!.id })
      .returning();
    const [diseno] = await db
      .insert(disenos)
      .values({
        proyectoId: p.id,
        workItemId: w!.id,
        direccionCreativaId: creativa!.id,
        tipo: 'diagramacion',
        solicitudKey: randomUUID(),
        fuenteUrl: 'https://archivos.panhouse.test/qa',
        dueAt: new Date('2026-10-10T15:00:00Z'),
      })
      .returning();
    let d = await obtenerDashboardJefatura(ahora);
    expect(
      d.proyectos[0]?.procesos.find((t) => t.tipo === 'calidad')?.vencido,
    ).toBe(true);
    expect(
      d.proyectos[0]?.procesos.find((t) => t.tipo === 'diseno')?.vencido,
    ).toBe(true);
    const disenador = await usuario('disenador');
    await db
      .insert(disenoVersiones)
      .values({
        disenoId: diseno!.id,
        numero: 1,
        entregaKey: randomUUID(),
        enlace: 'https://archivos.panhouse.test/entrega-qa',
        entregadoPorId: disenador,
        entregadoEn: new Date('2026-10-10T14:00:00Z'),
      });
    d = await obtenerDashboardJefatura(ahora);
    expect(
      d.proyectos[0]?.procesos.find((t) => t.tipo === 'diseno')?.vencido,
    ).toBe(false);
    await db
      .update(fichaCalidadFases)
      .set({ dueAt: null })
      .where(eq(fichaCalidadFases.id, fase!.id));
    d = await obtenerDashboardJefatura(ahora);
    expect(d.summary.enRiesgo).toBe(0);
    expect(
      d.proyectos[0]?.procesos.find((t) => t.tipo === 'calidad'),
    ).toMatchObject({ vence: null, vencido: false });
  });
  it('solicitud de Editor es supervisión; la asignación creativa sí cuenta para Jefatura', async () => {
    const p = await proyecto(true, { especialistaId: a });
    await db
      .insert(workItems)
      .values({ proyectoId: p.id, tipo: 'edicion', estado: 'pendiente' });
    const [item] = await db
      .insert(workItems)
      .values({
        proyectoId: p.id,
        tipo: 'direccion_creativa',
        estado: 'pendiente',
      })
      .returning();
    await db
      .insert(direccionesCreativas)
      .values({ proyectoId: p.id, workItemId: item!.id });
    await db.insert(notificaciones).values({
      proyectoId: p.id,
      rolDestino: 'jefe_area',
      mensaje: 'Una notificación no es una solicitud',
    });
    let d = await obtenerDashboardJefatura(ahora);
    expect(d.summary.solicitudes).toBe(1);
    expect(
      d.requests.find((r) => r.destino === 'Jefe de Edición')?.requiereJefatura,
    ).toBe(false);
    await db.insert(projectAssignments).values({
      proyectoId: p.id,
      workItemId: item!.id,
      tipo: 'lider_creativo',
      usuarioId: b,
      asignadoPorId: jefe,
    });
    d = await obtenerDashboardJefatura(ahora);
    expect(d.summary.solicitudes).toBe(0);
  });
});

describe('Express: decisión humana, contexto y auditoría', () => {
  it('detecta posible Express y confirmación no altera peso ni plazo', async () => {
    const p = await proyecto(true, {
      especialistaId: a,
      fechaDeseadaAutor: '2027-01-01',
    });
    const previo = (await obtenerDashboardJefatura(ahora)).proyectos[0]!;
    expect(previo.express).toMatchObject({
      estado: 'posible',
      fechaEstandar: '2027-04-08',
      fechaDeseada: '2027-01-01',
      compresionDias: 97,
    });
    const input = {
      decision: 'confirmado' as const,
      fechaEstandar: previo.express.fechaEstandar,
      fechaDeseada: previo.express.fechaDeseada!,
      motivo: 'Fecha comprometida revisada',
    };
    expect((await decidirExpressJefatura(p.id, jefe, input)).ok).toBe(true);
    expect(await decidirExpressJefatura(p.id, jefe, input)).toMatchObject({
      ok: true,
      cambio: false,
    });
    const d = await obtenerDashboardJefatura(ahora);
    expect(d.proyectos[0]?.express.estado).toBe('confirmado');
    expect(d.teamCapacity.find((c) => c.id === a)).toMatchObject({
      carga: 4,
      express: 1,
    });
    const audit = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.accion, 'EXPRESS_CONFIRMADO'));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorId).toBe(jefe);
    expect(audit[0]?.detalles).toMatchObject({
      compresionDias: 97,
      nuevo: 'confirmado',
      anterior: 'posible',
    });
    const [s] = await db
      .select()
      .from(servicios)
      .where(eq(servicios.id, p.servicioId));
    expect(s?.pesoComplejidad).toBe(4);
  });
  it('normal explícito preserva fecha deseada; cambio de fecha vuelve a requerir revisión', async () => {
    const p = await proyecto(true, { fechaDeseadaAutor: '2027-01-01' });
    const ex = (await obtenerDashboardJefatura(ahora)).proyectos[0]!.express;
    await decidirExpressJefatura(p.id, jefe, {
      decision: 'normal',
      fechaEstandar: ex.fechaEstandar,
      fechaDeseada: ex.fechaDeseada!,
    });
    expect(
      (await obtenerDashboardJefatura(ahora)).proyectos[0]?.express.estado,
    ).toBe('normal_confirmado');
    await db
      .update(proyectos)
      .set({ fechaDeseadaAutor: '2027-01-02' })
      .where(eq(proyectos.id, p.id));
    expect(
      (await obtenerDashboardJefatura(ahora)).proyectos[0]?.express.estado,
    ).toBe('posible');
    expect(
      await decidirExpressJefatura(p.id, jefe, {
        decision: 'confirmado',
        fechaEstandar: ex.fechaEstandar,
        fechaDeseada: ex.fechaDeseada!,
      }),
    ).toMatchObject({ ok: false, status: 409 });
  });
  it('fecha deseada RRPP y plazo comercial de Sello se conservan', async () => {
    const p = await proyecto();
    await crearFichaComercialCompleta(p.id);
    await db
      .update(servicios)
      .set({ plazoDias: null, plazoInternoDias: 60, plazoComercialDias: 90 })
      .where(eq(servicios.id, p.servicioId));
    await db
      .update(fichasTrazabilidad)
      .set({ fechaDeseadaCulminacion: '2026-12-25' })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    const ex = (await obtenerDashboardJefatura(ahora)).proyectos[0]!.express;
    expect(ex).toMatchObject({
      estado: 'posible',
      fechaEstandar: '2027-01-08',
      compresionDias: 14,
    });
  });
  it('no admite decisión para proyecto no recibido, cerrado o inexistente', async () => {
    const p = await proyecto(false, { fechaDeseadaAutor: '2027-01-01' });
    const body = {
      decision: 'confirmado',
      fechaEstandar: '2027-04-08',
      fechaDeseada: '2027-01-01',
    };
    expect(
      (await peticion(`/api/jefatura/proyectos/${p.id}/express`, body))
        .statusCode,
    ).toBe(409);
    expect(
      (await peticion(`/api/jefatura/proyectos/${randomUUID()}/express`, body))
        .statusCode,
    ).toBe(404);
    await db
      .update(proyectos)
      .set({ notificadoJefatura: true, estado: 'culminado' })
      .where(eq(proyectos.id, p.id));
    expect(
      (await peticion(`/api/jefatura/proyectos/${p.id}/express`, body))
        .statusCode,
    ).toBe(409);
  });
});

describe('Asignación transaccional y RBAC de Jefatura', () => {
  it('asigna y reasigna FK, cierra historial, completa tarea, audita y notifica individualmente', async () => {
    const p = await proyecto();
    const ruta = `/api/jefatura/proyectos/${p.id}/especialista`;
    expect((await peticion(ruta, { especialistaId: a })).statusCode).toBe(200);
    expect((await peticion(ruta, { especialistaId: a })).statusCode).toBe(200);
    expect((await db.select().from(projectAssignments)).length).toBe(1);
    expect((await peticion(ruta, { especialistaId: b })).statusCode).toBe(200);
    const [actual] = await db
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, p.id));
    expect(actual?.especialistaId).toBe(b);
    const historial = await db
      .select()
      .from(projectAssignments)
      .where(eq(projectAssignments.proyectoId, p.id));
    expect(historial).toHaveLength(2);
    expect(
      historial.find((h) => h.usuarioId === a)?.finalizadoEn,
    ).not.toBeNull();
    expect(historial.find((h) => h.usuarioId === b)?.finalizadoEn).toBeNull();
    const tareas = await db
      .select()
      .from(workItems)
      .where(eq(workItems.proyectoId, p.id));
    expect(tareas[0]?.estado).toBe('completado');
    const audit = await db.select().from(auditLogs);
    expect(audit.map((e) => e.accion).sort()).toEqual([
      'ESPECIALISTA_ASIGNADO',
      'ESPECIALISTA_REASIGNADO',
    ]);
    const avisos = await db.select().from(notificaciones);
    expect(avisos.map((n) => n.usuarioDestinoId).sort()).toEqual([a, b].sort());
    const d = await obtenerDashboardJefatura(ahora);
    expect(d.summary.porAsignar).toBe(0);
    expect(d.proyectos[0]?.especialista?.id).toBe(b);
  });
  it('serializa asignaciones concurrentes sin dos assignments activos', async () => {
    const p = await proyecto();
    await Promise.all([
      asignarEspecialista(p.id, a, jefe, { exigirHandoff: true }),
      asignarEspecialista(p.id, b, jefe, { exigirHandoff: true }),
    ]);
    const [fila] = await db
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, p.id));
    const actuales = await db
      .select()
      .from(projectAssignments)
      .where(
        and(
          eq(projectAssignments.proyectoId, p.id),
          isNull(projectAssignments.finalizadoEn),
        ),
      );
    expect(actuales).toHaveLength(1);
    expect(actuales[0]?.usuarioId).toBe(fila?.especialistaId);
  });
  it('revierte historial y FK si falla una referencia dentro de la transacción', async () => {
    const p = await proyecto();
    await asignarEspecialista(p.id, a, jefe, { exigirHandoff: true });
    await expect(
      asignarEspecialista(p.id, b, randomUUID(), { exigirHandoff: true }),
    ).rejects.toThrow();
    const [actual] = await db
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, p.id));
    expect(actual?.especialistaId).toBe(a);
    const historia = await db
      .select()
      .from(projectAssignments)
      .where(eq(projectAssignments.proyectoId, p.id));
    expect(historia).toHaveLength(1);
    expect(historia[0]?.finalizadoEn).toBeNull();
    expect(await db.select().from(auditLogs)).toHaveLength(1);
    expect(await db.select().from(notificaciones)).toHaveLength(1);
  });
  it('reasignar o repetir no reanuda un proyecto pausado', async () => {
    const p = await proyecto();
    await asignarEspecialista(p.id, a, jefe, { exigirHandoff: true });
    await db
      .update(proyectos)
      .set({ estado: 'pausado' })
      .where(eq(proyectos.id, p.id));
    await asignarEspecialista(p.id, a, jefe, { exigirHandoff: true });
    await asignarEspecialista(p.id, b, jefe, { exigirHandoff: true });
    const [actual] = await db
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, p.id));
    expect(actual?.estado).toBe('pausado');
    expect(actual?.especialistaId).toBe(b);
    expect(
      (await obtenerDashboardJefatura(ahora)).teamCapacity.find(
        (c) => c.id === b,
      )?.carga,
    ).toBe(4);
  });
  it('rechaza candidato ajeno al rol/inactivo y proyecto no handed-off sin efectos', async () => {
    const p = await proyecto();
    expect(
      (
        await peticion(`/api/jefatura/proyectos/${p.id}/especialista`, {
          especialistaId: jefe,
        })
      ).statusCode,
    ).toBe(409);
    await db.update(users).set({ activo: false }).where(eq(users.id, a));
    expect(
      (
        await peticion(`/api/jefatura/proyectos/${p.id}/especialista`, {
          especialistaId: a,
        })
      ).statusCode,
    ).toBe(409);
    await db
      .update(proyectos)
      .set({ notificadoJefatura: false })
      .where(eq(proyectos.id, p.id));
    expect(
      (
        await peticion(`/api/jefatura/proyectos/${p.id}/especialista`, {
          especialistaId: b,
        })
      ).statusCode,
    ).toBe(409);
    expect(await db.select().from(projectAssignments)).toHaveLength(0);
    expect(await db.select().from(auditLogs)).toHaveLength(0);
  });
  it('RBAC real: 401 sin sesión, 403 para otros roles; ID desconocido y malformed', async () => {
    expect(
      (await peticion('/api/jefatura/dashboard', undefined, '')).statusCode,
    ).toBe(401);
    for (const rol of rolEnum.enumValues.filter((r) => r !== 'jefe_area')) {
      const id = await usuario(rol);
      const sesion = `panhouse_sid=${await createSession(id)}`;
      expect(
        (await peticion('/api/jefatura/dashboard', undefined, sesion))
          .statusCode,
      ).toBe(403);
      expect(
        (await peticion('/api/jefatura/actividad', undefined, sesion))
          .statusCode,
      ).toBe(403);
      expect(
        (
          await peticion(
            `/api/jefatura/proyectos/${randomUUID()}/express`,
            {
              decision: 'confirmado',
              fechaEstandar: '2027-04-08',
              fechaDeseada: '2027-01-01',
            },
            sesion,
          )
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await peticion(
            `/api/jefatura/proyectos/${randomUUID()}/especialista`,
            { especialistaId: b },
            sesion,
          )
        ).statusCode,
      ).toBe(403);
    }
    expect(
      (
        await peticion('/api/jefatura/proyectos/no-uuid/especialista', {
          especialistaId: b,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await peticion(`/api/jefatura/proyectos/${randomUUID()}/especialista`, {
          especialistaId: b,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await peticion(`/api/proyectos/${randomUUID()}/editor`, { editorId: a }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await peticion(`/api/correcciones/${randomUUID()}/inicio`, {
          fecha: '2026-10-10',
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await peticion(`/api/correcciones/${randomUUID()}/entrega`, {
          fecha: '2026-10-10',
        })
      ).statusCode,
    ).toBe(403);
  });
  it('actividad solo expone eventos reconocidos, sin JSON ni secretos', async () => {
    const p = await proyecto();
    await asignarEspecialista(p.id, a, jefe);
    const actividad = await obtenerActividadJefatura();
    expect(actividad[0]?.texto).toBe('asignó Especialista');
    expect(actividad[0]).not.toHaveProperty('detalles');
    expect(actividad[0]).not.toHaveProperty('passwordHash');
    expect((await peticion('/api/jefatura/actividad')).statusCode).toBe(200);
  });
  it('actividad limita a cinco y excluye eventos técnicos no reconocidos', async () => {
    const p = await proyecto();
    await db.insert(auditLogs).values(
      Array.from({ length: 7 }, (_, n) => ({
        actorId: jefe,
        accion: 'EXPRESS_CONFIRMADO',
        entityType: 'proyecto',
        entityId: p.id,
        proyectoId: p.id,
        createdAt: new Date(ahora.getTime() + n * 1000),
      })),
    );
    await db.insert(auditLogs).values({
      actorId: jefe,
      accion: 'EVENTO_TECNICO',
      entityType: 'proyecto',
      entityId: p.id,
      proyectoId: p.id,
      detalles: { secreto: 'no-exponer' },
    });
    const actividad = await obtenerActividadJefatura();
    expect(actividad).toHaveLength(5);
    expect(
      actividad.every((e) => e.texto === 'confirmó prioridad Express'),
    ).toBe(true);
    expect(actividad[0]?.fecha).toBe(
      new Date(ahora.getTime() + 6000).toISOString(),
    );
  });
});
