import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import {
  auditLogs,
  autores,
  capitulos,
  correcciones,
  direccionesCreativas,
  fichaDisenoPropuestas,
  fichaLanzamientoReuniones,
  fichasTrazabilidad,
  notificaciones,
  projectAssignments,
  proyectos,
  proyectosAutores,
  ROLES,
  servicios,
  workItems,
} from '../server/db/schema/index.js';
import { estadoEtapa } from '../server/helpers/rrppProyectos.js';
import { registrarYLoguear } from './helpers/auth.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import {
  crearAutor,
  crearFichaComercialCompleta,
  crearProyecto,
  crearProyectoDePrueba,
  crearUsuario,
} from './helpers/fixtures.js';
import { crearAppDePrueba } from './helpers/testApp.js';

describe('Explorador RRPP: consulta canónica, paginación y etapas honestas', () => {
  let app: ReturnType<typeof crearAppDePrueba>;
  let cookie: string;
  beforeEach(async () => {
    await limpiarBaseDeDatos();
    app = crearAppDePrueba();
    await app.ready();
    cookie = await registrarYLoguear(app, 'rrpp');
  });
  afterEach(async () => {
    await app.close();
  });
  const lista = (query = '') =>
    request(app.server)
      .get(`/api/rrpp/proyectos${query}`)
      .set('Cookie', cookie);
  const detalle = (id: string) =>
    request(app.server)
      .get(`/api/rrpp/proyectos/${id}/resumen`)
      .set('Cookie', cookie);
  async function preparado() {
    const p = await crearProyectoDePrueba();
    const ficha = await crearFichaComercialCompleta(p.id);
    await db
      .update(proyectos)
      .set({ notificadoRrpp: true })
      .where(eq(proyectos.id, p.id));
    return { p, ficha };
  }
  async function evento(id: string, accion: string, fecha = new Date()) {
    await db.insert(auditLogs).values({
      proyectoId: id,
      accion,
      entityType: 'proyecto',
      entityId: id,
      detalles: { secreto: 'NO_EXPONER' },
      createdAt: fecha,
    });
  }
  it('lista incluye históricos y proyectos accesibles fuera del intake sin ampliar el RBAC de ficha', async () => {
    const p = await crearProyectoDePrueba({ estado: 'culminado' });
    const res = await lista();
    expect(res.status).toBe(200);
    expect(res.body.proyectos[0]).toMatchObject({
      id: p.id,
      estado: 'culminado',
      contextoRrpp: 'sin_ingreso',
    });
    const d = await detalle(p.id);
    expect(d.status).toBe(200);
    expect(d.body.contexto).toBeNull();
    expect(d.body.abrirIngreso).toBe(false);
    expect(
      d.body.stages.every(
        (s: { progress: number | null }) => s.progress === null,
      ),
    ).toBe(true);
  });
  it('vacío legítimo y filtro sin coincidencias conservan count/paginación', async () => {
    expect((await lista()).body).toMatchObject({
      proyectos: [],
      total: 0,
      pagina: 1,
      paginas: 1,
    });
    await preparado();
    expect((await lista('?q=inexistente')).body.total).toBe(0);
  });
  it('busca autor, coautor, código, título histórico/definitivo y título tentativo', async () => {
    const { p, ficha } = await preparado();
    const a = await crearAutor({ nombre: 'Coautora Buscable' });
    await db
      .update(autores)
      .set({ nombre: 'Principal Buscable' })
      .where(eq(autores.id, p.autorId));
    await db
      .insert(proyectosAutores)
      .values({ proyectoId: p.id, autorId: a.id });
    await db
      .update(proyectos)
      .set({
        codigo: 'ABC789',
        titulo: 'Histórico Especial',
        tituloDefinitivo: 'Definitivo Especial',
      })
      .where(eq(proyectos.id, p.id));
    await db
      .update(fichasTrazabilidad)
      .set({ posibleTituloLibro: 'Tentativo Especial' })
      .where(eq(fichasTrazabilidad.id, ficha.id));
    for (const q of [
      'principal',
      'coautora',
      'abc789',
      'histórico',
      'definitivo',
      'tentativo',
    ]) {
      const res = await lista(`?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
      expect(res.body.proyectos.map((p: { id: string }) => p.id)).toEqual([
        p.id,
      ]);
    }
    expect((await detalle(p.id)).body.informacion).toMatchObject({
      autorPrincipal: 'Principal Buscable',
      coautores: ['Coautora Buscable'],
      titulo: 'Definitivo Especial',
      posibleTitulo: 'Tentativo Especial',
    });
  });
  it('escapa comodines SQL de búsqueda', async () => {
    await preparado();
    expect((await lista('?q=%25')).body.total).toBe(0);
    expect((await lista('?q=_')).body.total).toBe(0);
  });
  it('filtra servicio histórico inactivo, macro y contexto derivado', async () => {
    const { p } = await preparado();
    await db
      .update(servicios)
      .set({ activo: false })
      .where(eq(servicios.id, p.servicioId));
    await db
      .update(proyectos)
      .set({ estado: 'retirado', notificadoJefatura: true })
      .where(eq(proyectos.id, p.id));
    expect(
      (await lista(`?servicio=${p.servicioId}&estado=retirado&rrpp=enviado`))
        .body.total,
    ).toBe(1);
    expect((await lista('?estado=en_proceso')).body.total).toBe(0);
    expect((await lista('?rrpp=ingreso')).body.total).toBe(0);
    expect((await lista()).body.catalogos.servicios[0].id).toBe(p.servicioId);
    await db
      .update(proyectos)
      .set({ notificadoJefatura: false })
      .where(eq(proyectos.id, p.id));
    expect((await lista('?rrpp=cerrado')).body.total).toBe(1);
    expect((await detalle(p.id)).body).toMatchObject({
      contextoRrpp: 'cerrado',
      abrirIngreso: false,
    });
    await db
      .update(proyectos)
      .set({ estado: 'en_proceso' })
      .where(eq(proyectos.id, p.id));
    await db
      .insert(workItems)
      .values({ proyectoId: p.id, tipo: 'intake_rrpp', estado: 'cancelado' });
    expect((await lista('?rrpp=ingreso')).body.total).toBe(0);
    expect((await detalle(p.id)).body).toMatchObject({
      contextoRrpp: 'cerrado',
      abrirIngreso: false,
    });
  });
  it('pagina en SQL a 25 y evita duplicados al unir coautores', async () => {
    const p = await crearProyectoDePrueba();
    for (let i = 0; i < 27; i++)
      await crearProyecto({
        autorId: p.autorId,
        unidadId: p.unidadId,
        presupuestoId: p.presupuestoId,
        servicioId: p.servicioId,
        fechaProgramadaInicio: '2026-01-01',
      });
    const a = await crearAutor();
    await db
      .insert(proyectosAutores)
      .values({ proyectoId: p.id, autorId: a.id });
    const primera = (await lista()).body;
    const segunda = (await lista('?pagina=2')).body;
    expect(primera).toMatchObject({ total: 28, paginas: 2, porPagina: 25 });
    expect(primera.proyectos).toHaveLength(25);
    expect(segunda.proyectos).toHaveLength(3);
    expect(
      new Set([...primera.proyectos, ...segunda.proyectos].map((p) => p.id))
        .size,
    ).toBe(28);
    expect((await lista('?pagina=999')).body.pagina).toBe(2);
  });
  it('ordena por actividad de negocio, excluye timestamps/logs técnicos', async () => {
    const { p: a } = await preparado();
    const { p: b } = await preparado();
    await evento(a.id, 'EDITOR_ASIGNADO', new Date('2026-02-01Z'));
    await evento(b.id, 'RRPP_NOTIFICADO', new Date('2026-01-01Z'));
    await evento(b.id, 'PATCH_TECNICO', new Date('2026-03-01Z'));
    expect(
      (await lista()).body.proyectos.map((p: { id: string }) => p.id),
    ).toEqual([a.id, b.id]);
    expect(
      (await lista('?orden=antiguos')).body.proyectos.map(
        (p: { id: string }) => p.id,
      ),
    ).toEqual([b.id, a.id]);
    expect((await detalle(b.id)).body.actualizadoAt).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
  it('intake porcentaje usa exactamente requisitos aplicables CR; ninguna otra etapa calcula porcentaje', async () => {
    const { p, ficha } = await preparado();
    await db
      .update(servicios)
      .set({ codigo: 'CR' })
      .where(eq(servicios.id, p.servicioId));
    await db
      .update(fichasTrazabilidad)
      .set({
        matrizDiagnosticoGenerado: true,
        ingresoServicioSubtipoCrudo: 'Tripa',
      })
      .where(eq(fichasTrazabilidad.id, ficha.id));
    const d = (await detalle(p.id)).body;
    expect(d.stages[0].progress).toBe(67);
    expect(d.subtipoCrudo).toBe('Tripa');
    expect(
      d.stages
        .slice(1)
        .every((s: { progress: number | null }) => s.progress === null),
    ).toBe(true);
    expect(d.fechas.proyectada).toBe('2026-04-01');
  });
  it('sin clasificación CR no fabrica fecha fin ni SLA', async () => {
    const { p } = await preparado();
    await db
      .update(servicios)
      .set({ codigo: 'CR' })
      .where(eq(servicios.id, p.servicioId));
    const d = (await detalle(p.id)).body;
    expect(d.fechas.proyectada).toBeNull();
    expect(d.subtipoCrudo).toBeNull();
    expect(d).not.toHaveProperty('sla');
  });
  it('última actividad de etapa se conserva aunque esté fuera de la primera página del historial', async () => {
    const { p } = await preparado();
    await evento(p.id, 'EDITOR_ASIGNADO', new Date('2026-01-01Z'));
    for (let i = 0; i < 35; i++)
      await evento(
        p.id,
        'DIAGNOSTICO_ACTUALIZADO',
        new Date(Date.UTC(2026, 1, i + 1)),
      );
    const d = (await detalle(p.id)).body;
    expect(
      d.eventos.every(
        (e: { titulo: string }) => e.titulo !== 'Edición asignó editor',
      ),
    ).toBe(true);
    expect(
      d.stages.find((s: { key: string }) => s.key === 'edicion')
        .ultimaActividad,
    ).toBe('2026-01-01T00:00:00.000Z');
  });
  it('vencimiento corrección conserva la hora fijada y responsable freelance canónico', async () => {
    const { p } = await preparado();
    const [item] = await db
      .insert(workItems)
      .values({ proyectoId: p.id, tipo: 'correccion', estado: 'en_progreso' })
      .returning();
    await db.insert(correcciones).values({
      proyectoId: p.id,
      workItemId: item!.id,
      alcance: 'preliminares',
      correctorNombre: 'Corrector externo',
      dueAt: new Date('2026-10-10T18:30:00Z'),
    });
    expect(
      (await detalle(p.id)).body.stages.find(
        (s: { key: string }) => s.key === 'correccion',
      ),
    ).toMatchObject({
      dueAt: '2026-10-10T18:30:00.000Z',
      responsables: ['Corrector externo'],
    });
  });
  it('fechas pautadas de work item siguen siendo fechas sin horas ficticias', async () => {
    const { p } = await preparado();
    await db.insert(workItems).values({
      proyectoId: p.id,
      tipo: 'edicion',
      estado: 'en_progreso',
      fechaFinPautada: '2026-10-30',
    });
    expect(
      (await detalle(p.id)).body.stages.find(
        (s: { key: string }) => s.key === 'edicion',
      ).dueAt,
    ).toBe('2026-10-30');
  });
  it('otras áreas reales abiertas no desaparecen del responsable actual', async () => {
    const { p } = await preparado();
    await db.insert(workItems).values({
      proyectoId: p.id,
      tipo: 'soporte_digital',
      estado: 'en_progreso',
    });
    const d = (await detalle(p.id)).body;
    expect(d.responsableActual).toBe('Soporte digital');
    expect(
      d.stages.find((s: { key: string }) => s.key === 'digital'),
    ).toMatchObject({ estado: 'en_progreso', progress: null });
  });
  it('estatus legacy se conserva sin transformarlo en porcentaje o transición ficticia', async () => {
    const { p, ficha } = await preparado();
    await db
      .update(fichasTrazabilidad)
      .set({ edicionEstatus: 'Esperando respuesta editorial' })
      .where(eq(fichasTrazabilidad.id, ficha.id));
    expect(
      (await detalle(p.id)).body.stages.find(
        (s: { key: string }) => s.key === 'edicion',
      ),
    ).toMatchObject({
      registrado: 'Esperando respuesta editorial',
      progress: null,
      instancias: 0,
    });
  });
  it('histórico entregado sin requisitos conservados no inventa porcentaje 100', async () => {
    const { p } = await preparado();
    await db
      .update(proyectos)
      .set({ notificadoJefatura: true, estado: 'culminado' })
      .where(eq(proyectos.id, p.id));
    const d = (await detalle(p.id)).body;
    expect(d.stages[0]).toMatchObject({ estado: 'completado', progress: null });
    expect(d.abrirIngreso).toBe(false);
  });
  it('respeta paralelismo, asignaciones de tarea/proyecto, freelance y bloqueos de otras instancias', async () => {
    const { p } = await preparado();
    const editor = await crearUsuario('editor');
    const creativo = await crearUsuario('lider_creativo');
    const trabajos = await db
      .insert(workItems)
      .values([
        { proyectoId: p.id, tipo: 'edicion', estado: 'en_progreso' },
        { proyectoId: p.id, tipo: 'direccion_creativa', estado: 'en_progreso' },
        {
          proyectoId: p.id,
          tipo: 'edicion',
          businessKey: 'segunda',
          estado: 'bloqueado',
        },
      ])
      .returning();
    await db.insert(projectAssignments).values([
      { proyectoId: p.id, tipo: 'editor', usuarioId: editor.id },
      {
        proyectoId: p.id,
        tipo: 'lider_creativo',
        usuarioId: creativo.id,
        workItemId: trabajos[1]!.id,
      },
    ]);
    await evento(p.id, 'EDITOR_ASIGNADO');
    const d = (await detalle(p.id)).body;
    expect(d.responsableActual).toBe('2 áreas con trabajo en curso');
    expect(
      d.stages.find((s: { key: string }) => s.key === 'edicion'),
    ).toMatchObject({
      estado: 'en_progreso',
      responsables: [editor.nombre],
      bloqueadas: 1,
    });
    expect(
      d.stages.find((s: { key: string }) => s.key === 'creativa'),
    ).toMatchObject({ estado: 'en_progreso', responsables: [creativo.nombre] });
  });
  it('producción solo expone resumen útil de capítulos, no contenido/documentos', async () => {
    const { p } = await preparado();
    await db.insert(capitulos).values([
      {
        proyectoId: p.id,
        numero: 1,
        fechaEntregaEditor: '2026-02-01',
        observacionesEditor: 'NO_EXPONER',
      },
      { proyectoId: p.id, numero: 2 },
    ]);
    const res = await detalle(p.id);
    expect(res.body.produccion.capitulos).toEqual({
      cantidad: 2,
      entregados: 1,
    });
    expect(JSON.stringify(res.body)).not.toContain('NO_EXPONER');
    expect(
      (
        await request(app.server)
          .patch(`/api/rrpp/proyectos/${p.id}/resumen`)
          .set('Cookie', cookie)
          .send({ estado: 'completado' })
      ).status,
    ).toBe(404);
  });
  it('conceptos pendientes usan aprobación RRPP real y excluyen cerrados/devueltos', async () => {
    const { p, ficha } = await preparado();
    const [item] = await db
      .insert(workItems)
      .values({
        proyectoId: p.id,
        tipo: 'direccion_creativa',
        estado: 'en_progreso',
      })
      .returning();
    const [direccion] = await db
      .insert(direccionesCreativas)
      .values({
        proyectoId: p.id,
        workItemId: item!.id,
        briefEnlace: 'NO_EXPONER',
        enlaceGrabacion: 'NO_EXPONER',
      })
      .returning();
    const [propuesta] = await db
      .insert(fichaDisenoPropuestas)
      .values({
        fichaId: ficha.id,
        direccionCreativaId: direccion!.id,
        descripcion: 'Concepto real',
        enlace: 'https://example.test/concepto',
      })
      .returning();
    await db.insert(fichaDisenoPropuestas).values({
      fichaId: ficha.id,
      direccionCreativaId: direccion!.id,
      estado: 'Devuelta por RRPP',
    });
    const d = (await detalle(p.id)).body;
    expect(d.contextoRrpp).toBe('conceptos');
    expect(d.creativa.revision[0].propuestas).toHaveLength(1);
    expect(d.creativa.revision[0].propuestas[0].id).toBe(propuesta!.id);
    expect(JSON.stringify(d)).not.toContain('NO_EXPONER');
    expect((await lista('?rrpp=conceptos')).body.total).toBe(1);
    await db
      .update(direccionesCreativas)
      .set({ fechaCierre: '2026-02-01' })
      .where(eq(direccionesCreativas.id, direccion!.id));
    expect((await detalle(p.id)).body.creativa.revision).toEqual([]);
    expect((await lista('?rrpp=conceptos')).body.total).toBe(0);
  });
  it('muestra reuniones/ferias canónicas y contexto lanzamiento desde work item', async () => {
    const { p, ficha } = await preparado();
    await db
      .insert(workItems)
      .values({ proyectoId: p.id, tipo: 'lanzamiento', estado: 'en_progreso' });
    await db
      .update(fichasTrazabilidad)
      .set({
        lanzamientoPromocionFechaTentativa: '2026-10-20',
        lanzamientoPromocionTipo: 'Presentación',
      })
      .where(eq(fichasTrazabilidad.id, ficha.id));
    await db.insert(fichaLanzamientoReuniones).values({
      fichaId: ficha.id,
      fecha: '2026-10-10',
      acuerdos: 'Acuerdo real',
    });
    const d = (await detalle(p.id)).body;
    expect(d.contextoRrpp).toBe('lanzamiento');
    expect(d.fechas.lanzamiento).toBe('2026-10-20');
    expect(d.lanzamiento.reuniones[0].acuerdos).toBe('Acuerdo real');
    expect((await lista('?rrpp=lanzamiento')).body.total).toBe(1);
  });
  it('timeline humano allowlist, sin payloads técnicos, historia paginada y ajena excluida', async () => {
    const { p } = await preparado();
    const { p: otro } = await preparado();
    for (let i = 0; i < 32; i++)
      await evento(
        p.id,
        'DISENO_VERSION_ENTREGADA',
        new Date(Date.UTC(2026, 0, i + 1)),
      );
    await evento(p.id, 'WORK_ITEM_TRANSITION');
    await evento(otro.id, 'CONCEPTO_APROBADO_AUTOR');
    const d = (await detalle(p.id)).body;
    expect(d.eventos).toHaveLength(6);
    expect(d.eventos[0].titulo).toBe('Diseño entregó una versión');
    const historial = (
      await request(app.server)
        .get(`/api/rrpp/proyectos/${p.id}/historial`)
        .set('Cookie', cookie)
    ).body;
    expect(historial).toMatchObject({ total: 32, paginas: 2 });
    expect(historial.eventos).toHaveLength(30);
    expect(JSON.stringify(historial)).not.toMatch(
      /NO_EXPONER|actorId|entityId|detalles|WORK_ITEM_TRANSITION|Autor aprobó/,
    );
    expect(
      (
        await request(app.server)
          .get(`/api/rrpp/proyectos/${p.id}/historial?pagina=2`)
          .set('Cookie', cookie)
      ).body.eventos,
    ).toHaveLength(2);
  });
  it('Comercial X→Y después de ambos handoffs se refleja al refetch con audit, sin nuevos handoffs', async () => {
    const { p } = await preparado();
    await db
      .update(proyectos)
      .set({ notificadoJefatura: true })
      .where(eq(proyectos.id, p.id));
    expect((await detalle(p.id)).body.contexto.capitulos).toBe('1 a 5');
    const comercial = await registrarYLoguear(app, 'comercial');
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-contrato`)
          .set('Cookie', comercial)
          .send({ capitulosPactados: '12' })
      ).status,
    ).toBe(200);
    expect((await detalle(p.id)).body.contexto.capitulos).toBe('12');
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.proyectoId, p.id));
    expect(logs.map((l) => l.accion)).toEqual([
      'INFORMACION_COMERCIAL_ACTUALIZADA',
    ]);
    expect(
      (
        await db
          .select()
          .from(notificaciones)
          .where(eq(notificaciones.proyectoId, p.id))
      ).length,
    ).toBe(0);
    expect(
      (await db.select().from(workItems).where(eq(workItems.proyectoId, p.id)))
        .length,
    ).toBe(0);
  });
  it('RRPP no obtiene controles de escritura Comercial/Creativa/Producción', async () => {
    const { p } = await preparado();
    const contrato = await request(app.server)
      .patch(`/api/fichas-trazabilidad/${p.id}/proyecto-contrato`)
      .set('Cookie', cookie)
      .send({ capitulosPactados: '999' });
    expect(contrato.status).toBe(403);
    const d = (await detalle(p.id)).body;
    expect(d).not.toHaveProperty('passwordHash');
    expect(d).not.toHaveProperty('manuscritoUrl');
    expect(d).not.toHaveProperty('notificaciones');
  });
  it('ids/filtros inválidos no exponen datos ni hacen consultas gigantes', async () => {
    expect((await detalle('invalido')).status).toBe(400);
    expect((await detalle(randomUUID())).status).toBe(404);
    for (const q of [
      '?pagina=0',
      '?pagina=1.5',
      '?estado=inventado',
      '?rrpp=inventado',
      '?servicio=bad',
      '?extra=secreto',
    ])
      expect((await lista(q)).status).toBe(400);
  });
  it('sesión requerida en lista, resumen e historial', async () => {
    for (const ruta of [
      '',
      `/${randomUUID()}/resumen`,
      `/${randomUUID()}/historial`,
    ])
      expect(
        (await request(app.server).get(`/api/rrpp/proyectos${ruta}`)).status,
      ).toBe(401);
  });
  it.each(ROLES.filter((r) => r !== 'rrpp'))(
    'rol %s no accede a lista/resumen/historial RRPP',
    async (rol) => {
      const otraCookie = await registrarYLoguear(app, rol);
      for (const ruta of [
        '',
        `/${randomUUID()}/resumen`,
        `/${randomUUID()}/historial`,
      ])
        expect(
          (
            await request(app.server)
              .get(`/api/rrpp/proyectos${ruta}`)
              .set('Cookie', otraCookie)
          ).status,
        ).toBe(403);
    },
  );
});
describe('Agregación discreta de instancias', () => {
  it.each([
    [[], 'pendiente'],
    [['completado', 'cancelado'], 'completado'],
    [['cancelado'], 'cancelado'],
    [['completado', 'pendiente'], 'pendiente'],
    [['bloqueado', 'completado'], 'bloqueado'],
    [['en_progreso', 'bloqueado'], 'en_progreso'],
  ] as const)('%j → %s', (estados, esperado) => {
    expect(estadoEtapa(estados.map((estado) => ({ estado })))).toBe(esperado);
  });
});
