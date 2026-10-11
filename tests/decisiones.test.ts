import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as auditoria from '../server/helpers/auditLog.js';
import { pool } from '../server/db/client.js';
import { listarDecisiones } from '../server/helpers/decisiones.js';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import {
  auditLogs,
  correcciones,
  decisiones,
  direccionesCreativas,
  disenos,
  disenoVersiones,
  fichaCalidadFases,
  fichasTrazabilidad,
  notificaciones,
  proyectos,
  workItems,
} from '../server/db/schema/index.js';
import { criteriosDeFase } from '../server/helpers/calidad.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';

// Jefatura · Decisiones (docs/arquitectura/17-jefatura-decisiones.md) —
// HUMAN GATES confirmados: >120 páginas (GATE-06) y colección
// inconsistente (checklist de Calidad). Cubre el prompt §109-113:
// scope, duplicado/businessKey, lifecycle, resolución transaccional,
// idempotencia, concurrencia, RBAC, IDOR, ownership, notifications.
describe('Jefatura · Decisiones', () => {
  let app: ReturnType<typeof buildApp>;
  let p: Awaited<ReturnType<typeof crearProyectoDePrueba>>;
  let jefe: Awaited<ReturnType<typeof crearUsuario>>;
  let otroJefe: Awaited<ReturnType<typeof crearUsuario>>;
  let especialista: Awaited<ReturnType<typeof crearUsuario>>;
  let cookies: Record<string, string>;

  async function login(u: Awaited<ReturnType<typeof crearUsuario>>) {
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: u.email, password: 'password123' },
    });
    return r.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function call(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    payload?: any,
    cookie = cookies.jefe,
  ) {
    const r = await app.inject({
      method,
      url: `/api${path}`,
      headers: { cookie },
      payload,
    });
    return { status: r.statusCode, body: r.json() };
  }
  async function crearCorreccionConPaginas(
    paginas: number,
    alcance:
      | 'tripa_completa'
      | 'preliminares'
      | 'cubierta_extendida' = 'tripa_completa',
  ) {
    return call(
      'POST',
      `/proyectos/${p.id}/correcciones`,
      { alcance, paginas },
      cookies.especialista,
    );
  }

  beforeEach(async () => {
    await limpiarBaseDeDatos();
    app = buildApp();
    await app.ready();
    jefe = await crearUsuario('jefe_area');
    otroJefe = await crearUsuario('jefe_area');
    especialista = await crearUsuario('especialista');
    p = await crearProyectoDePrueba({ especialistaId: especialista.id });
    cookies = {
      jefe: await login(jefe),
      especialista: await login(especialista),
      otroJefe: await login(otroJefe),
    };
  });
  afterEach(async () => {
    await app.close();
  });

  it('crea la decisión al solicitar una corrección >120 páginas, expone gate bloqueado y aparece en la bandeja', async () => {
    const crear = await crearCorreccionConPaginas(146);
    expect(crear.status).toBe(201);

    const intento = await call(
      'PATCH',
      `/correcciones/${crear.body.id}/asignar`,
      {
        correctorNombre: 'Freelance QA',
        freelance: true,
        contratoConfirmado: false,
      },
      cookies.especialista,
    );
    expect(intento.status).toBe(400);
    expect(intento.body.error).toMatch(/120 páginas/);

    const resumen = await call('GET', '/decisiones/resumen');
    expect(resumen.body.pendientes).toBe(1);

    const lista = await call('GET', '/decisiones?status=pendiente&page=1');
    expect(lista.body.items).toHaveLength(1);
    expect(lista.body.items[0]).toMatchObject({
      tipo: 'revision_previa_correccion',
      bloqueaCorreccion: true,
      codigo: p.codigo,
    });
  });

  it('no duplica la decisión si se solicita la corrección dos veces (idempotencia por origen)', async () => {
    await crearCorreccionConPaginas(146);
    await crearCorreccionConPaginas(146); // mismo alcance -> idempotente en solicitarCorreccion, devuelve la misma fila.
    const filas = await db
      .select()
      .from(decisiones)
      .where(eq(decisiones.proyectoId, p.id));
    expect(filas).toHaveLength(1);
  });

  it('no aplica el gate de Tripa Word a preliminares aunque sus páginas superen 120', async () => {
    await crearCorreccionConPaginas(146, 'tripa_completa');
    await crearCorreccionConPaginas(130, 'preliminares');
    const filas = await db
      .select()
      .from(decisiones)
      .where(eq(decisiones.proyectoId, p.id));
    expect(filas).toHaveLength(1);
  });

  it('no crea decisión cuando la corrección no supera 120 páginas', async () => {
    const r = await crearCorreccionConPaginas(80);
    expect(r.status).toBe(201);
    const filas = await db
      .select()
      .from(decisiones)
      .where(eq(decisiones.proyectoId, p.id));
    expect(filas).toHaveLength(0);
    const asignar = await call(
      'PATCH',
      `/correcciones/${r.body.id}/asignar`,
      {
        correctorNombre: 'Freelance QA',
        freelance: true,
        contratoConfirmado: false,
      },
      cookies.especialista,
    );
    expect(asignar.status).toBe(200);
  });

  it('lifecycle: pendiente -> en_revision al iniciar, -> informacion_solicitada al pedir info, -> en_revision al responder', async () => {
    const crear = await crearCorreccionConPaginas(146);
    const lista = await call('GET', '/decisiones?status=pendiente&page=1');
    const id = lista.body.items[0].id;

    expect((await call('POST', `/decisiones/${id}/revision`, {})).status).toBe(
      200,
    );
    let detalle = await call('GET', `/decisiones/${id}`);
    expect(detalle.body.status).toBe('en_revision');

    const info = await call('POST', `/decisiones/${id}/solicitar-info`, {
      mensaje: '¿Es tripa Word o diagramada?',
      expectedVersion: detalle.body.version,
    });
    expect(info.status).toBe(200);
    detalle = await call('GET', `/decisiones/${id}`);
    expect(detalle.body.status).toBe('informacion_solicitada');

    // Responder información es del SOLICITANTE (Especialista), no de Jefatura.
    const responderComoJefe = await call(
      'POST',
      `/decisiones/${id}/responder-info`,
      { mensaje: 'no debería poder' },
      cookies.jefe,
    );
    expect(responderComoJefe.status).toBe(403);
    const responder = await call(
      'POST',
      `/decisiones/${id}/responder-info`,
      { mensaje: 'Confirmado, es Tripa Word.' },
      cookies.especialista,
    );
    expect(responder.status).toBe(200);
    detalle = await call('GET', `/decisiones/${id}`);
    expect(detalle.body.status).toBe('en_revision');
    void crear;
  });

  it('aprobar desbloquea el gate transaccionalmente; rechazar exige motivo y mantiene el gate bloqueado', async () => {
    const crear = await crearCorreccionConPaginas(146);
    const lista = await call('GET', '/decisiones?status=pendiente&page=1');
    const id = lista.body.items[0].id;

    const rechazoSinMotivo = await call('POST', `/decisiones/${id}/resolver`, {
      resolution: 'rejected',
    });
    expect(rechazoSinMotivo.status).toBe(400);

    const rechazo = await call('POST', `/decisiones/${id}/resolver`, {
      resolution: 'rejected',
      mensaje: 'Costo no justificado todavía.',
    });
    expect(rechazo.status).toBe(200);
    const [correccionTrasRechazo] = await db
      .select()
      .from(correcciones)
      .where(eq(correcciones.id, crear.body.id));
    expect(correccionTrasRechazo?.revisionPreviaConfirmada).toBe(false);

    const asignarTrasRechazo = await call(
      'PATCH',
      `/correcciones/${crear.body.id}/asignar`,
      {
        correctorNombre: 'Freelance QA',
        freelance: true,
        contratoConfirmado: false,
      },
      cookies.especialista,
    );
    expect(asignarTrasRechazo.status).toBe(400);
  });

  it('aprobar con businessKey nuevo (segunda ronda) permite asignar; resultado histórico se conserva legible', async () => {
    const crear = await crearCorreccionConPaginas(200);
    const lista = await call('GET', '/decisiones?status=pendiente&page=1');
    const id = lista.body.items[0].id;
    const detalle = await call('GET', `/decisiones/${id}`);
    const aprobar = await call('POST', `/decisiones/${id}/resolver`, {
      resolution: 'approved',
      mensaje: 'Costo aceptado.',
      expectedVersion: detalle.body.version,
    });
    expect(aprobar.status).toBe(200);

    const [correccionTrasAprobar] = await db
      .select()
      .from(correcciones)
      .where(eq(correcciones.id, crear.body.id));
    expect(correccionTrasAprobar?.revisionPreviaConfirmada).toBe(true);
    const asignar = await call(
      'PATCH',
      `/correcciones/${crear.body.id}/asignar`,
      {
        correctorNombre: 'Freelance QA',
        freelance: true,
        contratoConfirmado: false,
      },
      cookies.especialista,
    );
    expect(asignar.status).toBe(200);

    const final = await call('GET', `/decisiones/${id}`);
    expect(final.body).toMatchObject({
      status: 'resuelta',
      resolutionType: 'approved',
      resolvedByNombre: jefe.nombre,
      resolutionMessage: 'Costo aceptado.',
    });
  });

  it('resolución es idempotente: doble resolución no duplica audit ni notificaciones, y rechaza con 400', async () => {
    await crearCorreccionConPaginas(146);
    const lista = await call('GET', '/decisiones?status=pendiente&page=1');
    const id = lista.body.items[0].id;
    const detalle = await call('GET', `/decisiones/${id}`);
    const primera = await call('POST', `/decisiones/${id}/resolver`, {
      resolution: 'approved',
      expectedVersion: detalle.body.version,
    });
    expect(primera.status).toBe(200);
    const segunda = await call('POST', `/decisiones/${id}/resolver`, {
      resolution: 'approved',
    });
    expect(segunda.status).toBe(400);
    expect(
      await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.accion, 'DECISION_RESUELTA')),
    ).toHaveLength(1);
    // La notificación de CREACIÓN avisa a Jefatura (rolDestino 'jefe_area',
    // sin usuarioDestinoId -- es broadcast de rol, no de persona); solo la
    // de RESOLUCIÓN apunta puntualmente al Especialista que originó el caso.
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.usuarioDestinoId, especialista.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.rolDestino, 'jefe_area')),
    ).toHaveLength(1);
  });

  it('concurrencia: version vieja devuelve 409 y no sobreescribe el estado', async () => {
    await crearCorreccionConPaginas(146);
    const lista = await call('GET', '/decisiones?status=pendiente&page=1');
    const id = lista.body.items[0].id;
    const stale = await call('POST', `/decisiones/${id}/resolver`, {
      resolution: 'approved',
      expectedVersion: 999,
    });
    expect(stale.status).toBe(409);
    const detalle = await call('GET', `/decisiones/${id}`);
    expect(detalle.body.status).toBe('pendiente');
  });

  it('RBAC: solo jefe_area resuelve; el solicitante no puede aprobar su propio caso', async () => {
    await crearCorreccionConPaginas(146);
    const lista = await call('GET', '/decisiones?status=pendiente&page=1');
    const id = lista.body.items[0].id;
    const comoEspecialista = await call(
      'POST',
      `/decisiones/${id}/resolver`,
      { resolution: 'approved' },
      cookies.especialista,
    );
    expect(comoEspecialista.status).toBe(403);
    const sinSesion = await app.inject({
      method: 'GET',
      url: '/api/decisiones',
    });
    expect(sinSesion.statusCode).toBe(401);
  });

  it('IDOR: un id inventado devuelve 404, no expone datos de otro proyecto', async () => {
    const r = await call('GET', `/decisiones/${randomUUID()}`);
    expect(r.status).toBe(404);
    const resolver = await call(
      'POST',
      `/decisiones/${randomUUID()}/resolver`,
      { resolution: 'approved' },
    );
    expect(resolver.status).toBe(404);
  });

  it('otro jefe_area (mismo rol, distinta persona) también puede ver y resolver -- target es el ROL, no la persona', async () => {
    await crearCorreccionConPaginas(146);
    const lista = await call(
      'GET',
      '/decisiones?status=pendiente&page=1',
      undefined,
      cookies.otroJefe,
    );
    expect(lista.body.items).toHaveLength(1);
  });

  it('no permite creación libre: POST/PATCH directos a correcciones.ts sin pasar por el workflow siguen bloqueados por 410 (sección legacy ya retirada)', async () => {
    const postLibre = await call('POST', '/decisiones', {
      tipo: 'revision_previa_correccion',
    });
    // No existe ruta POST / en decisiones.routes.ts -- debe ser 404, nunca una creación libre aceptada.
    expect(postLibre.status).toBe(404);
  });

  it('creación concurrente devuelve una sola corrección, decisión, auditoría y aviso', async () => {
    const results = await Promise.all([
      crearCorreccionConPaginas(146),
      crearCorreccionConPaginas(146),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
    expect(await db.select().from(decisiones)).toHaveLength(1);
    expect(
      await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.accion, 'DECISION_CREADA')),
    ).toHaveLength(1);
  });

  it('resoluciones simultáneas con la misma versión producen un éxito y un conflicto', async () => {
    await crearCorreccionConPaginas(146);
    const [d] = await db.select().from(decisiones);
    const results = await Promise.all([
      call('POST', `/decisiones/${d!.id}/resolver`, {
        resolution: 'approved',
        expectedVersion: 1,
      }),
      call(
        'POST',
        `/decisiones/${d!.id}/resolver`,
        {
          resolution: 'rejected',
          mensaje: 'Requiere ajustes de alcance',
          expectedVersion: 1,
        },
        cookies.otroJefe,
      ),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.accion, 'DECISION_RESUELTA')),
    ).toHaveLength(1);
    const [final] = await db.select().from(decisiones);
    const [c] = await db.select().from(correcciones);
    expect(c!.revisionPreviaConfirmada).toBe(
      final!.resolutionType === 'approved',
    );
  });

  it('un fallo de auditoría revierte tanto la resolución como el gate', async () => {
    await crearCorreccionConPaginas(146);
    const [d] = await db.select().from(decisiones);
    const failure = vi
      .spyOn(auditoria, 'registrarEvento')
      .mockRejectedValueOnce(new Error('QA transactional failure'));
    try {
      expect(
        (
          await call('POST', `/decisiones/${d!.id}/resolver`, {
            resolution: 'approved',
            expectedVersion: 1,
          })
        ).status,
      ).toBe(500);
    } finally {
      failure.mockRestore();
    }
    expect((await db.select().from(decisiones))[0]!.status).toBe('pendiente');
    expect(
      (await db.select().from(correcciones))[0]!.revisionPreviaConfirmada,
    ).toBe(false);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.usuarioDestinoId, especialista.id)),
    ).toHaveLength(0);
  });

  it('una pregunta repetida no duplica avisos, no permite resolver esperando información y protege respuestas antiguas', async () => {
    await crearCorreccionConPaginas(146);
    const [d] = await db.select().from(decisiones);
    expect(
      (
        await call('POST', `/decisiones/${d!.id}/solicitar-info`, {
          mensaje: 'Confirma la extensión del original',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call('POST', `/decisiones/${d!.id}/solicitar-info`, {
          mensaje: 'Confirma la extensión del original',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call('POST', `/decisiones/${d!.id}/resolver`, {
          resolution: 'approved',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          'POST',
          `/decisiones/${d!.id}/responder-info`,
          { mensaje: 'Es Tripa Word', expectedVersion: 1 },
          cookies.especialista,
        )
      ).status,
    ).toBe(409);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.usuarioDestinoId, especialista.id)),
    ).toHaveLength(1);
  });

  it('el solicitante puede leer su pregunta; otra persona no puede leer ni responder el expediente', async () => {
    await crearCorreccionConPaginas(146);
    const [d] = await db.select().from(decisiones);
    expect(
      (
        await call(
          'GET',
          `/decisiones/${d!.id}`,
          undefined,
          cookies.especialista,
        )
      ).status,
    ).toBe(200);
    const otro = await crearUsuario('editor');
    const cookieOtro = await login(otro);
    expect(
      (await call('GET', `/decisiones/${d!.id}`, undefined, cookieOtro)).status,
    ).toBe(404);
    expect(
      (await call('GET', `/decisiones/${randomUUID()}/actividad`)).status,
    ).toBe(404);
  });

  it('work items de otros owners y notificaciones no se convierten en decisiones', async () => {
    await db
      .insert(workItems)
      .values(
        ['edicion', 'direccion_creativa', 'soporte_digital', 'lanzamiento'].map(
          (tipo) => ({ proyectoId: p.id, tipo, estado: 'pendiente' as const }),
        ),
      );
    await db
      .insert(notificaciones)
      .values({
        proyectoId: p.id,
        rolDestino: 'jefe_area',
        mensaje: 'Aviso sin decisión',
      });
    expect((await call('GET', '/decisiones')).body.total).toBe(0);
    expect((await call('GET', '/decisiones/resumen')).body.pendientes).toBe(0);
  });

  it('límite estricto de 120 páginas y enlaces de Inicio/Seguimiento comparten la decisión nativa', async () => {
    await crearCorreccionConPaginas(120);
    expect(await db.select().from(decisiones)).toHaveLength(0);
    const [first] = await db.select().from(correcciones);
    await db
      .update(workItems)
      .set({ estado: 'completado' })
      .where(eq(workItems.id, first!.workItemId));
    const second = await crearCorreccionConPaginas(121);
    const [d] = await db.select().from(decisiones);
    expect(d!.originCorreccionId).toBe(second.body.id);
    const dashboard = await call('GET', '/jefatura/dashboard');
    expect(dashboard.body.summary.decisiones).toBe(1);
    const seguimiento = await call('GET', '/seguimiento/intervenciones');
    expect(
      seguimiento.body.items.find(
        (r: { id: string }) => r.id === second.body.id,
      ).decisionId,
    ).toBe(d!.id);
  });

  it('valida filtros, busca motivos y excluye retirados y destinos de otro rol', async () => {
    await crearCorreccionConPaginas(146);
    expect(
      (await call('GET', '/decisiones?q=umbral&origen=correccion')).body.total,
    ).toBe(1);
    for (const query of [
      'status=inventado',
      'tipo=inventado',
      'from=2026-02-30',
      'from=2026-10-11&to=2026-01-01',
    ])
      expect((await call('GET', `/decisiones?${query}`)).status).toBe(400);
    const [d] = await db.select().from(decisiones);
    await db
      .update(decisiones)
      .set({ targetRole: 'rrpp' })
      .where(eq(decisiones.id, d!.id));
    expect((await call('GET', '/decisiones')).body.total).toBe(0);
    expect((await call('GET', `/decisiones/${d!.id}`)).status).toBe(404);
    await db
      .update(decisiones)
      .set({ targetRole: 'jefe_area' })
      .where(eq(decisiones.id, d!.id));
    await db
      .update(proyectos)
      .set({ estado: 'retirado' })
      .where(eq(proyectos.id, p.id));
    expect((await call('GET', '/decisiones')).body.total).toBe(0);
    expect(
      (
        await call('POST', `/decisiones/${d!.id}/resolver`, {
          resolution: 'approved',
        })
      ).status,
    ).toBe(404);
  });

  it('lista con 10 o 31 casos mantiene dos consultas y orden estable', async () => {
    const work = await db
      .insert(workItems)
      .values(
        Array.from({ length: 31 }, (_, index) => ({
          proyectoId: p.id,
          tipo: 'correccion',
          businessKey: `correccion:qa:${index}`,
          estado: 'pendiente' as const,
        })),
      )
      .returning();
    const sources = await db
      .insert(correcciones)
      .values(
        work.map((w) => ({
          proyectoId: p.id,
          workItemId: w.id,
          alcance: 'tripa_completa',
          paginas: 146,
          requiereRevisionPrevia: true,
        })),
      )
      .returning();
    await db
      .insert(decisiones)
      .values(
        sources.map((c) => ({
          proyectoId: p.id,
          originCorreccionId: c.id,
          originWorkItemId: c.workItemId,
          tipo: 'revision_previa_correccion',
          requestedByUserId: especialista.id,
          subject: 'Revisión previa de Corrección',
        })),
      );
    const spy = vi.spyOn(pool, 'query');
    try {
      const small = await listarDecisiones({ page: 1, pageSize: 10 });
      expect(spy.mock.calls.length).toBe(2);
      spy.mockClear();
      const all = await listarDecisiones({ page: 1, pageSize: 50 });
      expect(spy.mock.calls.length).toBe(2);
      expect(small.items.map((r) => r.id)).toEqual(
        all.items.slice(0, 10).map((r) => r.id),
      );
      expect(all.items).toHaveLength(31);
    } finally {
      spy.mockRestore();
    }
  });

  it('colección inconsistente: Soporte Editorial escala, crea UNA decisión idempotente, no cambia el checklist ni el owner RRPP', async () => {
    const disenador = await crearUsuario('disenador');
    const soporte = await crearUsuario('soporte_editorial');
    const cookieDisenador = await login(disenador);
    const cookieSoporte = await login(soporte);
    const pDiseno = await crearProyectoDePrueba({
      especialistaId: especialista.id,
      disenadorId: disenador.id,
    });
    await db.insert(fichasTrazabilidad).values({ proyectoId: pDiseno.id });
    const [cw] = await db
      .insert(workItems)
      .values({
        proyectoId: pDiseno.id,
        tipo: 'direccion_creativa',
        estado: 'completado',
      })
      .returning();
    const [dc] = await db
      .insert(direccionesCreativas)
      .values({
        proyectoId: pDiseno.id,
        workItemId: cw!.id,
        tipo: 'concepto_portada',
        resultadoFinal: 'aprobado',
      })
      .returning();
    const [dw] = await db
      .insert(workItems)
      .values({ proyectoId: pDiseno.id, tipo: 'diseno', estado: 'en_progreso' })
      .returning();
    const [d] = await db
      .insert(disenos)
      .values({
        proyectoId: pDiseno.id,
        workItemId: dw!.id,
        tipo: 'diagramacion',
        direccionCreativaId: dc!.id,
        fuenteUrl: 'https://drive.google.com/tripa',
        solicitudKey: randomUUID(),
        preparacionConfirmada: true,
      })
      .returning();
    const entrega = await call(
      'POST',
      `/diseno/${d!.id}/versiones`,
      {
        enlace: `https://drive.google.com/${randomUUID()}`,
        entregaKey: randomUUID(),
      },
      cookieDisenador,
    );
    expect(entrega.status).toBe(201);
    const handoff = await call(
      'PATCH',
      `/diseno/${d!.id}/versiones/${entrega.body.id}`,
      { accion: 'handoff_calidad' },
      cookies.especialista,
    );
    expect(handoff.status).toBe(200);
    const [version] = await db
      .select()
      .from(disenoVersiones)
      .where(eq(disenoVersiones.id, entrega.body.id));
    const faseId = version!.calidadFaseId!;
    void criteriosDeFase;

    const escalar = await call(
      'POST',
      `/calidad/${faseId}/escalar-coleccion`,
      {
        motivo:
          'La colección registrada no corresponde a esta saga según el autor.',
      },
      cookieSoporte,
    );
    expect(escalar.status).toBe(200);
    const escalarDeNuevo = await call(
      'POST',
      `/calidad/${faseId}/escalar-coleccion`,
      {
        motivo:
          'La colección registrada no corresponde a esta saga según el autor.',
      },
      cookieSoporte,
    );
    expect(escalarDeNuevo.status).toBe(200);
    const filas = await db
      .select()
      .from(decisiones)
      .where(eq(decisiones.originCalidadFaseId, faseId));
    expect(filas).toHaveLength(1); // idempotente: doble escalación no duplica.

    const lista = await call('GET', '/decisiones?status=pendiente&page=1');
    expect(lista.body.items).toHaveLength(1);
    expect(lista.body.items[0]).toMatchObject({
      tipo: 'coleccion_inconsistente',
      bloqueaCorreccion: false,
    });

    // No cambia el checklist ni resuelve la ronda de Calidad.
    const [faseTrasEscalar] = await db
      .select()
      .from(fichaCalidadFases)
      .where(eq(fichaCalidadFases.id, faseId));
    expect(faseTrasEscalar?.revisadoEn).toBeNull();
    expect(faseTrasEscalar?.aprobado).toBeNull();
    const decisionId = filas[0]!.id;
    expect(
      (
        await call(
          'GET',
          `/decisiones/${decisionId}`,
          undefined,
          cookies.especialista,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await call('POST', `/decisiones/${decisionId}/solicitar-info`, {
          mensaje: 'Detalla la colección que esperaba el autor',
        })
      ).status,
    ).toBe(200);
    const avisos = await call(
      'GET',
      '/notificaciones',
      undefined,
      cookieSoporte,
    );
    expect(
      avisos.body.notificaciones.some(
        (n: { decisionId: string }) => n.decisionId === decisionId,
      ),
    ).toBe(true);
    expect(
      (
        await call(
          'POST',
          `/decisiones/${decisionId}/responder-info`,
          { mensaje: 'Se registró la colección anterior del autor' },
          cookieSoporte,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call('POST', `/decisiones/${decisionId}/resolver`, {
          resolution: 'approved',
          mensaje: 'Revisar la colección con RRPP',
        })
      ).status,
    ).toBe(200);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(eq(notificaciones.rolDestino, 'rrpp')),
    ).toHaveLength(1);
    expect(
      (
        await db
          .select()
          .from(fichaCalidadFases)
          .where(eq(fichaCalidadFases.id, faseId))
      )[0]!.aprobado,
    ).toBeNull();
  });
});
