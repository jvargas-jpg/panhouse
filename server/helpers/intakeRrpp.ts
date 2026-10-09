import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  fichasTrazabilidad,
  proyectos,
  servicios,
  workItems,
  type Rol,
} from '../db/schema/index.js';
import { registrarEvento } from './auditLog.js';
import { crearWorkItemSiNoExiste, transicionarWorkItem } from './workItems.js';
import type { Tx } from './tx.js';
import { ESTADOS_ACTIVOS } from './carga.js';
import { evaluarPreparacionRrpp } from './preparacionRrpp.js';

export type ActorFicha = { id: string; rol: Rol };
type Ficha = typeof fichasTrazabilidad.$inferSelect;

// Señales documentales ya existentes; no introduce un catálogo de required fields.
export function diagnosticoGenerado(
  ficha: Pick<Ficha, 'matrizDiagnosticoGenerado' | 'matrizIngresoGenerado'>,
) {
  return ficha.matrizDiagnosticoGenerado && ficha.matrizIngresoGenerado;
}

export function diagnosticoListo(
  ficha: Pick<
    Ficha,
    | 'matrizDiagnosticoGenerado'
    | 'matrizIngresoGenerado'
    | 'ingresoServicioSubtipoCrudo'
  >,
  servicio: string,
) {
  return evaluarPreparacionRrpp(ficha, servicio).listoParaJefatura;
}

// Evidencia guardada en los campos propios del ingreso, también para fichas legacy.
// No son campos obligatorios ni una segunda fuente de lifecycle.
export function tieneTrabajoRrpp(ficha: Ficha) {
  return [
    ficha.ingresoServicioSubtipoCrudo,
    ficha.fechaDeseadaCulminacion,
    ficha.temaGeneral,
    ficha.posibleTituloLibro,
    ficha.coleccionPanhouse,
    ficha.tonoEstilo,
    ficha.publicoSexo,
    ficha.publicoEdad,
    ficha.publicoPerfil,
    ficha.propositoSocial,
    ficha.objetivoComercial,
    ficha.matrizCiudadResidencia,
    ficha.matrizEstadoReunion,
    ficha.matrizPropietario,
    ficha.matrizContratoFirmado,
    ficha.matrizBienvenidaGenerada,
    ficha.matrizLinkResumen,
    ficha.matrizDiagnosticoGenerado,
    ficha.matrizLinkDiagnostico,
    ficha.matrizIngresoGenerado,
    ficha.matrizFechaReunionCreativa,
    ficha.matrizVentaCruzada,
    ficha.matrizObservacionesComerciales,
  ].some((valor) =>
    Array.isArray(valor)
      ? valor.some((v) => v.trim())
      : typeof valor === 'string'
        ? !!valor.trim()
        : valor === true,
  );
}

export function camposModificados(
  antes: Record<string, unknown>,
  despues: Record<string, unknown>,
  campos: string[],
) {
  return campos.filter(
    (campo) => JSON.stringify(antes[campo]) !== JSON.stringify(despues[campo]),
  );
}

export async function auditarCambioComercial(
  tx: Tx,
  proyectoId: string,
  campos: string[],
  actor?: ActorFicha,
) {
  if (actor?.rol !== 'comercial' || campos.length === 0) return;
  const [p] = await tx
    .select({ enviado: proyectos.notificadoRrpp })
    .from(proyectos)
    .where(eq(proyectos.id, proyectoId));
  if (!p?.enviado) return;
  await registrarEvento(tx, {
    actorId: actor.id,
    accion: 'INFORMACION_COMERCIAL_ACTUALIZADA',
    entityType: 'proyecto',
    entityId: proyectoId,
    proyectoId,
    detalles: { campos },
  });
}

async function iniciarEnTransaccion(
  tx: Tx,
  proyectoId: string,
  actorId: string,
) {
  await crearWorkItemSiNoExiste(tx, { proyectoId, tipo: 'intake_rrpp' });
  const [item] = await tx
    .select()
    .from(workItems)
    .where(
      and(
        eq(workItems.proyectoId, proyectoId),
        eq(workItems.tipo, 'intake_rrpp'),
        eq(workItems.businessKey, 'default'),
      ),
    )
    .for('update');
  if (!item || item.estado !== 'pendiente') return;
  await transicionarWorkItem(tx, {
    proyectoId,
    tipo: 'intake_rrpp',
    estado: 'en_progreso',
  });
  await tx
    .update(workItems)
    .set({ fechaInicioReal: new Date().toISOString().slice(0, 10) })
    .where(eq(workItems.id, item.id));
  await registrarEvento(tx, {
    actorId,
    accion: 'INTAKE_RRPP_INICIADO',
    entityType: 'work_item',
    entityId: item.id,
    proyectoId,
  });
}

export async function auditarCambioFicha(
  tx: Tx,
  antes: Ficha,
  despues: Ficha,
  campos: string[],
  actor?: ActorFicha,
) {
  const cambios = camposModificados(antes, despues, campos);
  await auditarCambioComercial(tx, despues.proyectoId, cambios, actor);
  if (actor?.rol !== 'rrpp' || cambios.length === 0) return;
  const [p] = await tx
    .select()
    .from(proyectos)
    .where(eq(proyectos.id, despues.proyectoId));
  if (!p?.notificadoRrpp || p.notificadoJefatura) return;
  const [servicio] = await tx
    .select({ codigo: servicios.codigo })
    .from(servicios)
    .where(eq(servicios.id, p.servicioId));
  await iniciarEnTransaccion(tx, p.id, actor.id);
  await registrarEvento(tx, {
    actorId: actor.id,
    accion:
      !diagnosticoListo(antes, servicio?.codigo ?? '') &&
      diagnosticoListo(despues, servicio?.codigo ?? '')
        ? 'DIAGNOSTICO_COMPLETADO'
        : 'DIAGNOSTICO_ACTUALIZADO',
    entityType: 'proyecto',
    entityId: p.id,
    proyectoId: p.id,
    detalles: { campos: cambios },
  });
}

export async function iniciarIntakeRrpp(proyectoId: string, actorId: string) {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, proyectoId))
      .for('update');
    if (!p)
      return {
        ok: false as const,
        status: 404,
        error: 'Proyecto no encontrado',
      };
    if (!ESTADOS_ACTIVOS.includes(p.estado))
      return {
        ok: false as const,
        status: 409,
        error: 'Este proyecto ya no está activo',
      };
    if (!p.notificadoRrpp)
      return {
        ok: false as const,
        status: 409,
        error: 'Comercial todavía no ha enviado este proyecto a RRPP',
      };
    if (p.notificadoJefatura)
      return {
        ok: false as const,
        status: 409,
        error: 'El ingreso ya fue enviado a Jefatura',
      };
    const [item] = await tx
      .select()
      .from(workItems)
      .where(
        and(
          eq(workItems.proyectoId, proyectoId),
          eq(workItems.tipo, 'intake_rrpp'),
          eq(workItems.businessKey, 'default'),
        ),
      );
    if (item && ['completado', 'cancelado'].includes(item.estado))
      return {
        ok: false as const,
        status: 409,
        error: 'Este ingreso ya está cerrado',
      };
    await iniciarEnTransaccion(tx, proyectoId, actorId);
    return { ok: true as const };
  });
}
