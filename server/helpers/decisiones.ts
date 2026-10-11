import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import {
  correcciones,
  decisiones,
  notificaciones,
  users,
  proyectos,
} from '../db/schema/index.js';
import { nombreServicioProyecto } from '../../shared/planificacion.js';
import { evaluarGateRevisionPreviaCorreccion } from './gates.js';
import { registrarEvento } from './auditLog.js';
import type { Tx } from './tx.js';

// Jefatura · Decisiones — docs/arquitectura/17-jefatura-decisiones.md.
// HUMAN GATES reales, confirmados contra código + documentación
// existente (auditoría previa a este archivo). Union type, no pgEnum —
// mismo criterio que workItems.tipo: agregar un tipo nuevo es un cambio
// de código, nunca un ALTER TYPE.
export type DecisionTipo =
  'revision_previa_correccion' | 'coleccion_inconsistente';

export const SUBJECTS_DECISION: Record<DecisionTipo, string> = {
  revision_previa_correccion: 'Revisión previa de Corrección',
  coleccion_inconsistente: 'Revisión de colección',
};

type Actor = { id: string; rol: string };

// ============================================================
// Creación — SOLO desde workflows autorizados (prompt §19/81), nunca un
// endpoint público de creación libre.
// ============================================================

// Llamada desde crearCorreccion (server/helpers/correcciones.ts) dentro
// de la MISMA transacción que crea la corrección, cuando
// `requiereRevisionPrevia` queda en true. Idempotente por
// `originCorreccionId` UNIQUE: si ya existe (ej. retry de red),
// devuelve la existente sin duplicar.
export async function crearDecisionRevisionPrevia(
  tx: Tx,
  params: {
    proyectoId: string;
    correccionId: string;
    workItemId: string;
    requestedByUserId: string;
    paginas: number;
  },
): Promise<string> {
  const [existente] = await tx
    .select({ id: decisiones.id })
    .from(decisiones)
    .where(eq(decisiones.originCorreccionId, params.correccionId));
  if (existente) return existente.id;

  const [fila] = await tx
    .insert(decisiones)
    .values({
      proyectoId: params.proyectoId,
      tipo: 'revision_previa_correccion' satisfies DecisionTipo,
      originCorreccionId: params.correccionId,
      originWorkItemId: params.workItemId,
      requestedByUserId: params.requestedByUserId,
      subject: SUBJECTS_DECISION.revision_previa_correccion,
      requestMessage: `La tripa contiene ${params.paginas} páginas — supera el umbral de 120 y requiere revisión previa antes de asignar corrector.`,
      contextSnapshot: { paginas: params.paginas },
    })
    .returning({ id: decisiones.id });
  const id = fila!.id;

  await registrarEvento(tx, {
    actorId: params.requestedByUserId,
    accion: 'DECISION_CREADA',
    entityType: 'decision',
    entityId: id,
    proyectoId: params.proyectoId,
    detalles: { tipo: 'revision_previa_correccion', paginas: params.paginas },
  });
  await tx.insert(notificaciones).values({
    decisionId: id,
    proyectoId: params.proyectoId,
    rolDestino: 'jefe_area',
    mensaje: `Nueva revisión requerida — ${SUBJECTS_DECISION.revision_previa_correccion}`,
  });
  return id;
}

// Llamada desde el endpoint de escalación de Calidad
// (server/routes/calidad.routes.ts) cuando Soporte Editorial declara
// explícitamente una discrepancia de colección en su fase. Idempotente por
// `originCalidadFaseId` UNIQUE — doble click no duplica.
export async function crearDecisionColeccionInconsistente(
  tx: Tx,
  params: {
    proyectoId: string;
    calidadFaseId: string;
    workItemId: string | null;
    requestedByUserId: string;
    coleccionRegistrada: string | null;
    motivo: string;
  },
): Promise<{ id: string; yaExistia: boolean }> {
  const [existente] = await tx
    .select({ id: decisiones.id })
    .from(decisiones)
    .where(eq(decisiones.originCalidadFaseId, params.calidadFaseId));
  if (existente) return { id: existente.id, yaExistia: true };

  const [fila] = await tx
    .insert(decisiones)
    .values({
      proyectoId: params.proyectoId,
      tipo: 'coleccion_inconsistente' satisfies DecisionTipo,
      originCalidadFaseId: params.calidadFaseId,
      originWorkItemId: params.workItemId,
      requestedByUserId: params.requestedByUserId,
      subject: SUBJECTS_DECISION.coleccion_inconsistente,
      requestMessage: params.motivo,
      contextSnapshot: { coleccionRegistrada: params.coleccionRegistrada },
    })
    .returning({ id: decisiones.id });
  const id = fila!.id;

  await registrarEvento(tx, {
    actorId: params.requestedByUserId,
    accion: 'DECISION_CREADA',
    entityType: 'decision',
    entityId: id,
    proyectoId: params.proyectoId,
    detalles: {
      tipo: 'coleccion_inconsistente',
      coleccionRegistrada: params.coleccionRegistrada,
      motivo: params.motivo,
    },
  });
  await tx.insert(notificaciones).values({
    decisionId: id,
    proyectoId: params.proyectoId,
    rolDestino: 'jefe_area',
    mensaje: `Nueva escalación — ${SUBJECTS_DECISION.coleccion_inconsistente}`,
  });
  return { id, yaExistia: false };
}

// ============================================================
// Lectura — bandeja + detalle + actividad.
// ============================================================

export interface FiltrosDecisiones {
  q?: string;
  status?: string; // 'todas' | DecisionStatus
  tipo?: string;
  origen?: 'correccion' | 'calidad';
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface ItemDecision {
  id: string;
  proyectoId: string;
  codigo: string;
  titulo: string;
  autores: string;
  tipo: string;
  subject: string;
  status: string;
  resolutionType: string | null;
  requestedAt: string;
  requestedByNombre: string;
  requestMessage: string | null;
  origen: 'correccion' | 'calidad';
  bloqueaCorreccion: boolean;
  urgente: boolean;
}

// Resumen operativo compacto (prompt §25/30) -- SOLO pendientes/urgentes/
// esperando info, nada histórico (eso es Indicadores, fuera de este módulo).
export async function resumenDecisiones() {
  const { rows } = await pool.query<{
    pendientes: string;
    urgentes: string;
    esperando_info: string;
  }>(
    `SELECT
       count(*) FILTER (WHERE d.status IN ('pendiente','en_revision')) pendientes,
       count(*) FILTER (WHERE d.status <> 'resuelta' AND d.tipo='revision_previa_correccion' AND c.requiere_revision_previa AND NOT c.revision_previa_confirmada) urgentes,
       count(*) FILTER (WHERE d.status = 'informacion_solicitada') esperando_info
     FROM decisiones d JOIN proyectos p ON p.id = d.proyecto_id LEFT JOIN correcciones c ON c.id=d.origin_correccion_id
     WHERE d.target_role='jefe_area' AND p.estado <> 'retirado'`,
  );
  const r = rows[0]!;
  return {
    pendientes: Number(r.pendientes),
    urgentes: Number(r.urgentes),
    esperandoInfo: Number(r.esperando_info),
  };
}

export async function listarDecisiones(f: FiltrosDecisiones) {
  const condiciones: string[] = [
    "d.target_role='jefe_area'",
    "p.estado <> 'retirado'",
  ];
  const valores: unknown[] = [];
  function add(sqlCond: string, valor?: unknown) {
    if (valor !== undefined) valores.push(valor);
    condiciones.push(sqlCond.replace('$N', `$${valores.length}`));
  }
  // Tabs reales de la bandeja (prompt §31): Pendientes / En revisión /
  // Esperando información / Resueltas -- CUATRO filtros separados, cada
  // uno un status exacto (no un "pendiente" que mezcle dos estados).
  if (f.status === 'abiertas') condiciones.push("d.status<>'resuelta'");
  else if (f.status && f.status !== 'todas') add(`d.status = $N`, f.status);
  if (f.tipo) add(`d.tipo = $N`, f.tipo);
  if (f.origen)
    condiciones.push(
      f.origen === 'correccion'
        ? 'd.origin_correccion_id IS NOT NULL'
        : 'd.origin_calidad_fase_id IS NOT NULL',
    );
  if (f.from)
    add(
      `(d.requested_at AT TIME ZONE 'America/Caracas')::date >= $N::date`,
      f.from,
    );
  if (f.to)
    add(
      `(d.requested_at AT TIME ZONE 'America/Caracas')::date <= $N::date`,
      f.to,
    );
  if (f.q?.trim()) {
    add(
      `translate(lower(concat_ws(' ',p.codigo,p.titulo_definitivo,p.titulo,coalesce(aut.nombres,principal.nombre),d.subject,d.request_message)),'áéíóúüñ','aeiouun') LIKE $N ESCAPE '\\'`,
      `%${f.q
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[\\%_]/g, '\\$&')}%`,
    );
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const offset = (f.page - 1) * f.pageSize;
  valores.push(f.pageSize, offset);

  const { rows } = await pool.query<{
    id: string;
    proyecto_id: string;
    codigo: string;
    titulo: string | null;
    titulo_definitivo: string | null;
    autores: string | null;
    tipo: string;
    subject: string;
    status: string;
    resolution_type: string | null;
    requested_at: Date;
    requested_by_nombre: string;
    request_message: string | null;
    gate_bloqueado: boolean;
    express_decision: string | null;
  }>(
    `SELECT d.id,d.proyecto_id,p.codigo,p.titulo,p.titulo_definitivo,coalesce(aut.nombres,principal.nombre) autores,d.tipo,d.subject,d.status,d.resolution_type,
            d.requested_at,d.request_message,coalesce(u.nombre,'Sistema') requested_by_nombre,p.express_decision,
            coalesce(c.requiere_revision_previa AND NOT c.revision_previa_confirmada AND d.status <> 'resuelta',false) gate_bloqueado
     FROM decisiones d
     JOIN proyectos p ON p.id = d.proyecto_id
     LEFT JOIN usuarios u ON u.id = d.requested_by_user_id
     LEFT JOIN autores principal ON principal.id=p.autor_id
     LEFT JOIN correcciones c ON c.id=d.origin_correccion_id
     LEFT JOIN LATERAL (SELECT string_agg(au.nombre, ', ' ORDER BY au.nombre) nombres FROM proyectos_autores pa JOIN autores au ON au.id = pa.autor_id WHERE pa.proyecto_id = p.id) aut ON true
     ${where}
     ORDER BY gate_bloqueado DESC, d.requested_at ASC, d.id ASC
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores,
  );

  const { rows: countRows } = await pool.query<{ total: string }>(
    `SELECT count(*) total FROM decisiones d JOIN proyectos p ON p.id = d.proyecto_id
     LEFT JOIN autores principal ON principal.id=p.autor_id
     LEFT JOIN LATERAL (SELECT string_agg(au.nombre, ', ' ORDER BY au.nombre) nombres FROM proyectos_autores pa JOIN autores au ON au.id = pa.autor_id WHERE pa.proyecto_id = p.id) aut ON true
     ${where}`,
    valores.slice(0, -2),
  );

  const items: ItemDecision[] = rows.map((r) => ({
    id: r.id,
    proyectoId: r.proyecto_id,
    codigo: r.codigo,
    titulo: r.titulo_definitivo ?? r.titulo ?? r.codigo,
    autores: r.autores ?? '',
    tipo: r.tipo,
    subject: r.subject,
    status: r.status,
    resolutionType: r.resolution_type,
    requestedAt: r.requested_at.toISOString(),
    requestedByNombre: r.requested_by_nombre,
    requestMessage: r.request_message,
    origen: r.tipo === 'revision_previa_correccion' ? 'correccion' : 'calidad',
    bloqueaCorreccion: r.gate_bloqueado,
    urgente: false,
  }));

  return {
    items,
    total: Number(countRows[0]!.total),
    page: f.page,
    pageSize: f.pageSize,
  };
}

export interface DetalleDecision {
  id: string;
  proyectoId: string;
  codigo: string;
  titulo: string;
  autores: string;
  servicioCodigo: string | null;
  servicioNombre: string;
  especialistaNombre: string | null;
  tipo: string;
  subject: string;
  status: string;
  resolutionType: string | null;
  resolutionMessage: string | null;
  requestMessage: string | null;
  requestedAt: string;
  requestedByNombre: string;
  requestedByRole: string;
  requestedByUserId: string;
  originWorkItemId: string | null;
  reviewStartedAt: string | null;
  requestedInfoMessage: string | null;
  requestedInfoAt: string | null;
  respondedInfoMessage: string | null;
  respondedInfoAt: string | null;
  resolvedAt: string | null;
  resolvedByNombre: string | null;
  contextSnapshot: Record<string, unknown> | null;
  version: number;
  // Datos vivos del origen (nunca copiados, siempre consultados en el momento).
  correccion: {
    paginas: number | null;
    alcance: string | null;
    requiereRevisionPrevia: boolean;
    revisionPreviaConfirmada: boolean;
  } | null;
}

export async function obtenerDecision(
  id: string,
  actor?: Actor,
): Promise<DetalleDecision | null> {
  const { rows } = await pool.query(
    `SELECT d.*, p.codigo, p.titulo, p.titulo_definitivo, coalesce(aut.nombres,principal.nombre) autores, s.codigo servicio_codigo,s.nombre servicio_nombre,f.ingreso_servicio_subtipo_crudo subtipo,
            esp.nombre especialista_nombre, req.nombre requested_by_nombre, req.rol requested_by_role, res.nombre resolved_by_nombre,
            c.paginas correccion_paginas, c.alcance correccion_alcance,
            c.requiere_revision_previa correccion_requiere_revision_previa, c.revision_previa_confirmada correccion_revision_previa_confirmada
     FROM decisiones d
     JOIN proyectos p ON p.id = d.proyecto_id
     LEFT JOIN servicios s ON s.id = p.servicio_id
     LEFT JOIN fichas_trazabilidad f ON f.proyecto_id=p.id
     LEFT JOIN autores principal ON principal.id=p.autor_id
     LEFT JOIN LATERAL (SELECT a.usuario_id FROM project_assignments a WHERE a.proyecto_id=p.id AND a.tipo='especialista' AND a.work_item_id IS NULL AND a.finalizado_en IS NULL ORDER BY a.asignado_en DESC,a.id DESC LIMIT 1) actual ON true
     LEFT JOIN usuarios esp ON esp.id = coalesce(actual.usuario_id,p.especialista_id)
     LEFT JOIN usuarios req ON req.id = d.requested_by_user_id
     LEFT JOIN usuarios res ON res.id = d.resolved_by_user_id
     LEFT JOIN correcciones c ON c.id = d.origin_correccion_id
     LEFT JOIN LATERAL (SELECT string_agg(au.nombre, ', ' ORDER BY au.nombre) nombres FROM proyectos_autores pa JOIN autores au ON au.id = pa.autor_id WHERE pa.proyecto_id = p.id) aut ON true
     WHERE d.id = $1 AND p.estado <> 'retirado' ${actor ? 'AND (d.target_role=$2 OR d.requested_by_user_id=$3)' : "AND d.target_role='jefe_area'"}`,
    actor ? [id, actor.rol, actor.id] : [id],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    proyectoId: r.proyecto_id,
    codigo: r.codigo,
    titulo: r.titulo_definitivo ?? r.titulo ?? r.codigo,
    autores: r.autores ?? '',
    servicioCodigo: r.servicio_codigo,
    servicioNombre: nombreServicioProyecto(
      r.servicio_codigo,
      r.servicio_nombre,
      r.subtipo,
    ),
    especialistaNombre: r.especialista_nombre,
    tipo: r.tipo,
    subject: r.subject,
    status: r.status,
    resolutionType: r.resolution_type,
    resolutionMessage: r.resolution_message,
    requestMessage: r.request_message,
    requestedAt: r.requested_at.toISOString(),
    requestedByNombre: r.requested_by_nombre ?? 'Sistema',
    requestedByRole: r.requested_by_role,
    requestedByUserId: r.requested_by_user_id,
    originWorkItemId: r.origin_work_item_id,
    reviewStartedAt: r.review_started_at?.toISOString() ?? null,
    requestedInfoMessage: r.requested_info_message,
    requestedInfoAt: r.requested_info_at?.toISOString() ?? null,
    respondedInfoMessage: r.responded_info_message,
    respondedInfoAt: r.responded_info_at?.toISOString() ?? null,
    resolvedAt: r.resolved_at?.toISOString() ?? null,
    resolvedByNombre: r.resolved_by_nombre ?? null,
    contextSnapshot: r.context_snapshot,
    version: r.version,
    correccion: r.origin_correccion_id
      ? {
          paginas: r.correccion_paginas,
          alcance: r.correccion_alcance,
          requiereRevisionPrevia: r.correccion_requiere_revision_previa,
          revisionPreviaConfirmada: r.correccion_revision_previa_confirmada,
        }
      : null,
  };
}

const LABELS_ACTIVIDAD: Record<string, string> = {
  DECISION_CREADA: 'creó la solicitud',
  DECISION_REVISION_INICIADA: 'inició la revisión',
  DECISION_INFORMACION_SOLICITADA: 'solicitó información adicional',
  DECISION_INFORMACION_RESPONDIDA: 'respondió con información adicional',
  DECISION_RESUELTA: 'resolvió el caso',
};

export async function actividadDecision(id: string) {
  const { rows } = await pool.query<{
    id: string;
    fecha: Date;
    accion: string;
    actor: string;
    detalles: Record<string, unknown> | null;
  }>(
    `SELECT a.id,a.created_at fecha,a.accion,coalesce(u.nombre,'Sistema') actor,a.detalles
     FROM audit_logs a LEFT JOIN usuarios u ON u.id = a.actor_id
     WHERE a.entity_type = 'decision' AND a.entity_id = $1
     ORDER BY a.created_at ASC, a.id ASC`,
    [id],
  );
  return rows.map((r) => {
    let texto = LABELS_ACTIVIDAD[r.accion] ?? 'registró un avance';
    if (
      r.accion === 'DECISION_RESUELTA' &&
      typeof r.detalles?.resolutionType === 'string'
    ) {
      texto =
        r.detalles.resolutionType === 'approved'
          ? 'aprobó el caso'
          : r.detalles.resolutionType === 'rejected'
            ? 'rechazó el caso'
            : 'canceló el caso';
    }
    return {
      id: r.id,
      actor: r.actor,
      texto,
      fecha: r.fecha.toISOString(),
      detalles: r.detalles,
    };
  });
}

// ============================================================
// Lifecycle — transiciones + resolución transaccional type-aware.
// ============================================================

export type ResultadoAccionDecision =
  { ok: true } | { ok: false; status: 400 | 403 | 404 | 409; error: string };

async function obtenerParaEscritura(tx: Tx, id: string) {
  // Serialize all transitions, including double clicks without a client version.
  const [fila] = await tx
    .select()
    .from(decisiones)
    .where(eq(decisiones.id, id))
    .for('update');
  if (fila) {
    const [p] = await tx
      .select({ estado: proyectos.estado })
      .from(proyectos)
      .where(eq(proyectos.id, fila.proyectoId));
    if (!p || p.estado === 'retirado') return null;
  }
  return fila ?? null;
}

function chequearVersion(
  actual: number,
  esperada: number | undefined,
): ResultadoAccionDecision | null {
  if (esperada !== undefined && esperada !== actual) {
    return {
      ok: false,
      status: 409,
      error:
        'Esta decisión cambió mientras la tenías abierta — recargá para ver el estado actual',
    };
  }
  return null;
}

export async function iniciarRevision(
  id: string,
  actor: Actor,
  expectedVersion?: number,
): Promise<ResultadoAccionDecision> {
  return db.transaction(async (tx) => {
    const d = await obtenerParaEscritura(tx, id);
    if (!d) return { ok: false, status: 404, error: 'Decisión no encontrada' };
    if (actor.rol !== d.targetRole)
      return { ok: false, status: 403, error: 'No autorizado' };
    const errVersion = chequearVersion(d.version, expectedVersion);
    if (errVersion) return errVersion;
    if (d.status === 'resuelta')
      return { ok: false, status: 400, error: 'Esta decisión ya fue resuelta' };
    if (d.status !== 'pendiente') return { ok: true }; // idempotente: ya en revisión o esperando info.

    await tx
      .update(decisiones)
      .set({
        status: 'en_revision',
        reviewStartedAt: new Date(),
        assignedDecisionMakerId: actor.id,
        version: d.version + 1,
      })
      .where(eq(decisiones.id, id));
    await registrarEvento(tx, {
      actorId: actor.id,
      accion: 'DECISION_REVISION_INICIADA',
      entityType: 'decision',
      entityId: id,
      proyectoId: d.proyectoId,
    });
    return { ok: true };
  });
}

export async function solicitarInformacion(
  id: string,
  actor: Actor,
  mensaje: string,
  expectedVersion?: number,
): Promise<ResultadoAccionDecision> {
  if (!mensaje.trim())
    return {
      ok: false,
      status: 400,
      error: 'Indicá qué información necesitás',
    };
  return db.transaction(async (tx) => {
    const d = await obtenerParaEscritura(tx, id);
    if (!d) return { ok: false, status: 404, error: 'Decisión no encontrada' };
    if (actor.rol !== d.targetRole)
      return { ok: false, status: 403, error: 'No autorizado' };
    const errVersion = chequearVersion(d.version, expectedVersion);
    if (errVersion) return errVersion;
    if (d.status === 'resuelta')
      return { ok: false, status: 400, error: 'Esta decisión ya fue resuelta' };
    if (d.status === 'informacion_solicitada')
      return {
        ok: false,
        status: 409,
        error: 'Este caso ya está esperando información',
      };

    await tx
      .update(decisiones)
      .set({
        status: 'informacion_solicitada',
        requestedInfoMessage: mensaje.trim(),
        requestedInfoAt: new Date(),
        requestedInfoById: actor.id,
        respondedInfoMessage: null,
        respondedInfoAt: null,
        version: d.version + 1,
      })
      .where(eq(decisiones.id, id));
    await registrarEvento(tx, {
      actorId: actor.id,
      accion: 'DECISION_INFORMACION_SOLICITADA',
      entityType: 'decision',
      entityId: id,
      proyectoId: d.proyectoId,
      detalles: { mensaje },
    });
    const [solicitante] = await tx
      .select({ rol: users.rol })
      .from(users)
      .where(eq(users.id, d.requestedByUserId));
    await tx.insert(notificaciones).values({
      decisionId: id,
      proyectoId: d.proyectoId,
      rolDestino: solicitante!.rol,
      usuarioDestinoId: d.requestedByUserId,
      mensaje: `Jefatura solicitó información adicional sobre: ${d.subject}`,
    });
    return { ok: true };
  });
}

// Solo quien originó la decisión puede responder (prompt §52/76/78) — no
// es una resolución, vuelve a quedar pendiente de revisión por Jefatura.
export async function responderInformacion(
  id: string,
  actor: Actor,
  mensaje: string,
  expectedVersion?: number,
): Promise<ResultadoAccionDecision> {
  if (!mensaje.trim())
    return { ok: false, status: 400, error: 'Escribí tu respuesta' };
  return db.transaction(async (tx) => {
    const d = await obtenerParaEscritura(tx, id);
    if (!d) return { ok: false, status: 404, error: 'Decisión no encontrada' };
    if (d.requestedByUserId !== actor.id)
      return { ok: false, status: 403, error: 'No autorizado' };
    const errVersion = chequearVersion(d.version, expectedVersion);
    if (errVersion) return errVersion;
    if (d.status !== 'informacion_solicitada')
      return {
        ok: false,
        status: 400,
        error: 'Esta decisión no está esperando información',
      };

    await tx
      .update(decisiones)
      .set({
        status: 'en_revision',
        respondedInfoMessage: mensaje.trim(),
        respondedInfoAt: new Date(),
        version: d.version + 1,
      })
      .where(eq(decisiones.id, id));
    await registrarEvento(tx, {
      actorId: actor.id,
      accion: 'DECISION_INFORMACION_RESPONDIDA',
      entityType: 'decision',
      entityId: id,
      proyectoId: d.proyectoId,
      detalles: { mensaje },
    });
    await tx.insert(notificaciones).values({
      decisionId: id,
      proyectoId: d.proyectoId,
      rolDestino: d.targetRole,
      mensaje: `Recibiste información adicional sobre: ${d.subject}`,
    });
    return { ok: true };
  });
}

export type ResolutionType = 'approved' | 'rejected' | 'cancelled';

// Resolución TYPE-AWARE (prompt §18/74) — aprobar desbloquea el gate de
// origen en la MISMA transacción; nunca "decisión aprobada pero gate
// sigue bloqueado" ni al revés.
export async function resolverDecision(
  id: string,
  actor: Actor,
  resolution: ResolutionType,
  mensaje: string | undefined,
  expectedVersion: number | undefined,
): Promise<ResultadoAccionDecision> {
  if (resolution === 'rejected' && !mensaje?.trim()) {
    return {
      ok: false,
      status: 400,
      error: 'El rechazo requiere una justificación',
    };
  }
  return db.transaction(async (tx) => {
    const d = await obtenerParaEscritura(tx, id);
    if (!d) return { ok: false, status: 404, error: 'Decisión no encontrada' };
    if (actor.rol !== d.targetRole)
      return { ok: false, status: 403, error: 'No autorizado' };
    const errVersion = chequearVersion(d.version, expectedVersion);
    if (errVersion) return errVersion;
    if (d.status === 'resuelta')
      return { ok: false, status: 400, error: 'Esta decisión ya fue resuelta' };
    if (d.status === 'informacion_solicitada')
      return {
        ok: false,
        status: 409,
        error:
          'Espera la respuesta del solicitante antes de resolver este caso',
      };

    if (
      resolution === 'approved' &&
      d.tipo === 'revision_previa_correccion' &&
      d.originCorreccionId
    ) {
      const [correccion] = await tx
        .select()
        .from(correcciones)
        .where(eq(correcciones.id, d.originCorreccionId))
        .for('update');
      if (!correccion)
        return {
          ok: false,
          status: 400,
          error: 'La corrección de origen ya no existe',
        };
      if (correccion.proyectoId !== d.proyectoId)
        return {
          ok: false,
          status: 409,
          error: 'El origen del caso no coincide con el proyecto',
        };
      // No reabre un gate ya satisfecho por otra vía — idempotente.
      if (!correccion.revisionPreviaConfirmada) {
        await tx
          .update(correcciones)
          .set({ revisionPreviaConfirmada: true })
          .where(eq(correcciones.id, d.originCorreccionId));
      }
    }

    await tx
      .update(decisiones)
      .set({
        status: 'resuelta',
        resolutionType: resolution,
        resolutionMessage: mensaje?.trim() || null,
        resolvedAt: new Date(),
        resolvedByUserId: actor.id,
        version: d.version + 1,
      })
      .where(eq(decisiones.id, id));
    await registrarEvento(tx, {
      actorId: actor.id,
      accion: 'DECISION_RESUELTA',
      entityType: 'decision',
      entityId: id,
      proyectoId: d.proyectoId,
      detalles: { resolutionType: resolution, mensaje: mensaje ?? null },
    });
    const [solicitante] = await tx
      .select({ rol: users.rol })
      .from(users)
      .where(eq(users.id, d.requestedByUserId));
    await tx.insert(notificaciones).values({
      decisionId: id,
      proyectoId: d.proyectoId,
      rolDestino: solicitante!.rol,
      usuarioDestinoId: d.requestedByUserId,
      mensaje:
        resolution === 'approved'
          ? `Jefatura aprobó: ${d.subject}`
          : resolution === 'rejected'
            ? `Jefatura rechazó: ${d.subject}`
            : `Jefatura canceló: ${d.subject}`,
    });
    if (d.tipo === 'coleccion_inconsistente' && resolution === 'approved') {
      await tx
        .insert(notificaciones)
        .values({
          proyectoId: d.proyectoId,
          rolDestino: 'rrpp',
          mensaje: `Jefatura solicita revisar la colección registrada: ${mensaje?.trim() || d.requestMessage || d.subject}`,
        });
    }
    return { ok: true };
  });
}

// Reexportado para que las rutas puedan evaluar el gate sin importar
// directamente gates.ts (mismo patrón que correcciones.ts).
export { evaluarGateRevisionPreviaCorreccion };
