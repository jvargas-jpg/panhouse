import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  fichasTrazabilidad,
  notificaciones,
  proyectos,
} from "../db/schema/index.js";
import { registrarEvento, type AccionAuditoria } from "./auditLog.js";
import { transicionarWorkItem } from "./workItems.js";
import { PLANIFICACION_RRPP_KEY } from "./rrppLanzamientoGate.js";
import type { Tx } from "./tx.js";

export function fechasLanzamientoCanonicas<
  T extends typeof fichasTrazabilidad.$inferSelect,
>(f: T): T {
  const primera = f.lanzamientoPromocionFechaPrimeraReunion;
  const segunda = f.lanzamientoPromocionFechaSegundaReunion;
  return {
    ...f,
    lanzamientoPromocionFechaPrimeraReunion: primera,
    lanzamientoPromocionFechaSegundaReunion: segunda,
    asesoriaFechaPrimeraReunion: primera,
    asesoriaFechaSegundaReunion: segunda,
  };
}
export function normalizarFechasLanzamiento<T extends Record<string, unknown>>(
  datos: T,
) {
  const result: Partial<typeof fichasTrazabilidad.$inferInsert> = { ...datos };
  if ("asesoriaFechaPrimeraReunion" in datos)
    result.lanzamientoPromocionFechaPrimeraReunion =
      datos.asesoriaFechaPrimeraReunion as string | null;
  if ("asesoriaFechaSegundaReunion" in datos)
    result.lanzamientoPromocionFechaSegundaReunion =
      datos.asesoriaFechaSegundaReunion as string | null;
  delete result.asesoriaFechaPrimeraReunion;
  delete result.asesoriaFechaSegundaReunion;
  return result;
}
export async function guardarFichaLanzamiento(
  id: string,
  input: Record<string, unknown>,
  actorId: string | null = null,
  validar?: (
    tx: Tx,
    p: typeof proyectos.$inferSelect,
    ficha: typeof fichasTrazabilidad.$inferSelect,
    datos: Partial<typeof fichasTrazabilidad.$inferInsert>,
  ) => Promise<void>,
) {
  const datos = normalizarFechasLanzamiento(input);
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, id))
      .for("update");
    if (!p) throw new Error(`Proyecto no encontrado: ${id}`);
    const [antes] = await tx
      .select()
      .from(fichasTrazabilidad)
      .where(eq(fichasTrazabilidad.proyectoId, id))
      .for("update");
    if (!antes)
      throw new Error(
        `Ficha de trazabilidad no encontrada para el proyecto: ${id}`,
      );
    if (validar) await validar(tx, p, antes, datos);
    const cambios = Object.keys(datos).filter(
      (k) =>
        JSON.stringify(antes[k as keyof typeof antes]) !==
        JSON.stringify(datos[k as keyof typeof datos]),
    );
    if (!cambios.length) return fechasLanzamientoCanonicas(antes);
    const [despues] = await tx
      .update(fichasTrazabilidad)
      .set(datos)
      .where(eq(fichasTrazabilidad.id, antes.id))
      .returning();
    const categorias = new Set<AccionAuditoria>();
    for (const campo of cambios) {
      if (/FechaTentativa|FechaPautadaAutor|FechaSugeridaGe/.test(campo))
        categorias.add("FECHA_LANZAMIENTO_MODIFICADA");
      else if (
        /Reunion|Realizada|ResponsableId|PuntosTratadosPrimera|AcuerdosSegunda/.test(
          campo,
        )
      )
        categorias.add("REUNION_LANZAMIENTO_REGISTRADA");
      else if (/RutaPromocion/.test(campo))
        categorias.add(
          campo === "asesoriaRutaPromocionEnviada" &&
            datos.asesoriaRutaPromocionEnviada
            ? "RUTA_PROMOCION_ENVIADA"
            : "RUTA_PROMOCION_ACTUALIZADA",
        );
      else if (/Feria/.test(campo)) categorias.add("FERIA_RRPP_ACTUALIZADA");
      else if (/NivelSatisfaccion/.test(campo))
        categorias.add("SATISFACCION_RRPP_REGISTRADA");
      else if (/VentaCruzada|FuturoAutor|Cotizacion|Distribucion/.test(campo))
        categorias.add("OPORTUNIDAD_RRPP_REGISTRADA");
      else if (campo === "asesoriaFase" && datos.asesoriaFase === "Culminado")
        categorias.add("LANZAMIENTO_RRPP_CULMINADO");
      else categorias.add("PLANIFICACION_RRPP_ACTUALIZADA");
    }
    for (const accion of categorias)
      await registrarEvento(tx, {
        actorId,
        accion,
        entityType: "proyecto",
        entityId: id,
        proyectoId: id,
        detalles: { campos: cambios },
      });
    if (datos.asesoriaCotizacionImpresion && !antes.asesoriaCotizacionImpresion)
      await tx
        .insert(notificaciones)
        .values({
          proyectoId: id,
          rolDestino: "impresion",
          mensaje: `RRPP deriva una solicitud de cotización de impresión para #${p.codigo}.`,
        });
    if (
      datos.asesoriaVentaCruzada?.includes("Distribución") &&
      !antes.asesoriaVentaCruzada?.includes("Distribución")
    )
      await tx
        .insert(notificaciones)
        .values({
          proyectoId: id,
          rolDestino: "distribucion",
          mensaje: `RRPP registra interés en distribución para #${p.codigo}.`,
        });
    await transicionarWorkItem(tx, {
      proyectoId: id,
      tipo: "lanzamiento",
      businessKey: PLANIFICACION_RRPP_KEY,
      estado:
        despues!.asesoriaFase === "Culminado" ? "completado" : "en_progreso",
    });
    return fechasLanzamientoCanonicas(despues!);
  });
}
