import { gateLanzamiento } from '../../shared/gatesOperacion.js';
import { and, eq } from "drizzle-orm";
import {
  capitulos,
  fichasTrazabilidad,
  proyectos,
  servicios,
} from "../db/schema/index.js";
import type { Tx } from "./tx.js";
export const PLANIFICACION_RRPP_KEY = "planificacion";

// Manual, recordatorio «Solicitud de reunión de lanzamiento y promoción».
// El caller bloquea el proyecto antes de modificar el hito: mismo orden de
// locks en todos los flujos. El hito habilita una acción; nunca envía una
// solicitud implícita. solicitarProcesoArea crea el handoff formal.
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
  const [c] = await tx.select({envio:capitulos.fechaEnvioAutor}).from(capitulos).where(and(eq(capitulos.proyectoId,proyectoId),eq(capitulos.numero,4)));
  const gate = gateLanzamiento(p.servicio,p.subtipo,!!c?.envio,!!(p.envioTripa||p.feedbackTripa),p.disenadorId);
  return gate.desbloqueado ? gate.motivo : null;

}
