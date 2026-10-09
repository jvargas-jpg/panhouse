import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import {
  auditLogs,
  direccionesCreativas,
  fichaDisenoPropuestas,
  fichaLanzamientoReuniones,
  fichasTrazabilidad,
  notificaciones,
  proyectos,
  ROLES,
  servicios,
  workItems,
} from '../server/db/schema/index.js';
import { obtenerDashboardRrpp } from '../server/helpers/rrppDashboard.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import {
  crearAutor,
  crearFichaComercialCompleta,
  crearProyectoDePrueba,
  crearServicio,
} from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('Inicio RRPP: fuentes canónicas, lifecycle y permisos', () => {
  let app: ReturnType<typeof crearAppDePrueba>;
  beforeEach(async () => {
    await limpiarBaseDeDatos();
    app = crearAppDePrueba();
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });
  async function preparado() {
    const p = await crearProyectoDePrueba();
    const ficha = await crearFichaComercialCompleta(p.id);
    return { p, ficha };
  }
  async function entregar(id: string, cookie: string) {
    expect(
      (
        await request(app.server)
          .post(`/api/proyectos/${id}/notificar-rrpp`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(201);
  }
  async function dashboard(cookie: string) {
    const r = await request(app.server)
      .get('/api/rrpp/dashboard')
      .set('Cookie', cookie);
    expect(r.status).toBe(200);
    return r.body;
  }
  async function eventos(id: string, accion: string) {
    return db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.proyectoId, id), eq(auditLogs.accion, accion)));
  }
  async function direccion(
    id: string,
    tipo = 'concepto_portada',
    estado: 'pendiente' | 'cancelado' = 'pendiente',
    fechaCierre: string | null = null,
  ) {
    const [item] = await db
      .insert(workItems)
      .values({
        proyectoId: id,
        tipo: 'direccion_creativa',
        businessKey: randomUUID(),
        estado,
      })
      .returning();
    const [d] = await db
      .insert(direccionesCreativas)
      .values({
        proyectoId: id,
        workItemId: item!.id,
        tipo,
        fechaCierre,
        fechaBriefAprobadoAutor: '2026-10-01',
      })
      .returning();
    return d!;
  }

  it('solo cuenta proyectos entregados; ready sin envío no aparece y legacy no inventa fecha', async () => {
    const a = await preparado();
    const b = await preparado();
    const legacy = await preparado();
    const retirado = await preparado();
    const comercial = await registrarYLoguear(app, 'comercial');
    const rrpp = await registrarYLoguear(app, 'rrpp');
    await entregar(a.p.id, comercial);
    await db
      .update(proyectos)
      .set({ notificadoRrpp: true })
      .where(eq(proyectos.id, legacy.p.id));
    await db
      .update(proyectos)
      .set({ notificadoRrpp: true, estado: 'retirado' })
      .where(eq(proyectos.id, retirado.p.id));
    const d = await dashboard(rrpp);
    expect(d.kpis).toEqual({
      nuevos: 2,
      enProceso: 0,
      conceptos: 0,
      lanzamientos: 0,
    });
    expect(d.ingresos.map((i: { id: string }) => i.id).sort()).toEqual(
      [a.p.id, legacy.p.id].sort(),
    );
    expect(
      d.ingresos.find((i: { id: string }) => i.id === legacy.p.id)
        .actualizadoAt,
    ).toBeNull();
    expect(d.actividad).toHaveLength(1);
    expect(d.actividad[0].titulo).toBe('Nuevo proyecto recibido');
    expect(JSON.stringify(d)).not.toContain(b.p.id);
  });

  it('iniciar es idempotente y atómico ante dos requests; persiste el mismo intake sin notificaciones duplicadas', async () => {
    const { p } = await preparado();
    const comercial = await registrarYLoguear(app, 'comercial');
    const rrpp = await registrarYLoguear(app, 'rrpp');
    await entregar(p.id, comercial);
    const respuestas = await Promise.all(
      [0, 1].map(() =>
        request(app.server)
          .post(`/api/rrpp/ingresos/${p.id}/iniciar`)
          .set('Cookie', rrpp),
      ),
    );
    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
    expect(await eventos(p.id, 'INTAKE_RRPP_INICIADO')).toHaveLength(1);
    const items = await db
      .select()
      .from(workItems)
      .where(eq(workItems.proyectoId, p.id));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      tipo: 'intake_rrpp',
      estado: 'en_progreso',
    });
    expect(items[0]?.fechaInicioReal).toBeTruthy();
    expect((await dashboard(rrpp)).kpis).toMatchObject({
      nuevos: 0,
      enProceso: 1,
    });
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.proyectoId, p.id)),
    ).toHaveLength(1);
  });

  it('reconoce diagnóstico legacy por trabajo propio guardado y no por defaults, strings vacíos o arrays vacíos', async () => {
    const { p } = await preparado();
    await db
      .update(proyectos)
      .set({ notificadoRrpp: true })
      .where(eq(proyectos.id, p.id));
    const rrpp = await registrarYLoguear(app, 'rrpp');
    await db
      .update(fichasTrazabilidad)
      .set({ publicoPerfil: ' ', objetivoComercial: [] })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    expect((await dashboard(rrpp)).ingresos[0].estado).toBe('nuevo');
    await db
      .update(fichasTrazabilidad)
      .set({ posibleTituloLibro: 'Título en diagnóstico' })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    expect((await dashboard(rrpp)).ingresos[0].estado).toBe('diagnostico');
    await db
      .update(fichasTrazabilidad)
      .set({ posibleTituloLibro: null, matrizContratoFirmado: true })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    const d = await dashboard(rrpp);
    expect(d.kpis).toMatchObject({ nuevos: 0, enProceso: 1 });
    expect(d.ingresos[0].actualizadoAt).toBeNull();
  });

  it('guardado propio inicia diagnóstico; documentos generados son ready y envío a Jefatura sigue siendo un hecho separado', async () => {
    const { p } = await preparado();
    const comercial = await registrarYLoguear(app, 'comercial');
    const rrpp = await registrarYLoguear(app, 'rrpp');
    await entregar(p.id, comercial);
    const guardar = (body: object) =>
      request(app.server)
        .patch(`/api/fichas-trazabilidad/${p.id}/matriz-ingreso`)
        .set('Cookie', rrpp)
        .send(body);
    expect((await guardar({ matrizDiagnosticoGenerado: true })).status).toBe(
      200,
    );
    expect((await dashboard(rrpp)).ingresos[0]).toMatchObject({
      estado: 'diagnostico',
      enviadoJefatura: false,
    });
    expect((await guardar({ matrizIngresoGenerado: true })).status).toBe(200);
    const ready = await dashboard(rrpp);
    expect(ready.ingresos[0]).toMatchObject({
      estado: 'completo',
      pendiente: 'Listo para Jefatura',
      enviadoJefatura: false,
    });
    expect(ready.kpis.enProceso).toBe(0);
    expect(await eventos(p.id, 'DIAGNOSTICO_COMPLETADO')).toHaveLength(1);
    expect((await guardar({ matrizIngresoGenerado: true })).status).toBe(200);
    expect(await eventos(p.id, 'DIAGNOSTICO_COMPLETADO')).toHaveLength(1);
    expect(
      (
        await request(app.server)
          .post(`/api/proyectos/${p.id}/notificar-jefatura`)
          .set('Cookie', rrpp)
      ).status,
    ).toBe(201);
    expect((await dashboard(rrpp)).ingresos[0]).toMatchObject({
      estado: 'completo',
      enviadoJefatura: true,
      pendiente: 'Enviado a Jefatura',
    });
    expect(
      (
        await request(app.server)
          .post(`/api/rrpp/ingresos/${p.id}/iniciar`)
          .set('Cookie', rrpp)
      ).status,
    ).toBe(409);
  });

  it('Crudo mantiene clasificación RRPP pendiente y no cambia SLA al clasificar', async () => {
    const { p } = await preparado();
    const cr = await crearServicio({
      codigo: 'CR',
      nombre: 'Crudo',
      pesoComplejidad: 4,
      plazoDias: 150,
    });
    await db
      .update(proyectos)
      .set({ servicioId: cr.id })
      .where(eq(proyectos.id, p.id));
    const comercial = await registrarYLoguear(app, 'comercial');
    const rrpp = await registrarYLoguear(app, 'rrpp');
    await entregar(p.id, comercial);
    expect((await dashboard(rrpp)).ingresos[0]).toMatchObject({
      subtipoCrudo: null,
      pendiente: 'CRUDO · pendiente de clasificación',
    });
    await db
      .update(fichasTrazabilidad)
      .set({ matrizDiagnosticoGenerado: true, matrizIngresoGenerado: true })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    expect((await dashboard(rrpp)).ingresos[0].estado).toBe('diagnostico');
    const endpoint = `/api/fichas-trazabilidad/${p.id}/proyecto-perfil`;
    expect(
      (
        await request(app.server)
          .patch(endpoint)
          .set('Cookie', comercial)
          .send({ ingresoServicioSubtipoCrudo: 'Tripa' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.server)
          .patch(endpoint)
          .set('Cookie', rrpp)
          .send({ ingresoServicioSubtipoCrudo: 'Tripa' })
      ).status,
    ).toBe(200);
    expect((await dashboard(rrpp)).ingresos[0]).toMatchObject({
      estado: 'completo',
      subtipoCrudo: 'Tripa',
    });
    expect(
      (await db.select().from(servicios).where(eq(servicios.id, cr.id)))[0]
        ?.plazoDias,
    ).toBe(150);
  });

  it('cuenta propuestas reales vigentes, agrupa el contexto y permite aprobar/devolver sin privilegios creativos', async () => {
    const { p, ficha } = await preparado();
    const d = await direccion(p.id);
    const revision = await direccion(p.id, 'revision_cubierta');
    const cerrado = await direccion(
      p.id,
      'concepto_portada',
      'pendiente',
      '2026-10-02',
    );
    const cancelado = await direccion(p.id, 'concepto_portada', 'cancelado');
    const [a, b] = await db
      .insert(fichaDisenoPropuestas)
      .values([
        {
          fichaId: ficha.id,
          direccionCreativaId: d.id,
          descripcion: 'Primera propuesta',
        },
        {
          fichaId: ficha.id,
          direccionCreativaId: d.id,
          descripcion: 'Segunda propuesta',
        },
        {
          fichaId: ficha.id,
          direccionCreativaId: d.id,
          fechaAprobadaRrpp: '2026-10-03',
        },
        {
          fichaId: ficha.id,
          direccionCreativaId: d.id,
          estado: 'Devuelta por RRPP',
        },
        { fichaId: ficha.id, direccionCreativaId: revision.id },
        { fichaId: ficha.id, direccionCreativaId: cerrado.id },
        { fichaId: ficha.id, direccionCreativaId: cancelado.id },
        { fichaId: ficha.id },
      ])
      .returning();
    const rrpp = await registrarYLoguear(app, 'rrpp');
    const antes = await dashboard(rrpp);
    expect(antes.kpis.conceptos).toBe(2);
    expect(antes.conceptos).toHaveLength(1);
    expect(
      antes.conceptos[0].propuestas.map((v: { id: string }) => v.id).sort(),
    ).toEqual([a!.id, b!.id].sort());
    expect(antes.kpis.nuevos).toBe(0);
    for (const [metodo, ruta] of [
      ['patch', `/${d.id}/brief`],
      ['post', `/${d.id}/propuestas`],
      ['patch', `/${revision.id}/recursos`],
    ] as const)
      expect(
        (
          await request(app.server)
            [metodo](`/api/direccion-creativa${ruta}`)
            .set('Cookie', rrpp)
            .send({})
        ).status,
      ).toBe(403);
    expect(
      (
        await request(app.server)
          .patch(`/api/direccion-creativa/propuestas/${a!.id}/rrpp`)
          .set('Cookie', rrpp)
          .send({ aprobar: true })
      ).status,
    ).toBe(200);
    expect((await dashboard(rrpp)).kpis.conceptos).toBe(1);
    expect(
      (
        await request(app.server)
          .patch(`/api/direccion-creativa/propuestas/${b!.id}/rrpp`)
          .set('Cookie', rrpp)
          .send({ aprobar: false, observaciones: 'Ajustar tipografía' })
      ).status,
    ).toBe(200);
    const despues = await dashboard(rrpp);
    expect(despues.kpis.conceptos).toBe(0);
    expect(
      despues.actividad.map((v: { titulo: string }) => v.titulo),
    ).toContain('Concepto devuelto con observaciones');
    const propuestaRevision = (
      await db
        .select()
        .from(fichaDisenoPropuestas)
        .where(eq(fichaDisenoPropuestas.direccionCreativaId, revision.id))
    )[0]!;
    expect(
      (
        await request(app.server)
          .patch(
            `/api/direccion-creativa/propuestas/${propuestaRevision.id}/rrpp`,
          )
          .set('Cookie', rrpp)
          .send({ aprobar: true })
      ).status,
    ).toBe(409);
  });

  it('refetch incorpora cambios comerciales compartidos, contrato y coautores, con audit solo de cambios efectivos posteriores al handoff', async () => {
    const { p } = await preparado();
    const otro = await preparado();
    const comercial = await registrarYLoguear(app, 'comercial');
    const rrpp = await registrarYLoguear(app, 'rrpp');
    const perfil = (id: string, body: object) =>
      request(app.server)
        .patch(`/api/fichas-trazabilidad/${id}/proyecto-perfil`)
        .set('Cookie', comercial)
        .send(body);
    expect(
      (await perfil(otro.p.id, { ingresoObservaciones: 'Sin enviar' })).status,
    ).toBe(200);
    expect(
      await eventos(otro.p.id, 'INFORMACION_COMERCIAL_ACTUALIZADA'),
    ).toHaveLength(0);
    await entregar(p.id, comercial);
    expect(
      (await perfil(p.id, { ingresoObservaciones: 'Corrección compartida' }))
        .status,
    ).toBe(200);
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-contrato`)
          .set('Cookie', comercial)
          .send({ paginasPactadas: '150', capitulosPactados: '6 a 10' })
      ).status,
    ).toBe(200);
    const coautor = await crearAutor({ nombre: 'Coautora actual' });
    expect(
      (
        await request(app.server)
          .patch(`/api/proyectos/${p.id}/reasignar`)
          .set('Cookie', comercial)
          .send({ autorIds: [p.autorId, coautor.id] })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.server)
          .patch(`/api/autores/${coautor.id}`)
          .set('Cookie', comercial)
          .send({ nombre: 'Coautora corregida' })
      ).status,
    ).toBe(200);
    const d = await dashboard(rrpp);
    expect(d.ingresos[0]).toMatchObject({
      compartidos: {
        observaciones: 'Corrección compartida',
        capitulos: '6 a 10',
        paginas: '150',
      },
      actualizadoPor: 'Comercial actualizó información',
      estado: 'nuevo',
    });
    expect(d.ingresos[0].nombre).toContain('Coautora corregida');
    expect(d.actividad.map((v: { titulo: string }) => v.titulo)).toContain(
      'Comercial actualizó información',
    );
    expect(
      await eventos(p.id, 'INFORMACION_COMERCIAL_ACTUALIZADA'),
    ).toHaveLength(4);
    await perfil(p.id, { ingresoObservaciones: 'Corrección compartida' });
    expect(
      await eventos(p.id, 'INFORMACION_COMERCIAL_ACTUALIZADA'),
    ).toHaveLength(4);
    expect(
      (await db.select().from(proyectos).where(eq(proyectos.id, p.id)))[0]
        ?.notificadoRrpp,
    ).toBe(true);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.proyectoId, p.id)),
    ).toHaveLength(1);
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-contrato`)
          .set('Cookie', rrpp)
          .send({ paginasPactadas: '999' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.server)
          .patch(`/api/proyectos/${p.id}/reasignar`)
          .set('Cookie', rrpp)
          .send({ autorIds: [coautor.id] })
      ).status,
    ).toBe(403);
  });

  it('lanzamientos son hitos fechados de proyectos entregados, próximos 30 días en Caracas, sin eventos inventados', async () => {
    const { p, ficha } = await preparado();
    const noEnviado = await preparado();
    await db
      .update(proyectos)
      .set({ notificadoRrpp: true })
      .where(eq(proyectos.id, p.id));
    const fechas = {
      lanzamientoPromocionFechaPrimeraReunion: '2026-10-09',
      lanzamientoPromocionFechaSegundaReunion: '2026-11-08',
      lanzamientoPromocionFechaTentativa: '2026-11-09',
    };
    await db
      .update(fichasTrazabilidad)
      .set(fechas)
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    await db
      .update(fichasTrazabilidad)
      .set(fechas)
      .where(eq(fichasTrazabilidad.proyectoId, noEnviado.p.id));
    await db.insert(fichaLanzamientoReuniones).values([
      { fichaId: ficha.id, fecha: '2026-10-18' },
      { fichaId: ficha.id, fecha: '2026-10-08' },
    ]);
    const d = await obtenerDashboardRrpp(new Date('2026-10-10T01:00:00Z'));
    expect(d.periodoLanzamientos).toEqual({
      desde: '2026-10-09',
      hasta: '2026-11-08',
    });
    expect(d.kpis.lanzamientos).toBe(3);
    expect(d.lanzamientos.map((l) => l.fecha)).toEqual([
      '2026-10-09',
      '2026-10-18',
      '2026-11-08',
    ]);
    expect(d.lanzamientos.every((l) => l.proyecto.id === p.id)).toBe(true);
    expect(d.lanzamientos[0]?.href).toBe(
      `/proyectos/${p.id}/ficha-trazabilidad#lanzamiento`,
    );
    expect(d.lanzamientos[1]?.href).toBe(`/proyectos/${p.id}#lanzamiento`);
  });

  it('rechaza inicio sin handoff, inactivo, cancelado, UUID inválido y proyecto inexistente', async () => {
    const { p } = await preparado();
    const rrpp = await registrarYLoguear(app, 'rrpp');
    const iniciar = (id: string) =>
      request(app.server)
        .post(`/api/rrpp/ingresos/${id}/iniciar`)
        .set('Cookie', rrpp);
    expect((await iniciar(p.id)).status).toBe(409);
    expect((await iniciar('invalido')).status).toBe(400);
    expect((await iniciar(randomUUID())).status).toBe(404);
    await db
      .update(proyectos)
      .set({ notificadoRrpp: true, estado: 'retirado' })
      .where(eq(proyectos.id, p.id));
    expect((await iniciar(p.id)).status).toBe(409);
    await db
      .update(proyectos)
      .set({ estado: 'en_proceso' })
      .where(eq(proyectos.id, p.id));
    await db
      .insert(workItems)
      .values({ proyectoId: p.id, tipo: 'intake_rrpp', estado: 'cancelado' });
    expect((await iniciar(p.id)).status).toBe(409);
    expect(await eventos(p.id, 'INTAKE_RRPP_INICIADO')).toHaveLength(0);
  });

  it('actividad expone lenguaje de producto y omite logs técnicos y payloads sensibles', async () => {
    const { p } = await preparado();
    const comercial = await registrarYLoguear(app, 'comercial');
    const rrpp = await registrarYLoguear(app, 'rrpp');
    await entregar(p.id, comercial);
    await db
      .insert(auditLogs)
      .values({
        accion: 'LOG_TECNICO_INTERNO',
        entityType: 'proyecto',
        entityId: p.id,
        proyectoId: p.id,
        detalles: { secreto: 'NO_PUBLICAR' },
      });
    const d = await dashboard(rrpp);
    expect(d.actividad).toHaveLength(1);
    expect(Object.keys(d.actividad[0]).sort()).toEqual([
      'contexto',
      'fecha',
      'id',
      'proyecto',
      'titulo',
    ]);
    expect(JSON.stringify(d)).not.toMatch(
      /LOG_TECNICO|RRPP_NOTIFICADO|NO_PUBLICAR|passwordHash|detalles|actorId|briefEnlace/,
    );
  });

  it('exige sesión para datos y acciones', async () => {
    expect((await request(app.server).get('/api/rrpp/dashboard')).status).toBe(
      401,
    );
    expect(
      (
        await request(app.server).post(
          `/api/rrpp/ingresos/${randomUUID()}/iniciar`,
        )
      ).status,
    ).toBe(401);
  });
  it.each(ROLES.filter((rol) => rol !== 'rrpp'))(
    'no permite datos ni acciones RRPP al rol %s',
    async (rol) => {
      const { p } = await preparado();
      const cookie = await registrarYLoguear(
        app,
        rol,
        rol === 'autor' ? p.autorId : undefined,
      );
      expect(
        (
          await request(app.server)
            .get('/api/rrpp/dashboard')
            .set('Cookie', cookie)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app.server)
            .post(`/api/rrpp/ingresos/${p.id}/iniciar`)
            .set('Cookie', cookie)
        ).status,
      ).toBe(403);
    },
  );
});
