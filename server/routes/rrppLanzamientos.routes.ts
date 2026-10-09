import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ASESORIA_FASES,
  ASESORIA_FERIAS_PROYECTADAS,
} from "../db/schema/index.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { parseOrReply } from "../helpers/validate.js";
import {
  actualizarPlanificacion,
  agendaRrpp,
  asignarResponsableLanzamiento,
  catalogosLanzamientos,
  detallePlanificacion,
  eventoRrppSchema,
  fechaRrpp,
  guardarEventoRrpp,
  guardarPublicacionRrpp,
  historialLanzamientos,
  listarPlanificacion,
  OperacionLanzamientoError,
  planLanzamientoSchema,
  publicacionRrppSchema,
  publicacionesRrpp,
  registrarReunionLanzamiento,
  reunionLanzamientoSchema,
} from "../helpers/rrppLanzamientos.js";
import { ESTADOS_PUBLICACION_RRPP } from "../helpers/rrppLanzamientoCatalogos.js";

export async function rrppLanzamientosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", requireRole("rrpp"));
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof OperacionLanzamientoError)
      return reply.code(error.status).send({ error: error.message });
    app.log.error(error);
    return reply.code(500).send({
      error: "No se pudo completar la operación. Intenta nuevamente.",
    });
  });
  const idSchema = z.object({ id: z.string().uuid() });
  const pagina = z.coerce.number().int().min(1).max(100000).default(1);
  app.get("/catalogos", async () => catalogosLanzamientos());
  app.get("", async (request, reply) => {
    const f = parseOrReply(
      z
        .object({
          q: z.string().trim().max(150).optional(),
          fase: z.enum(ASESORIA_FASES).optional(),
          feria: z.enum(ASESORIA_FERIAS_PROYECTADAS).optional(),
          responsable: z.string().uuid().optional(),
          pagina,
        })
        .strict(),
      request.query,
      reply,
    );
    return f
      ? reply.send(await listarPlanificacion({ ...f, pagina: f.pagina ?? 1 }))
      : undefined;
  });
  app.get("/historial", async (request, reply) => {
    const f = parseOrReply(
      z.object({ proyecto: z.string().uuid().optional(), pagina }).strict(),
      request.query,
      reply,
    );
    return f
      ? reply.send(await historialLanzamientos({ ...f, pagina: f.pagina ?? 1 }))
      : undefined;
  });
  app.get("/agenda", async (request, reply) => {
    const f = parseOrReply(
      z
        .object({
          desde: fechaRrpp,
          hasta: fechaRrpp,
          tipo: z.string().trim().max(120).optional(),
          proyecto: z.string().uuid().optional(),
        })
        .strict(),
      request.query,
      reply,
    );
    return f ? reply.send(await agendaRrpp(f)) : undefined;
  });
  app.get("/publicaciones", async (request, reply) => {
    const f = parseOrReply(
      z
        .object({
          estado: z.enum(ESTADOS_PUBLICACION_RRPP).optional(),
          proyecto: z.string().uuid().optional(),
          q: z.string().trim().max(150).optional(),
          pagina,
        })
        .strict(),
      request.query,
      reply,
    );
    return f
      ? reply.send(await publicacionesRrpp({ ...f, pagina: f.pagina ?? 1 }))
      : undefined;
  });
  app.get("/planes/:id", async (request, reply) => {
    const p = parseOrReply(idSchema, request.params, reply);
    const q = parseOrReply(
      z.object({ reunionesPagina: pagina }).strict(),
      request.query,
      reply,
    );
    if (!p || !q) return;
    const detalle = await detallePlanificacion(p.id, q.reunionesPagina ?? 1);
    return detalle
      ? reply.send(detalle)
      : reply.code(404).send({ error: "Planificación no encontrada" });
  });
  app.patch("/planes/:id", async (request, reply) => {
    const p = parseOrReply(idSchema, request.params, reply);
    const datos = parseOrReply(planLanzamientoSchema, request.body, reply);
    if (!p || !datos || !request.user) return;
    await actualizarPlanificacion(p.id, datos, request.user.id);
    return reply.send(await detallePlanificacion(p.id));
  });
  app.patch("/planes/:id/responsable", async (request, reply) => {
    const p = parseOrReply(idSchema, request.params, reply);
    const datos = parseOrReply(
      z.object({ responsableId: z.string().uuid() }).strict(),
      request.body,
      reply,
    );
    if (!p || !datos || !request.user) return;
    return reply.send(
      await asignarResponsableLanzamiento(
        p.id,
        datos.responsableId,
        request.user.id,
      ),
    );
  });
  app.post("/planes/:id/reuniones", async (request, reply) => {
    const p = parseOrReply(idSchema, request.params, reply);
    const datos = parseOrReply(reunionLanzamientoSchema, request.body, reply);
    if (!p || !datos || !request.user) return;
    return reply
      .code(201)
      .send(
        await registrarReunionLanzamiento(
          p.id,
          { ...datos, realizada: datos.realizada ?? false },
          request.user.id,
        ),
      );
  });
  app.patch("/planes/:id/reuniones/:reunion", async (request, reply) => {
    const p = parseOrReply(
      idSchema.extend({ reunion: z.string().uuid() }),
      request.params,
      reply,
    );
    const datos = parseOrReply(reunionLanzamientoSchema, request.body, reply);
    if (!p || !datos || !request.user) return;
    return reply.send(
      await registrarReunionLanzamiento(
        p.id,
        { ...datos, realizada: datos.realizada ?? false },
        request.user.id,
        p.reunion,
      ),
    );
  });
  for (const tipo of ["eventos", "publicaciones"] as const) {
    app.post(`/${tipo}`, async (request, reply) => {
      if (!request.user) return;
      if (tipo === "eventos") {
        const datos = parseOrReply(eventoRrppSchema, request.body, reply);
        if (!datos) return;
        return reply
          .code(201)
          .send(
            await guardarEventoRrpp(
              { ...datos, estado: datos.estado ?? "No iniciada" },
              request.user.id,
            ),
          );
      }
      const datos = parseOrReply(publicacionRrppSchema, request.body, reply);
      if (!datos) return;
      return reply
        .code(201)
        .send(
          await guardarPublicacionRrpp(
            { ...datos, estado: datos.estado ?? "Nuevo" },
            request.user.id,
          ),
        );
    });
    app.patch(`/${tipo}/:id`, async (request, reply) => {
      const p = parseOrReply(idSchema, request.params, reply);
      if (!p || !request.user) return;
      if (tipo === "eventos") {
        const datos = parseOrReply(eventoRrppSchema, request.body, reply);
        if (!datos) return;
        return reply.send(
          await guardarEventoRrpp(
            { ...datos, estado: datos.estado ?? "No iniciada" },
            request.user.id,
            p.id,
          ),
        );
      }
      const datos = parseOrReply(publicacionRrppSchema, request.body, reply);
      if (!datos) return;
      return reply.send(
        await guardarPublicacionRrpp(
          { ...datos, estado: datos.estado ?? "Nuevo" },
          request.user.id,
          p.id,
        ),
      );
    });
  }
}
