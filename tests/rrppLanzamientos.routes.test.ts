import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../server/db/client.js";
import {
  auditLogs,
  autores,
  fichasTrazabilidad,
  fichaLanzamientoReuniones,
  notificaciones,
  projectAssignments,
  proyectos,
  proyectosAutores,
  ROLES,
  rrppEventos,
  rrppPublicaciones,
  servicios,
  users,
  workItems,
} from "../server/db/schema/index.js";
import {
  actualizarCapituloAutor,
  crearCapitulo,
} from "../server/helpers/capitulos.js";
import {
  asignarDisenador,
  registrarFeedbackTripa,
} from "../server/helpers/proyectos.js";
import {
  actualizarSeccionEdicion,
  obtenerFichaCompleta,
} from "../server/helpers/trazabilidad.js";
import {
  habilitarPlanificacionRrpp,
  PLANIFICACION_RRPP_KEY,
} from "../server/helpers/rrppLanzamientoGate.js";
import { registrarYLoguear } from "./helpers/auth.js";
import { limpiarBaseDeDatos } from "./helpers/db.js";
import {
  crearAutor,
  crearFichaComercialCompleta,
  crearProyecto,
  crearProyectoDePrueba,
  crearUsuario,
} from "./helpers/fixtures.js";
import { crearAppDePrueba } from "./helpers/testApp.js";

describe("Centro operativo de lanzamientos RRPP", () => {
  let app: ReturnType<typeof crearAppDePrueba>;
  let cookie: string;
  const base = "/api/rrpp/lanzamientos";
  beforeEach(async () => {
    await limpiarBaseDeDatos();
    app = crearAppDePrueba();
    await app.ready();
    cookie = await registrarYLoguear(app, "rrpp");
  });
  afterEach(async () => {
    await app.close();
  });
  const get = (path = "") =>
    request(app.server)
      .get(base + path)
      .set("Cookie", cookie);
  const patch = (path: string, body: object) =>
    request(app.server)
      .patch(base + path)
      .set("Cookie", cookie)
      .send(body);
  const post = (path: string, body: object) =>
    request(app.server)
      .post(base + path)
      .set("Cookie", cookie)
      .send(body);
  async function preparado(
    plan = true,
    servicio?: string,
    subtipo?: "Tripa" | "Capítulo",
  ) {
    const p = await crearProyectoDePrueba();
    const f = await crearFichaComercialCompleta(p.id);
    if (servicio)
      await db
        .update(servicios)
        .set({ codigo: servicio })
        .where(eq(servicios.id, p.servicioId));
    if (subtipo)
      await db
        .update(fichasTrazabilidad)
        .set({ ingresoServicioSubtipoCrudo: subtipo })
        .where(eq(fichasTrazabilidad.id, f.id));
    if (plan)
      await db.insert(workItems).values({
        proyectoId: p.id,
        tipo: "lanzamiento",
        businessKey: PLANIFICACION_RRPP_KEY,
      });
    return { p, f };
  }
  async function comprobarGate(id: string) {
    const items = await db
      .select()
      .from(workItems)
      .where(
        and(eq(workItems.proyectoId, id), eq(workItems.tipo, "lanzamiento")),
      );
    expect(items).toHaveLength(1);
    expect(items[0]?.businessKey).toBe("planificacion");
    const audit = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.proyectoId, id),
          eq(auditLogs.accion, "PLANIFICACION_RRPP_CREADA"),
        ),
      );
    expect(audit).toHaveLength(1);
    const avisos = await db
      .select()
      .from(notificaciones)
      .where(
        and(
          eq(notificaciones.proyectoId, id),
          eq(notificaciones.rolDestino, "rrpp"),
        ),
      );
    expect(avisos).toHaveLength(1);
    expect(
      (await get()).body.proyectos.some((p: { id: string }) => p.id === id),
    ).toBe(true);
  }
  it("pagina reuniones adicionales y devuelve los totales reales del detalle", async () => {
    const { p, f } = await preparado();
    await db
      .insert(fichaLanzamientoReuniones)
      .values(
        Array.from({ length: 26 }, (_, i) => ({
          fichaId: f.id,
          clientKey: randomUUID(),
          fecha: "2026-10-01",
          puntosTratados: `Reunión ${i}`,
        })),
      );
    const primera = await get(`/planes/${p.id}`);
    expect(primera.status).toBe(200);
    expect(primera.body.reuniones).toHaveLength(25);
    expect(primera.body.reunionesPaginacion).toEqual({
      total: 26,
      pagina: 1,
      paginas: 2,
    });
    const segunda = await get(`/planes/${p.id}?reunionesPagina=2`);
    expect(segunda.body.reuniones).toHaveLength(1);
    expect(segunda.body.totalEventos).toBe(0);
    expect(segunda.body.totalPublicaciones).toBe(0);
    expect((await get(`/planes/${p.id}?reunionesPagina=0`)).status).toBe(400);
  });
  it.each([
    ["EF", undefined],
    ["CR", "Capítulo"],
  ] as const)(
    "%s se habilita al enviar capítulo 4 para feedback, una vez incluso con reintentos concurrentes",
    async (servicio, subtipo) => {
      const { p } = await preparado(false, servicio, subtipo);
      await crearCapitulo(p.id, 3);
      await crearCapitulo(p.id, 4);
      await actualizarCapituloAutor(p.id, 3, { fechaEnvioAutor: "2026-10-01" });
      expect((await get()).body.total).toBe(0);
      await Promise.all([
        actualizarCapituloAutor(p.id, 4, { fechaEnvioAutor: "2026-10-03" }),
        actualizarCapituloAutor(p.id, 4, { fechaEnvioAutor: "2026-10-03" }),
      ]);
      await comprobarGate(p.id);
    },
  );
  it("Crudo Tripa se habilita al enviar tripa completa al autor, sin esperar aprobación", async () => {
    const { p } = await preparado(false, "CR", "Tripa");
    await actualizarSeccionEdicion(p.id, {
      edicionFechaEnvioAutor: "2026-10-03",
    });
    await actualizarSeccionEdicion(p.id, {
      edicionFechaEnvioAutor: "2026-10-03",
    });
    await comprobarGate(p.id);
  });
  it("Crudo Tripa con hito histórico de feedback aplicado también reconcilia sin duplicar", async () => {
    const { p } = await preparado(false, "CR", "Tripa");
    const actor = await crearUsuario("especialista");
    await registrarFeedbackTripa(p.id, "2026-10-03", actor.id);
    await registrarFeedbackTripa(p.id, "2026-10-03", actor.id);
    await comprobarGate(p.id);
  });
  it("Sello se habilita al asignar Diseño, sin duplicar en reasignación", async () => {
    const { p } = await preparado(false, "SE");
    const actor = await crearUsuario("especialista");
    const d = await crearUsuario("disenador");
    const d2 = await crearUsuario("disenador");
    await asignarDisenador(p.id, d.id, actor.id);
    await asignarDisenador(p.id, d.id, actor.id);
    await asignarDisenador(p.id, d2.id, actor.id);
    await comprobarGate(p.id);
  });
  it.each([
    ["CR", "Tripa"],
    ["CR", undefined],
    ["SE", undefined],
    ["EET", undefined],
  ] as const)(
    "%s/%s no se habilita por un capítulo 4 de un servicio distinto",
    async (servicio, subtipo) => {
      const { p } = await preparado(false, servicio, subtipo);
      await crearCapitulo(p.id, 4);
      await actualizarCapituloAutor(p.id, 4, { fechaEnvioAutor: "2026-10-03" });
      expect((await get()).body.total).toBe(0);
    },
  );
  it("no crea planificación por contenido de capítulo ni respuesta sin fecha de envío", async () => {
    const { p } = await preparado(false, "EF");
    await crearCapitulo(p.id, 4);
    await actualizarCapituloAutor(p.id, 4, {
      fechaRespuestaReal: "2026-10-03",
    });
    expect((await get()).body.total).toBe(0);
  });
  it("retrocompatibilidad del gate mantiene un trabajo que ya avanzó", async () => {
    const { p } = await preparado(false, "SE");
    const d = await crearUsuario("disenador");
    await db
      .update(proyectos)
      .set({ disenadorId: d.id })
      .where(eq(proyectos.id, p.id));
    await db.transaction(async (tx) => {
      await tx
        .select()
        .from(proyectos)
        .where(eq(proyectos.id, p.id))
        .for("update");
      await habilitarPlanificacionRrpp(tx, p.id);
    });
    await db
      .update(workItems)
      .set({ estado: "en_progreso" })
      .where(eq(workItems.proyectoId, p.id));
    await db.transaction(async (tx) => {
      await tx
        .select()
        .from(proyectos)
        .where(eq(proyectos.id, p.id))
        .for("update");
      await habilitarPlanificacionRrpp(tx, p.id);
    });
    expect(
      (
        await db.select().from(workItems).where(eq(workItems.proyectoId, p.id))
      )[0]?.estado,
    ).toBe("en_progreso");
    await comprobarGate(p.id);
  });
  it("vacío real, proyectos sin gate fuera de lista y detalle 404", async () => {
    expect((await get()).body).toMatchObject({
      proyectos: [],
      total: 0,
      pagina: 1,
      paginas: 1,
    });
    const { p } = await preparado(false);
    expect((await get()).body.total).toBe(0);
    expect((await get(`/planes/${p.id}`)).status).toBe(404);
  });
  it("lista prioriza reunión vencida, próxima y pendiente sin fecha", async () => {
    const a = await preparado();
    const b = await preparado();
    const c = await preparado();
    await db
      .update(fichasTrazabilidad)
      .set({
        lanzamientoPromocionFechaPrimeraReunion: "2020-01-01",
        lanzamientoPromocionPrimeraRealizada: false,
      })
      .where(eq(fichasTrazabilidad.proyectoId, b.p.id));
    await db
      .update(fichasTrazabilidad)
      .set({ asesoriaFechaPautadaAutor: "2099-01-01" })
      .where(eq(fichasTrazabilidad.proyectoId, c.p.id));
    const res = await get();
    expect(res.body.proyectos.map((p: { id: string }) => p.id)).toEqual([
      b.p.id,
      c.p.id,
      a.p.id,
    ]);
    expect(res.body.proyectos[0].proximaAccion).toBe("1ª reunión");
  });
  it("filtra fase, feria, responsable y busca coautor/código/título", async () => {
    const { p } = await preparado();
    await preparado();
    const autor = await crearAutor({ nombre: "Coautor Distintivo" });
    const rrpp = await crearUsuario("rrpp");
    await db
      .insert(proyectosAutores)
      .values({ proyectoId: p.id, autorId: autor.id });
    await db
      .update(proyectos)
      .set({ tituloDefinitivo: "Libro Buscable" })
      .where(eq(proyectos.id, p.id));
    await db
      .update(fichasTrazabilidad)
      .set({
        asesoriaFase: "Esperando fecha",
        asesoriaFeriaProyectada: "Bogotá",
      })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    await patch(`/planes/${p.id}/responsable`, { responsableId: rrpp.id });
    for (const query of [
      "?q=Coautor%20Distintivo",
      `?q=${p.codigo}`,
      "?q=Libro%20Buscable",
      `?fase=Esperando%20fecha&feria=Bogot%C3%A1&responsable=${rrpp.id}`,
    ])
      expect(
        (await get(query)).body.proyectos.map((r: { id: string }) => r.id),
      ).toEqual([p.id]);
  });
  it("paginación SQL estable de planificación y límites validados", async () => {
    const { p } = await preparado();
    for (let i = 0; i < 26; i++) {
      const next = await crearProyecto({
        autorId: p.autorId,
        servicioId: p.servicioId,
        unidadId: p.unidadId,
        presupuestoId: p.presupuestoId,
        fechaProgramadaInicio: "2026-10-01",
      });
      await crearFichaComercialCompleta(next.id);
      await db.insert(workItems).values({
        proyectoId: next.id,
        tipo: "lanzamiento",
        businessKey: "planificacion",
      });
    }
    const first = await get();
    const second = await get("?pagina=2");
    expect(first.body.total).toBe(27);
    expect(first.body.proyectos).toHaveLength(25);
    expect(second.body.proyectos).toHaveLength(2);
    expect((await get("?pagina=0")).status).toBe(400);
  });
  it("guarda fecha, feria, satisfacción, fase y refleja la misma Ficha", async () => {
    const { p } = await preparado();
    const datos = {
      asesoriaFase: "Esperando fecha",
      asesoriaFechaSugeridaGe: "2026-11-05",
      asesoriaFechaPautadaAutor: "2026-11-10",
      lanzamientoPromocionFechaTentativa: "2026-11-09",
      asesoriaFeriaProyectada: "Guadalajara",
      asesoriaParticipacionFeria: true,
      asesoriaFeriaAParticipar: "Guadalajara",
      asesoriaInfoFeriaEnviada: true,
      asesoriaNivelSatisfaccion: "Excelente",
    };
    const res = await patch(`/planes/${p.id}`, datos);
    expect(res.status).toBe(200);
    expect(res.body.ficha).toMatchObject(datos);
    const ficha = await obtenerFichaCompleta(p.id);
    expect(ficha).toMatchObject(datos);
  });
  it("programa/revisa primera reunión canónica sin duplicar otra fila", async () => {
    const { p } = await preparado();
    const rrpp = await crearUsuario("rrpp");
    const datos = {
      lanzamientoPromocionFechaPrimeraReunion: "2026-10-01",
      lanzamientoPromocionPrimeraResponsableId: rrpp.id,
      lanzamientoPromocionPrimeraRealizada: true,
      lanzamientoPromocionPuntosTratadosPrimera: "Objetivos reales",
    };
    expect((await patch(`/planes/${p.id}`, datos)).status).toBe(200);
    expect(
      (await obtenerFichaCompleta(p.id))?.asesoriaFechaPrimeraReunion,
    ).toBe("2026-10-01");
    expect(await db.select().from(fichaLanzamientoReuniones)).toHaveLength(0);
  });
  it("una fecha nueva queda programada; no se infiere realizada al pasar el día", async () => {
    const { p } = await preparado();
    const res = await patch(`/planes/${p.id}`, {
      lanzamientoPromocionFechaPrimeraReunion: "2020-01-01",
    });
    expect(res.body.ficha.lanzamientoPromocionPrimeraRealizada).toBe(false);
  });
  it("rechaza reunión realizada sin fecha, futura o con fecha borrada", async () => {
    const { p } = await preparado();
    expect(
      (
        await patch(`/planes/${p.id}`, {
          lanzamientoPromocionPrimeraRealizada: true,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await patch(`/planes/${p.id}`, {
          lanzamientoPromocionPrimeraRealizada: true,
          lanzamientoPromocionFechaPrimeraReunion: "2099-01-01",
        })
      ).status,
    ).toBe(400);
    await patch(`/planes/${p.id}`, {
      lanzamientoPromocionFechaPrimeraReunion: "2026-01-01",
      lanzamientoPromocionPrimeraRealizada: true,
    });
    expect(
      (
        await patch(`/planes/${p.id}`, {
          lanzamientoPromocionFechaPrimeraReunion: null,
        })
      ).status,
    ).toBe(400);
  });
  it("permite borrar fecha canónica sin recuperar la columna histórica de Matriz", async () => {
    const { p } = await preparado();
    await db
      .update(fichasTrazabilidad)
      .set({
        asesoriaFechaPrimeraReunion: "2025-01-01",
        lanzamientoPromocionFechaPrimeraReunion: "2025-01-01",
      })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    await patch(`/planes/${p.id}`, {
      lanzamientoPromocionFechaPrimeraReunion: null,
    });
    expect(
      (await obtenerFichaCompleta(p.id))?.asesoriaFechaPrimeraReunion,
    ).toBeNull();
  });
  it("rutas existentes de Matriz y Ficha escriben y leen la misma reunión", async () => {
    const { p } = await preparado();
    const res = await request(app.server)
      .patch(`/api/fichas-trazabilidad/${p.id}/matriz-asesorias`)
      .set("Cookie", cookie)
      .send({ asesoriaFechaSegundaReunion: "2026-01-15" });
    expect(res.status).toBe(200);
    expect(
      (await get(`/planes/${p.id}`)).body.ficha
        .lanzamientoPromocionFechaSegundaReunion,
    ).toBe("2026-01-15");
  });
  it("reuniones adicionales son repetibles, idempotentes y editables sin cruzar proyectos", async () => {
    const { p } = await preparado();
    const datos = {
      clientKey: randomUUID(),
      fecha: "2026-10-02",
      realizada: true,
      puntosTratados: "Asesoría",
      acuerdos: "Confirmar ruta",
    };
    const a = await post(`/planes/${p.id}/reuniones`, datos);
    const retry = await post(`/planes/${p.id}/reuniones`, datos);
    expect(a.status).toBe(201);
    expect(retry.body.id).toBe(a.body.id);
    await post(`/planes/${p.id}/reuniones`, {
      ...datos,
      clientKey: randomUUID(),
    });
    expect((await get(`/planes/${p.id}`)).body.reuniones).toHaveLength(2);
    expect(
      (
        await patch(`/planes/${p.id}/reuniones/${a.body.id}`, {
          ...datos,
          acuerdos: "Confirmado",
        })
      ).status,
    ).toBe(200);
    const other = await preparado();
    expect(
      (await patch(`/planes/${other.p.id}/reuniones/${a.body.id}`, datos))
        .status,
    ).toBe(404);
  });
  it("asignación RRPP valida cuenta/rol y conserva historial sin duplicar retry", async () => {
    const { p } = await preparado();
    const a = await crearUsuario("rrpp");
    const b = await crearUsuario("rrpp");
    const editor = await crearUsuario("editor");
    expect(
      (await patch(`/planes/${p.id}/responsable`, { responsableId: editor.id }))
        .status,
    ).toBe(400);
    await patch(`/planes/${p.id}/responsable`, { responsableId: a.id });
    await patch(`/planes/${p.id}/responsable`, { responsableId: a.id });
    await patch(`/planes/${p.id}/responsable`, { responsableId: b.id });
    const history = await db
      .select()
      .from(projectAssignments)
      .where(eq(projectAssignments.proyectoId, p.id));
    expect(history).toHaveLength(2);
    expect(history.filter((a) => a.finalizadoEn === null)[0]?.usuarioId).toBe(
      b.id,
    );
    expect((await get(`/planes/${p.id}`)).body.responsableId).toBe(b.id);
  });
  it("rutas se guardan, quedan listas por enlace y enviadas sin duplicar audit", async () => {
    const { p } = await preparado();
    expect(
      (await patch(`/planes/${p.id}`, { asesoriaRutaPromocionEnviada: true }))
        .status,
    ).toBe(400);
    const datos = {
      asesoriaLinkRutaPromocion: "https://docs.google.com/document/d/route",
      asesoriaRutaPromocionEnviada: true,
    };
    await patch(`/planes/${p.id}`, datos);
    await patch(`/planes/${p.id}`, datos);
    expect(
      (await obtenerFichaCompleta(p.id))?.asesoriaRutaPromocionEnviada,
    ).toBe(true);
    expect(
      await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.proyectoId, p.id),
            eq(auditLogs.accion, "RUTA_PROMOCION_ENVIADA"),
          ),
        ),
    ).toHaveLength(1);
    expect(
      (await patch(`/planes/${p.id}`, { asesoriaLinkRutaPromocion: null }))
        .status,
    ).toBe(400);
  });
  it("deriva impresión/distribución una vez sin operar campos especializados", async () => {
    const { p } = await preparado();
    const datos = {
      asesoriaCotizacionImpresion: true,
      asesoriaFechaCotizacionSolicitada: "2026-10-01",
      asesoriaVentaCruzada: ["Distribución", "Impresión"],
      asesoriaNotaDistribucion: "Interés del autor",
    };
    await patch(`/planes/${p.id}`, datos);
    await patch(`/planes/${p.id}`, datos);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(
          and(
            eq(notificaciones.proyectoId, p.id),
            eq(notificaciones.rolDestino, "impresion"),
          ),
        ),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(notificaciones)
        .where(
          and(
            eq(notificaciones.proyectoId, p.id),
            eq(notificaciones.rolDestino, "distribucion"),
          ),
        ),
    ).toHaveLength(1);
    expect(
      (await obtenerFichaCompleta(p.id))?.impresionEstadoCotizacion,
    ).toBeNull();
  });
  it("culminar la fase completa el trabajo sin cerrar Producción ni el proyecto", async () => {
    const { p } = await preparado();
    await patch(`/planes/${p.id}`, { asesoriaFase: "Culminado" });
    const [item] = await db
      .select()
      .from(workItems)
      .where(eq(workItems.proyectoId, p.id));
    expect(item?.estado).toBe("completado");
    expect(
      (await db.select().from(proyectos).where(eq(proyectos.id, p.id)))[0]
        ?.estado,
    ).toBe("en_proceso");
  });
  it("proyecto cerrado/cancelado se consulta y no acepta cambios", async () => {
    const { p } = await preparado();
    await db
      .update(proyectos)
      .set({ estado: "culminado" })
      .where(eq(proyectos.id, p.id));
    expect((await get(`/planes/${p.id}`)).body.editable).toBe(false);
    expect(
      (await patch(`/planes/${p.id}`, { asesoriaNotas: "Cambio" })).status,
    ).toBe(409);
    await db
      .update(proyectos)
      .set({ estado: "en_proceso" })
      .where(eq(proyectos.id, p.id));
    await db
      .update(workItems)
      .set({ estado: "cancelado" })
      .where(eq(workItems.proyectoId, p.id));
    expect(
      (await patch(`/planes/${p.id}`, { asesoriaNotas: "Cambio" })).status,
    ).toBe(409);
  });
  it("eventos 1:N, retries concurrentes no duplican, estados y fechas reales", async () => {
    const { p } = await preparado();
    const body = {
      proyectoId: p.id,
      clientKey: randomUUID(),
      tipo: "Revelación de portada",
      fecha: "2026-10-22",
      hora: "16:30",
      estado: "No iniciada",
      fase: "Antes del evento",
      lugar: "Sala editorial",
    };
    const [a, b] = await Promise.all([
      post("/eventos", body),
      post("/eventos", body),
    ]);
    expect(a.status).toBe(201);
    expect(b.body.id).toBe(a.body.id);
    await post("/eventos", { ...body, clientKey: randomUUID(), tipo: "Feria" });
    const agenda = await get("/agenda?desde=2026-10-01&hasta=2026-10-31");
    expect(agenda.status).toBe(200);
    expect(agenda.body.eventos).toHaveLength(2);
    expect(
      (await get("/agenda?desde=2026-10-01&hasta=2026-10-31&tipo=Feria")).body
        .eventos,
    ).toHaveLength(1);
    const res = await patch(`/eventos/${a.body.id}`, {
      ...body,
      estado: "En curso",
      notasRrss: "Coordinar piezas",
    });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("En curso");
    expect(
      await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.proyectoId, p.id),
            eq(auditLogs.accion, "EVENTO_RRPP_PROGRAMADO"),
          ),
        ),
    ).toHaveLength(2);
  });
  it("eventos admiten tipos reales adicionales sin catálogo incompleto ni nombre de autor copiado", async () => {
    const { p } = await preparado();
    await post("/eventos", {
      proyectoId: p.id,
      clientKey: randomUUID(),
      tipo: "Encuentro de lectura local",
      fecha: "2026-10-22",
    });
    const c = await get("/catalogos");
    expect(c.body.tiposEvento).toContain("Colegio Champagnat");
    expect(c.body.tiposEvento).toContain("Lanzamiento en Amazon");
    expect(c.body.tiposEvento).toContain("Encuentro de lectura local");
    await db
      .update(autores)
      .set({ nombre: "Autor actualizado" })
      .where(eq(autores.id, p.autorId));
    expect(
      (await get("/agenda?desde=2026-10-01&hasta=2026-10-31")).body.eventos[0]
        .nombre,
    ).toBe("Autor actualizado");
  });
  it("representante usa una cuenta real del equipo, sin otorgarle permisos RRPP", async () => {
    const { p } = await preparado();
    const miembro = await crearUsuario("distribucion");
    const autor = await crearUsuario("autor");
    const body = {
      proyectoId: p.id,
      clientKey: randomUUID(),
      tipo: "Feria",
      fecha: "2026-10-22",
      representanteId: miembro.id,
    };
    expect((await post("/eventos", body)).status).toBe(201);
    expect(
      (
        await post("/eventos", {
          ...body,
          clientKey: randomUUID(),
          representanteId: autor.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (await get("/catalogos")).body.representantes.some(
        (p: { id: string }) => p.id === miembro.id,
      ),
    ).toBe(true);
  });
  it("agenda limita período, valida calendario y no filtra eventos ajenos al proyecto seleccionado", async () => {
    const { p } = await preparado();
    const b = await preparado();
    await post("/eventos", {
      proyectoId: p.id,
      clientKey: randomUUID(),
      tipo: "Lanzamiento",
      fecha: "2026-10-22",
    });
    expect(
      (await get("/agenda?desde=2026-01-01&hasta=2026-12-31")).status,
    ).toBe(400);
    expect(
      (await get("/agenda?desde=2026-02-30&hasta=2026-03-01")).status,
    ).toBe(400);
    expect(
      (
        await get(
          `/agenda?desde=2026-10-01&hasta=2026-10-31&proyecto=${b.p.id}`,
        )
      ).body.eventos,
    ).toHaveLength(0);
  });
  it("no modifica evento de otro proyecto ni campos de Creativa", async () => {
    const { p } = await preparado();
    const b = await preparado();
    const body = {
      proyectoId: p.id,
      clientKey: randomUUID(),
      tipo: "Lanzamiento",
      fecha: "2026-10-22",
    };
    const e = await post("/eventos", body);
    expect(
      (await patch(`/eventos/${e.body.id}`, { ...body, proyectoId: b.p.id }))
        .status,
    ).toBe(404);
    expect(
      (await post("/eventos", { ...body, disenoBriefCreativo: "No" })).status,
    ).toBe(400);
  });
  it("publicaciones son repetibles, idempotentes y sus estados se filtran de la Matriz", async () => {
    const { p } = await preparado();
    const body = {
      proyectoId: p.id,
      clientKey: randomUUID(),
      tipo: "Futuro Autor",
      estado: "Nuevo",
      detalles: "Documento de la pieza",
    };
    const a = await post("/publicaciones", body);
    expect(a.status).toBe(201);
    expect((await post("/publicaciones", body)).body.id).toBe(a.body.id);
    await post("/publicaciones", {
      ...body,
      clientKey: randomUUID(),
      tipo: "Novedades",
    });
    await patch(`/publicaciones/${a.body.id}`, {
      ...body,
      estado: "En revisión",
      estadoPieza: "Pieza para aprobación",
    });
    expect(
      (await get("/publicaciones?estado=En%20revisi%C3%B3n")).body.total,
    ).toBe(1);
    await patch(`/publicaciones/${a.body.id}`, {
      ...body,
      estado: "Publicado",
    });
    await patch(`/publicaciones/${a.body.id}`, {
      ...body,
      estado: "Publicado",
    });
    expect(
      await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.proyectoId, p.id),
            eq(auditLogs.accion, "PUBLICACION_RRPP_REALIZADA"),
          ),
        ),
    ).toHaveLength(1);
  });
  it("fecha de publicación consulta Ficha y refleja cambios comerciales posteriores", async () => {
    const { p } = await preparado();
    await post("/publicaciones", {
      proyectoId: p.id,
      clientKey: randomUUID(),
      tipo: "Novedades",
    });
    await patch(`/planes/${p.id}`, { asesoriaFechaPautadaAutor: "2026-11-10" });
    expect(
      (await get("/publicaciones")).body.publicaciones[0].fechaLanzamiento,
    ).toBe("2026-11-10");
    await patch(`/planes/${p.id}`, { asesoriaFechaPautadaAutor: "2026-12-10" });
    expect(
      (await get("/publicaciones")).body.publicaciones[0].fechaLanzamiento,
    ).toBe("2026-12-10");
  });
  it("rechaza tipos/estados inventados y estados de pieza de otro tipo", async () => {
    const { p } = await preparado();
    const body = {
      proyectoId: p.id,
      clientKey: randomUUID(),
      tipo: "Novedades",
    };
    expect(
      (await post("/publicaciones", { ...body, tipo: "Inventado" })).status,
    ).toBe(400);
    expect(
      (await post("/publicaciones", { ...body, estado: "Listo" })).status,
    ).toBe(400);
    expect(
      (
        await post("/publicaciones", {
          ...body,
          estadoPieza: "Pieza para aprobación",
        })
      ).status,
    ).toBe(400);
  });
  it("publicaciones tienen paginación SQL, búsqueda y filtro por proyecto", async () => {
    const { p } = await preparado();
    await db.insert(rrppPublicaciones).values(
      Array.from({ length: 27 }, () => ({
        proyectoId: p.id,
        clientKey: randomUUID(),
        tipo: "Novedades",
      })),
    );
    expect((await get("/publicaciones")).body.publicaciones).toHaveLength(25);
    expect(
      (await get("/publicaciones?pagina=2")).body.publicaciones,
    ).toHaveLength(2);
    expect((await get(`/publicaciones?q=${p.codigo}`)).body.total).toBe(27);
  });
  it("historial público paginado oculta JSON, ids técnicos y acciones fuera de RRPP", async () => {
    const { p } = await preparado();
    await db.insert(auditLogs).values(
      Array.from({ length: 35 }, () => ({
        proyectoId: p.id,
        accion: "EVENTO_RRPP_PROGRAMADO",
        entityType: "evento_rrpp",
        entityId: randomUUID(),
        detalles: { secreto: "NO_EXPONER" },
      })),
    );
    await db.insert(auditLogs).values({
      proyectoId: p.id,
      accion: "ACCION_DESCONOCIDA",
      entityType: "proyecto",
      entityId: p.id,
      detalles: { secreto: "NO_EXPONER" },
    });
    const res = await get("/historial");
    expect(res.body.total).toBe(35);
    expect(res.body.eventos).toHaveLength(30);
    expect(JSON.stringify(res.body)).not.toContain("NO_EXPONER");
    expect(res.body.eventos[0].entityId).toBeUndefined();
    expect(res.body.eventos[0].titulo).toBe("Evento RRPP programado");
    expect((await get("/historial?pagina=2")).body.eventos).toHaveLength(5);
  });
  it.each(["asesoriaFechaPautadaAutor", "lanzamientoPromocionFechaTentativa"])(
    "valida %s con fecha real",
    async (campo) => {
      const { p } = await preparado();
      expect(
        (await patch(`/planes/${p.id}`, { [campo]: "2026-02-30" })).status,
      ).toBe(400);
    },
  );
  it("UUID/consultas/payload vacío o especializado son rechazados", async () => {
    expect((await get("/planes/mal-id")).status).toBe(400);
    expect((await get("?fase=Inventada")).status).toBe(400);
    expect((await get("?desconocido=1")).status).toBe(400);
    const { p } = await preparado();
    expect((await patch(`/planes/${p.id}`, {})).status).toBe(400);
    expect(
      (await patch(`/planes/${p.id}`, { impresionResponsable: "Nombre" }))
        .status,
    ).toBe(400);
  });
  it("401 sin sesión en todas las lecturas", async () => {
    for (const ruta of [
      "",
      "/catalogos",
      "/historial",
      "/agenda?desde=2026-10-01&hasta=2026-10-31",
      "/publicaciones",
    ])
      expect((await request(app.server).get(base + ruta)).status).toBe(401);
  });
  it.each(ROLES.filter((r) => r !== "rrpp"))(
    "RBAC %s no puede operar ni consultar este workspace",
    async (rol) => {
      const other = await registrarYLoguear(app, rol);
      expect(
        (await request(app.server).get(base).set("Cookie", other)).status,
      ).toBe(403);
      expect(
        (
          await request(app.server)
            .post(base + "/eventos")
            .set("Cookie", other)
            .send({})
        ).status,
      ).toBe(403);
    },
  );
  it("RRPP no opera Impresión, Distribución, Diseño ni Líder Creativo", async () => {
    const { p } = await preparado();
    for (const path of ["impresion", "distribucion-control"])
      expect(
        (
          await request(app.server)
            .patch(`/api/fichas-trazabilidad/${p.id}/${path}`)
            .set("Cookie", cookie)
            .send({})
        ).status,
      ).toBe(403);
    expect(
      (
        await request(app.server)
          .post(`/api/fichas-trazabilidad/${p.id}/distribucion/paises`)
          .set("Cookie", cookie)
          .send({ pais: "Venezuela" })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/matriz-asesorias`)
          .set("Cookie", cookie)
          .send({ asesoriaCotizacionAceptada: true })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/diseno-brief`)
          .set("Cookie", cookie)
          .send({ disenoBriefCreativo: "No" })
      ).status,
    ).not.toBe(200);
  });
  it("los roles reales Impresión/Distribución mantienen su sección, RRPP consulta su estado", async () => {
    const { p } = await preparado();
    const print = await registrarYLoguear(app, "impresion");
    const dist = await registrarYLoguear(app, "distribucion");
    expect(
      (
        await request(app.server)
          .patch(`/api/fichas-trazabilidad/${p.id}/impresion`)
          .set("Cookie", print)
          .send({ impresionNotas: "Cotización preparada" })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app.server)
          .post(`/api/fichas-trazabilidad/${p.id}/distribucion/paises`)
          .set("Cookie", dist)
          .send({ pais: "Venezuela" })
      ).status,
    ).toBe(201);
    expect((await obtenerFichaCompleta(p.id))?.impresionNotas).toBe(
      "Cotización preparada",
    );
  });
});
