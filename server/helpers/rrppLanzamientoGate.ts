import { and, eq } from "drizzle-orm";
import {
  capitulos,
  fichasTrazabilidad,
  notificaciones,
  proyectos,
  servicios,
  workItems,
} from "../db/schema/index.js";
import { registrarEvento } from "./auditLog.js";
import type { Tx } from "./tx.js";
export const PLANIFICACION_RRPP_KEY = "planificacion";

// Manual, recordatorio «Solicitud de reunión de lanzamiento y promoción».
// El caller bloquea el proyecto antes de modificar el hito: mismo orden de
// locks en todos los flujos, creación + notificación + auditoría atómicas.
export async function habilitarPlanificacionRrpp(
  tx: Tx,
  proyectoId: string,
  actorId: string | null = null,
) {
  const [p] = await tx
    .select({
      codigo: proyectos.codigo,
      servicio: servicios.codigo,
      disenadorId: proyectos.disenadorId,
      feedbackTripa: proyectos.fechaFeedbackTripa,
      subtipo: fichasTrazabilidad.ingresoServicioSubtipoCrudo,
      envioTripa: fichasTrazabilidad.edicionFechaEnvioAutor,
    })
    .from(proyectos)
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .leftJoin(
      fichasTrazabilidad,
      eq(fichasTrazabilidad.proyectoId, proyectos.id),
    )
    .where(eq(proyectos.id, proyectoId));
  if (!p) return;
  let hito: string | null = null;
  if (
    p.servicio === "EF" ||
    (p.servicio === "CR" && p.subtipo === "Capítulo")
  ) {
    const [c] = await tx
      .select({ envio: capitulos.fechaEnvioAutor })
      .from(capitulos)
      .where(
        and(eq(capitulos.proyectoId, proyectoId), eq(capitulos.numero, 4)),
      );
    if (c?.envio) hito = "feedback_capitulo_4";
  } else if (
    p.servicio === "CR" &&
    p.subtipo === "Tripa" &&
    (p.envioTripa || p.feedbackTripa)
  )
    hito = "feedback_tripa_completa";
  else if (p.servicio === "SE" && p.disenadorId) hito = "asignacion_diseno";
  if (!hito) return;
  const [creado] = await tx
    .insert(workItems)
    .values({
      proyectoId,
      tipo: "lanzamiento",
      businessKey: PLANIFICACION_RRPP_KEY,
    })
    .onConflictDoNothing()
    .returning({ id: workItems.id });
  if (!creado) return;
  await tx
    .insert(notificaciones)
    .values({
      proyectoId,
      rolDestino: "rrpp",
      mensaje: `Planifica lanzamiento y promoción del proyecto #${p.codigo}.`,
    });
  await registrarEvento(tx, {
    actorId,
    accion: "PLANIFICACION_RRPP_CREADA",
    entityType: "work_item",
    entityId: creado.id,
    proyectoId,
    detalles: { hito },
  });
}
