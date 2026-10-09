import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import {
  auditLogs,
  fichasTrazabilidad,
  notificaciones,
  proyectos,
  ROLES,
  servicios,
  workItems,
} from '../server/db/schema/index.js';
import { evaluarPreparacionRrpp } from '../server/helpers/preparacionRrpp.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import {
  crearFichaComercialCompleta,
  crearProyectoDePrueba,
} from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('Ingresos RRPP: diagnóstico canónico y handoff protegido', () => {
  let app: ReturnType<typeof crearAppDePrueba>;
  beforeEach(async () => {
    await limpiarBaseDeDatos();
    app = crearAppDePrueba();
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });
  async function preparado(crudo = false) {
    const p = await crearProyectoDePrueba();
    await crearFichaComercialCompleta(p.id);
    if (crudo)
      await db
        .update(servicios)
        .set({ codigo: 'CR' })
        .where(eq(servicios.id, p.servicioId));
    const comercial = await registrarYLoguear(app, 'comercial');
    const rrpp = await registrarYLoguear(app, 'rrpp');
    return { p, comercial, rrpp };
  }
  const completar = {
    matrizDiagnosticoGenerado: true,
    matrizIngresoGenerado: true,
  };
  const lista = (cookie: string) =>
    request(app.server).get('/api/rrpp/ingresos').set('Cookie', cookie);
  const detalle = (id: string, cookie: string) =>
    request(app.server).get(`/api/rrpp/ingresos/${id}`).set('Cookie', cookie);
  const guardar = (id: string, cookie: string, body: object) =>
    request(app.server)
      .patch(`/api/rrpp/ingresos/${id}`)
      .set('Cookie', cookie)
      .send(body);
  const enviar = (id: string, cookie: string) =>
    request(app.server)
      .post(`/api/proyectos/${id}/notificar-jefatura`)
      .set('Cookie', cookie);
  async function entregar(id: string, cookie: string) {
    expect(
      (
        await request(app.server)
          .post(`/api/proyectos/${id}/notificar-rrpp`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(201);
  }
  const eventos = (id: string, accion: string) =>
    db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.proyectoId, id), eq(auditLogs.accion, accion)));

  it('ready Comercial no aparece sin entrega formal, ni expone su contexto', async () => {
    const { p, comercial, rrpp } = await preparado();
    expect((await lista(rrpp)).body.ingresos).toEqual([]);
    expect((await detalle(p.id, rrpp)).status).toBe(404);
    expect((await guardar(p.id, rrpp, completar)).status).toBe(404);
    expect((await enviar(p.id, rrpp)).status).toBe(409);
    await entregar(p.id, comercial);
    expect((await lista(rrpp)).body.ingresos[0]).toMatchObject({
      id: p.id,
      estado: 'nuevo',
      preparacion: { progreso: 0 },
    });
    expect((await detalle(p.id, rrpp)).body.contexto.capitulos).toBe('1 a 5');
  });
  it('persiste RRPP en la misma ficha: catálogo, contenido opcional, notas separadas y progreso documental', async () => {
    const { p, comercial, rrpp } = await preparado();
    await entregar(p.id, comercial);
    const parcial = await guardar(p.id, rrpp, {
      coleccionPanhouse: 'Literatura',
      temaGeneral: 'Memorias',
      matrizObservacionesComerciales: 'Notas del diagnóstico',
      matrizDiagnosticoGenerado: true,
    });
    expect(parcial.status).toBe(200);
    expect(parcial.body).toMatchObject({
      estado: 'diagnostico',
      preparacion: { progreso: 50, listoParaJefatura: false },
      datos: { coleccionPanhouse: 'Literatura' },
      contexto: { observaciones: null },
    });
    expect(
      parcial.body.preparacion.faltantes.map((f: { campo: string }) => f.campo),
    ).toEqual(['matrizIngresoGenerado']);
    const listo = await guardar(p.id, rrpp, { matrizIngresoGenerado: true });
    expect(listo.body).toMatchObject({
      estado: 'listo',
      preparacion: { progreso: 100, listoParaJefatura: true },
      enviadoAt: null,
    });
    const [f] = await db
      .select()
      .from(fichasTrazabilidad)
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    expect(f).toMatchObject({
      temaGeneral: 'Memorias',
      coleccionPanhouse: 'Literatura',
      matrizObservacionesComerciales: 'Notas del diagnóstico',
      ingresoObservaciones: null,
    });
    expect(await eventos(p.id, 'INTAKE_RRPP_INICIADO')).toHaveLength(1);
    expect(await eventos(p.id, 'DIAGNOSTICO_COMPLETADO')).toHaveLength(1);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.proyectoId, p.id)),
    ).toHaveLength(1);
  });
  it('colección usa catálogo real y no convierte campos de contenido opcionales en gates', async () => {
    const { p, comercial, rrpp } = await preparado();
    await entregar(p.id, comercial);
    expect((await lista(rrpp)).body.catalogos.colecciones).toContain(
      'PanHouse Kids',
    );
    expect(
      (await guardar(p.id, rrpp, { coleccionPanhouse: 'Colección inventada' }))
        .status,
    ).toBe(400);
    expect(
      (
        await guardar(p.id, rrpp, {
          ...completar,
          coleccionPanhouse: 'Sin asignar',
          posibleTituloLibro: null,
          publicoPerfil: null,
          temaGeneral: null,
        })
      ).body.preparacion.listoParaJefatura,
    ).toBe(true);
  });
  it('CR añade un pendiente aplicable y mantiene fechas operativas 150 / 90; título tentativo no es gate creativo', async () => {
    const { p, comercial, rrpp } = await preparado(true);
    await entregar(p.id, comercial);
    const inicial = (await detalle(p.id, rrpp)).body;
    expect(inicial.fechaProyectada).toBeNull();
    expect(inicial.preparacion.checklist).toHaveLength(3);
    const pendiente = await guardar(p.id, rrpp, completar);
    expect(pendiente.body.preparacion).toMatchObject({
      progreso: 67,
      listoParaJefatura: false,
    });
    expect((await enviar(p.id, rrpp)).status).toBe(409);
    const tripa = await guardar(p.id, rrpp, {
      ingresoServicioSubtipoCrudo: 'Tripa',
    });
    expect(tripa.body).toMatchObject({
      fechaProyectada: '2026-04-01',
      preparacion: { progreso: 100 },
    });
    const capitulo = await guardar(p.id, rrpp, {
      ingresoServicioSubtipoCrudo: 'Capítulo',
      posibleTituloLibro: 'Tentativo',
    });
    expect(capitulo.body.fechaProyectada).toBe('2026-05-31');
    const [proyecto] = await db
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, p.id));
    expect(proyecto!.tituloDefinitivo).toBeNull();
  });
  it('no acepta subtipo de Crudo cuando el servicio no aplica', async () => {
    const { p, comercial, rrpp } = await preparado();
    await entregar(p.id, comercial);
    expect(
      (await guardar(p.id, rrpp, { ingresoServicioSubtipoCrudo: 'Tripa' }))
        .status,
    ).toBe(400);
    expect((await detalle(p.id, rrpp)).body.preparacion.checklist).toHaveLength(
      2,
    );
  });
  it('guardar simultáneo/retry no duplica audit ni work items ni notificaciones', async () => {
    const { p, comercial, rrpp } = await preparado();
    await entregar(p.id, comercial);
    const resultados = await Promise.all([
      guardar(p.id, rrpp, completar),
      guardar(p.id, rrpp, completar),
    ]);
    expect(resultados.map((r) => r.status)).toEqual([200, 200]);
    expect(await eventos(p.id, 'DIAGNOSTICO_COMPLETADO')).toHaveLength(1);
    expect(await eventos(p.id, 'INTAKE_RRPP_INICIADO')).toHaveLength(1);
    expect(
      await db.select().from(workItems).where(eq(workItems.proyectoId, p.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.proyectoId, p.id)),
    ).toHaveLength(1);
  });
  it('handoff incompleto bloqueado; completo/concurrente tiene un único efecto y queda consultable', async () => {
    const { p, comercial, rrpp } = await preparado();
    await entregar(p.id, comercial);
    expect((await enviar(p.id, rrpp)).status).toBe(409);
    expect(await eventos(p.id, 'JEFATURA_NOTIFICADA')).toHaveLength(0);
    await guardar(p.id, rrpp, completar);
    const r = await Promise.all([enviar(p.id, rrpp), enviar(p.id, rrpp)]);
    expect(r.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await eventos(p.id, 'JEFATURA_NOTIFICADA')).toHaveLength(1);
    expect((await detalle(p.id, rrpp)).body).toMatchObject({
      estado: 'enviado',
      editable: false,
    });
    expect((await detalle(p.id, rrpp)).body.enviadoAt).toBeTruthy();
    expect((await guardar(p.id, rrpp, { temaGeneral: 'Cambiar' })).status).toBe(
      409,
    );
    const items = await db
      .select()
      .from(workItems)
      .where(eq(workItems.proyectoId, p.id));
    expect(items.map((i) => [i.tipo, i.estado]).sort()).toEqual([
      ['asignacion_especialista', 'pendiente'],
      ['intake_rrpp', 'completado'],
    ]);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(
          and(
            eq(notificaciones.proyectoId, p.id),
            eq(notificaciones.rolDestino, 'jefe_area'),
          ),
        ),
    ).toHaveLength(1);
  });
  it('contexto Comercial live cambia tras el handoff RRPP y tras Jefatura, sin copiar ficha ni renotificar', async () => {
    const { p, comercial, rrpp } = await preparado();
    await entregar(p.id, comercial);
    expect((await detalle(p.id, rrpp)).body.contexto.capitulos).toBe('1 a 5');
    const cambio = () =>
      request(app.server)
        .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-contrato`)
        .set('Cookie', comercial)
        .send({ capitulosPactados: '12', paginasPactadas: '240' });
    expect((await cambio()).status).toBe(200);
    expect((await detalle(p.id, rrpp)).body).toMatchObject({
      contexto: { capitulos: '12', paginas: '240' },
      actualizadoPor: 'Actualizado desde Comercial',
    });
    await guardar(p.id, rrpp, completar);
    expect((await enviar(p.id, rrpp)).status).toBe(201);
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-perfil`)
          .set('Cookie', comercial)
          .send({ ingresoObservaciones: 'Actualización posterior' })
      ).status,
    ).toBe(200);
    expect((await detalle(p.id, rrpp)).body.contexto.observaciones).toBe(
      'Actualización posterior',
    );
    expect(await eventos(p.id, 'RRPP_NOTIFICADO')).toHaveLength(1);
    expect(
      await eventos(p.id, 'INFORMACION_COMERCIAL_ACTUALIZADA'),
    ).toHaveLength(2);
    expect(
      await db
        .select()
        .from(fichasTrazabilidad)
        .where(eq(fichasTrazabilidad.proyectoId, p.id)),
    ).toHaveLength(1);
  });
  it('lista distingue cuatro estados y conserva enviados históricos', async () => {
    const { p, comercial, rrpp } = await preparado();
    await entregar(p.id, comercial);
    expect((await lista(rrpp)).body.ingresos[0].estado).toBe('nuevo');
    await request(app.server)
      .post(`/api/rrpp/ingresos/${p.id}/iniciar`)
      .set('Cookie', rrpp);
    expect((await lista(rrpp)).body.ingresos[0].estado).toBe('diagnostico');
    await guardar(p.id, rrpp, completar);
    expect((await lista(rrpp)).body.ingresos[0].estado).toBe('listo');
    await enviar(p.id, rrpp);
    await db
      .update(proyectos)
      .set({ estado: 'culminado' })
      .where(eq(proyectos.id, p.id));
    expect((await lista(rrpp)).body.ingresos[0].estado).toBe('enviado');
    expect((await detalle(p.id, rrpp)).body.editable).toBe(false);
  });
  it('IDs inválidos, inexistentes y payloads arbitrarios están protegidos', async () => {
    const { p, comercial, rrpp } = await preparado();
    await entregar(p.id, comercial);
    expect((await detalle('no-uuid', rrpp)).status).toBe(400);
    expect((await detalle(randomUUID(), rrpp)).status).toBe(404);
    expect(
      (
        await guardar(p.id, rrpp, {
          notificadoJefatura: true,
          matrizIngresoGenerado: true,
        })
      ).status,
    ).toBe(400);
    expect(
      (await guardar(p.id, rrpp, { fechaDeseadaCulminacion: '2026-02-30' }))
        .status,
    ).toBe(400);
    expect((await guardar(p.id, rrpp, {})).status).toBe(400);
  });
  it('RRPP no edita Comercial ni desde el workspace ni desde la ruta legacy', async () => {
    const { p, comercial, rrpp } = await preparado();
    await entregar(p.id, comercial);
    expect(
      (
        await guardar(p.id, rrpp, {
          ingresoObservaciones: 'Invadir',
          capitulosPactados: '999',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-perfil`)
          .set('Cookie', rrpp)
          .send({ ingresoObservaciones: 'Invadir' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-contrato`)
          .set('Cookie', rrpp)
          .send({ capitulosPactados: '999' })
      ).status,
    ).toBe(403);
    expect((await detalle(p.id, rrpp)).body.contexto.capitulos).toBe('1 a 5');
  });
  it.each(ROLES.filter((r) => r !== 'rrpp'))(
    'rol %s no accede/escribe el workspace ni hace handoff Jefatura',
    async (rol) => {
      const { p, comercial } = await preparado();
      await entregar(p.id, comercial);
      const cookie = await registrarYLoguear(app, rol);
      expect((await lista(cookie)).status).toBe(403);
      expect((await detalle(p.id, cookie)).status).toBe(403);
      expect((await guardar(p.id, cookie, completar)).status).toBe(403);
      expect((await enviar(p.id, cookie)).status).toBe(403);
    },
  );
  it('Comercial tampoco puede colar campos RRPP en sus PATCH', async () => {
    const { p, comercial } = await preparado();
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-perfil`)
          .set('Cookie', comercial)
          .send({ ingresoServicioSubtipoCrudo: 'Tripa' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-perfil`)
          .set('Cookie', comercial)
          .send({ ingresoObservaciones: 'Permitido', temaGeneral: 'RRPP' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/ficha-editorial`)
          .set('Cookie', comercial)
          .send({ temaGeneral: 'RRPP' })
      ).status,
    ).toBe(403);
  });
});

describe('Preparación RRPP central', () => {
  it('denominador respeta CR; no exige contenido opcional ni mezcla ready/handoff', () => {
    const f = {
      matrizDiagnosticoGenerado: true,
      matrizIngresoGenerado: false,
      ingresoServicioSubtipoCrudo: null,
    };
    expect(evaluarPreparacionRrpp(f, 'EF')).toMatchObject({
      progreso: 50,
      listoParaJefatura: false,
    });
    expect(evaluarPreparacionRrpp(f, 'CR')).toMatchObject({
      progreso: 33,
      listoParaJefatura: false,
    });
    expect(
      evaluarPreparacionRrpp({ ...f, matrizIngresoGenerado: true }, 'EF'),
    ).toMatchObject({ progreso: 100, listoParaJefatura: true, faltantes: [] });
  });
});
