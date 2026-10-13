import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import {
  auditLogs,
  correcciones,
  fichaCalidadFases,
  fichasTrazabilidad,
  pausas,
  projectAssignments,
  proyectos,
  seguimientoFases,
  users,
  workItems,
} from '../db/schema/index.js';
import { calcularDuracionEfectivaMs, type RangoPausa } from './performance.js';
import { evaluarPlazoCorreccion } from './correccionSla.js';
import { calcularDueAtCorreccion } from './correccionSla.js';
import { registrarEvento } from './auditLog.js';
import { nombreServicioProyecto } from '../../shared/planificacion.js';
import {
  MATERIALES_SEGUIMIENTO,
  PROCESOS_SEGUIMIENTO,
  RESULTADOS_SEGUIMIENTO,
} from '../../shared/seguimientoOperativo.js';
import type {
  CambiosSupervision,
  FiltrosIntervenciones,
  IntervencionSeguimiento,
  ListaIntervenciones,
  OrigenIntervencion,
  ResultadoSeguimiento,
} from '../../shared/seguimientoOperativo.js';

export class ErrorSeguimiento extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const exigir = (valor: unknown, mensaje: string, status = 403) => {
  if (!valor) throw new ErrorSeguimiento(status, mensaje);
};
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const iso = (v: unknown): string | null =>
  v ? new Date(String(v)).toISOString() : null;
const round = (n: number) => Math.round(n * 100) / 100;
const hoyCaracas = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

// Una proyección SQL, no otro workflow. Las notas se enlazan sin copiar
// assignments, autores, fechas ni campos del origen. Identidad = origen + id.
const fuentesIntervenciones = (incluirRetirados = false) => `
WITH intervenciones AS (
 SELECT c.id, 'correccion'::text origen, c.proyecto_id, c.work_item_id,
 c.alcance material, 'correccion'::text proceso,
 row_number() OVER (PARTITION BY c.proyecto_id,c.alcance ORDER BY c.created_at,c.id)::int ronda,
 c.created_at, c.asignado_en recibido, c.iniciado_en iniciado, c.entregado_en entregado, c.due_at vence,
 c.fecha_asignada, c.fecha_inicio, c.fecha_entrega,
 coalesce(w.estado::text,'pendiente') estado_work, c.paginas,
 c.corrector_id responsable_id,c.corrector_nombre externo,coalesce(c.freelance,false) freelance,
 c.contrato_confirmado, c.resultado resultado_operativo, c.observaciones observaciones_operativas,
 c.requiere_revision_previa gate_requerido,c.revision_previa_confirmada gate_confirmado,
 NULL::int fase_numero, to_jsonb(n) nota
 FROM correcciones c LEFT JOIN work_items w ON w.id=c.work_item_id
 LEFT JOIN seguimiento_fases n ON n.correccion_id=c.id
 UNION ALL
 SELECT c.id, 'calidad', f.proyecto_id,c.work_item_id,'tripa_diagramada',
 CASE c.numero_fase WHEN 1 THEN 'fase_calidad_1' WHEN 3 THEN 'revision_final' ELSE 'validacion' END,
 c.ronda,c.created_at,c.solicitado_en,c.iniciado_en,c.revisado_en,c.due_at,
 CASE WHEN c.solicitado_en IS NULL AND c.aprobado IS NULL THEN c.fecha END,NULL::date,
 CASE WHEN c.revisado_en IS NULL AND c.aprobado IS NOT NULL THEN c.fecha END,
 coalesce(w.estado::text,CASE WHEN c.aprobado IS NOT NULL THEN 'completado' ELSE 'pendiente' END),
 c.cantidad_paginas,coalesce(c.revisado_por_id,c.iniciado_por_id),c.nombre_quien_recibe,false,
 NULL::boolean,CASE WHEN c.aprobado IS TRUE THEN 'aprobado' WHEN c.aprobado IS FALSE THEN 'requiere_ajustes' END,
 c.observaciones,false,false,c.numero_fase,
 coalesce(to_jsonb(n),'{}'::jsonb) || jsonb_build_object('comentarios_canonicos',c.cantidad_comentarios)
 FROM ficha_calidad_fases c JOIN fichas_trazabilidad f ON f.id=c.ficha_id
 LEFT JOIN work_items w ON w.id=c.work_item_id LEFT JOIN seguimiento_fases n ON n.calidad_fase_id=c.id
 UNION ALL
 SELECT n.id,'legacy',n.proyecto_id,NULL::uuid,
 CASE upper(trim(n.asignacion_tipo)) WHEN 'TRIPA COMPLETA' THEN 'tripa_completa' WHEN 'TRIPA DIAGRAMADA' THEN 'tripa_diagramada'
 WHEN 'PRELIMINARES' THEN 'preliminares' WHEN 'CUBIERTA EXTENDIDA' THEN 'cubierta_extendida'
 WHEN 'TEXTO CONTRAPORTADA' THEN 'texto_contraportada' ELSE 'sin_clasificar' END,
 CASE translate(lower(trim(n.tipo_servicio)),'áéíóú','aeiou') WHEN 'correccion' THEN 'correccion'
 WHEN 'validacion' THEN 'validacion' WHEN 'validacion v2' THEN 'validacion'
 WHEN 'fase de calidad 1' THEN 'fase_calidad_1' WHEN 'fase de calidad v1' THEN 'fase_calidad_1'
 WHEN 'revision final' THEN 'revision_final' WHEN 'edicion' THEN 'edicion' ELSE 'sin_clasificar' END,
 NULL::int,
 n.created_at,
 CASE WHEN n.fecha_asignada IS NOT NULL AND n.hora_recibida IS NOT NULL THEN (n.fecha_asignada+n.hora_recibida) AT TIME ZONE 'America/Caracas' END,
 CASE WHEN n.fecha_inicio IS NOT NULL AND n.hora_inicio IS NOT NULL THEN (n.fecha_inicio+n.hora_inicio) AT TIME ZONE 'America/Caracas' END,
 CASE WHEN n.fecha_entrega IS NOT NULL AND n.hora_entrega IS NOT NULL THEN (n.fecha_entrega+n.hora_entrega) AT TIME ZONE 'America/Caracas' END,
 NULL::timestamptz,n.fecha_asignada,n.fecha_inicio,n.fecha_entrega,
 CASE translate(lower(trim(n.estatus)),'áéíóú','aeiou') WHEN 'entregado' THEN 'completado' WHEN 'en proceso' THEN 'en_progreso'
 WHEN 'bloqueado' THEN 'bloqueado' WHEN 'cancelado' THEN 'cancelado' ELSE 'pendiente' END,
 n.paginas,n.analista_id,NULL::text,n.freelance,NULL::boolean,NULL::text,NULL::text,false,false,
 CASE WHEN translate(lower(trim(n.tipo_servicio)),'áéíóú','aeiou') IN ('fase de calidad 1','fase de calidad v1') THEN 1 END,to_jsonb(n)
 FROM seguimiento_fases n WHERE n.correccion_id IS NULL AND n.calidad_fase_id IS NULL
), contexto AS (
 SELECT r.*,decision.id decision_id,p.codigo,p.titulo_definitivo,p.titulo,p.estado::text estado_proyecto,u.nombre unidad,
 s.codigo servicio_codigo,s.nombre servicio_nombre,f.ingreso_servicio_subtipo_crudo subtipo_crudo,
 coalesce(aut.nombres,a.nombre) autores,
 coalesce(esp.usuario_id,p.especialista_id) especialista_id,e.nombre especialista_nombre,
 le.nombre especialista_legacy_nombre,
 coalesce(anal.usuario_id,r.responsable_id) analista_id,an.nombre analista_nombre,
 CASE WHEN r.estado_work='cancelado' THEN 'cancelado' WHEN r.estado_work='bloqueado' THEN 'bloqueado'
 WHEN r.entregado IS NOT NULL OR r.fecha_entrega IS NOT NULL OR r.estado_work='completado' THEN 'entregado'
 WHEN r.iniciado IS NOT NULL OR r.fecha_inicio IS NOT NULL THEN 'en_progreso'
 WHEN coalesce(anal.usuario_id,r.responsable_id) IS NOT NULL OR r.externo IS NOT NULL THEN 'asignado'
 WHEN r.estado_work='en_progreso' THEN 'en_progreso' ELSE 'pendiente' END estado,
 CASE lower(trim(r.nota->>'resultados_correccion')) WHEN 'buena' THEN 'buena' WHEN 'regular' THEN 'regular'
 WHEN 'deficiente' THEN 'deficiente' WHEN 'excelente' THEN 'excelente' WHEN 'desestimar' THEN 'desestimar'
 WHEN 'n/a' THEN 'no_aplica' WHEN 'no_aplica' THEN 'no_aplica' END resultado_seguimiento
 FROM intervenciones r JOIN proyectos p ON p.id=r.proyecto_id JOIN autores a ON a.id=p.autor_id
 LEFT JOIN decisiones decision ON decision.target_role='jefe_area' AND decision.status<>'resuelta' AND ((r.origen='correccion' AND decision.origin_correccion_id=r.id) OR (r.origen='calidad' AND decision.origin_calidad_fase_id=r.id))
 JOIN servicios s ON s.id=p.servicio_id LEFT JOIN unidades u ON u.id=p.unidad_id
 LEFT JOIN fichas_trazabilidad f ON f.proyecto_id=p.id
 LEFT JOIN LATERAL (SELECT string_agg(au.nombre,', ' ORDER BY au.nombre) nombres FROM proyectos_autores pa JOIN autores au ON au.id=pa.autor_id WHERE pa.proyecto_id=p.id) aut ON true
 LEFT JOIN LATERAL (SELECT usuario_id FROM project_assignments WHERE proyecto_id=p.id AND work_item_id IS NULL AND tipo='especialista' AND finalizado_en IS NULL ORDER BY asignado_en DESC,id LIMIT 1) esp ON true
 LEFT JOIN usuarios e ON e.id=coalesce(esp.usuario_id,p.especialista_id)
 LEFT JOIN usuarios le ON le.id=(r.nota->>'especialista_id')::uuid AND r.origen='legacy'
 LEFT JOIN LATERAL (SELECT usuario_id FROM project_assignments WHERE work_item_id=r.work_item_id AND finalizado_en IS NULL
 AND tipo=CASE WHEN r.origen='correccion' THEN 'corrector' ELSE 'validador' END::tipo_asignacion ORDER BY asignado_en DESC,id LIMIT 1) anal ON true
 LEFT JOIN usuarios an ON an.id=coalesce(anal.usuario_id,r.responsable_id)
 WHERE p.estado IN ('en_proceso','retrasado','pausado','stand_by','culminado'${incluirRetirados ? ",'retirado'" : ''})
 AND (p.notificado_jefatura OR coalesce(esp.usuario_id,p.especialista_id) IS NOT NULL)
)
`;

interface FilaIntervencion {
  decision_id: string | null;
  id: string;
  origen: OrigenIntervencion;
  proyecto_id: string;
  work_item_id: string | null;
  material: IntervencionSeguimiento['material'];
  proceso: IntervencionSeguimiento['proceso'];
  ronda: number | null;
  created_at: string;
  recibido: string | null;
  iniciado: string | null;
  entregado: string | null;
  vence: string | null;
  fecha_asignada: string | null;
  fecha_inicio: string | null;
  fecha_entrega: string | null;
  estado: IntervencionSeguimiento['estado'];
  paginas: number | null;
  freelance: boolean;
  contrato_confirmado: boolean | null;
  resultado_operativo: string | null;
  resultado_seguimiento: ResultadoSeguimiento | null;
  observaciones_operativas: string | null;
  codigo: string;
  titulo_definitivo: string | null;
  titulo: string | null;
  estado_proyecto: string;
  autores: string;
  unidad: string | null;
  servicio_codigo: string;
  servicio_nombre: string;
  subtipo_crudo: string | null;
  especialista_id: string | null;
  especialista_nombre: string | null;
  especialista_legacy_nombre: string | null;
  analista_id: string | null;
  analista_nombre: string | null;
  externo: string | null;
  gate_requerido: boolean;
  gate_confirmado: boolean;
  fase_numero: number | null;
  nota: {
    id?: string;
    observaciones?: string | null;
    observaciones_fase_1?: string | null;
    comentarios_canonicos?: number | null;
    cantidad_comentarios?: number | null;
    pago_80?: boolean;
    pago_20?: boolean;
    updated_at?: string;
    listado_correctores?: string | null;
  } | null;
}

export function proyectarIntervencion(
  r: FilaIntervencion,
  historialPausas: RangoPausa[],
  ahora: Date,
): IntervencionSeguimiento {
  const recibido = iso(r.recibido),
    iniciado = iso(r.iniciado),
    entregado = iso(r.entregado),
    vence = iso(r.vence);
  const fin = entregado
    ? new Date(entregado)
    : r.estado === 'cancelado'
      ? null
      : ahora;
  const total =
    iniciado && fin && fin.getTime() >= Date.parse(iniciado)
      ? fin.getTime() - Date.parse(iniciado)
      : null;
  const efectivo =
    iniciado && fin && total !== null
      ? calcularDuracionEfectivaMs(
          new Date(iniciado),
          fin,
          historialPausas,
          ahora,
        )
      : null;
  const plazo =
    r.estado === 'cancelado'
      ? null
      : evaluarPlazoCorreccion(vence, r.fecha_entrega, ahora, entregado);
  const estadoSla =
    !vence || r.estado === 'cancelado'
      ? 'sin_sla'
      : plazo === 'vencido'
        ? 'vencido'
        : entregado || r.fecha_entrega
          ? 'en_plazo'
          : hoyCaracas(new Date(vence)) === hoyCaracas(ahora)
            ? 'vence_hoy'
            : plazo === 'proximo_a_vencer'
              ? 'proximo'
              : 'en_plazo';
  const nota = r.nota;
  const horasObjetivo = !vence
    ? null
    : r.origen === 'correccion' &&
        ['tripa_completa', 'preliminares', 'cubierta_extendida'].includes(
          r.material,
        )
      ? (new Date(
          calcularDueAtCorreccion(
            '2000-01-01T00:00:00Z',
            r.material as
              'tripa_completa' | 'preliminares' | 'cubierta_extendida',
          ),
        ).getTime() -
          Date.parse('2000-01-01T00:00:00Z')) /
        3600000
      : recibido
        ? round(
            (new Date(vence).getTime() - new Date(recibido).getTime()) /
              3600000,
          )
        : null;
  const alertas: string[] = [];
  if (r.estado !== 'cancelado' && r.estado !== 'entregado') {
    if (estadoSla === 'vencido') alertas.push('SLA vencido');
    if (estadoSla === 'vence_hoy') alertas.push('Vence hoy');
    if (r.estado === 'bloqueado') alertas.push('Proceso bloqueado');
    if (!r.analista_id && !r.externo)
      alertas.push(
        r.origen === 'calidad'
          ? 'Pendiente en bandeja de Soporte Editorial'
          : 'Sin analista',
      );
  }
  if (r.gate_requerido && !r.gate_confirmado)
    alertas.push('GATE-06: revisión previa pendiente');
  if (r.freelance && !r.contrato_confirmado && r.origen !== 'legacy')
    alertas.push('Contrato sin confirmar');
  if (r.freelance && nota?.pago_80 !== true)
    alertas.push(
      nota?.pago_80 === false
        ? 'Seguimiento 80% pendiente'
        : 'Seguimiento 80% sin registrar',
    );
  if (r.freelance && r.estado === 'entregado' && nota?.pago_20 !== true)
    alertas.push('Seguimiento 20% pendiente');
  if (
    r.estado === 'entregado' &&
    (r.origen === 'correccion'
      ? !r.resultado_operativo
      : r.fase_numero === 1 && !r.resultado_seguimiento)
  )
    alertas.push('Entrega sin evaluación');
  return {
    id: r.id,
    origen: r.origen,
    workItemId: r.work_item_id,
    decisionId: r.decision_id,
    ronda: r.ronda,
    faseNumero: r.fase_numero,
    proyecto: {
      id: r.proyecto_id,
      codigo: r.codigo,
      titulo: r.titulo_definitivo?.trim() || r.titulo?.trim() || null,
      autores: r.autores,
      unidad: r.unidad,
      servicio: `${r.servicio_codigo} · ${nombreServicioProyecto(r.servicio_codigo, r.servicio_nombre, r.subtipo_crudo)}`,
      subtipoCrudo: r.subtipo_crudo,
      estado: r.estado_proyecto,
    },
    especialista: r.especialista_id
      ? {
          id: r.especialista_id,
          nombre: r.especialista_nombre ?? 'Especialista asignado',
        }
      : null,
    analista: r.analista_id
      ? {
          id: r.analista_id,
          nombre: r.analista_nombre ?? 'Responsable registrado',
          tipo: 'usuario',
        }
      : r.externo
        ? {
            id: null,
            nombre: r.externo,
            tipo: r.freelance ? 'freelance' : 'legacy',
          }
        : r.origen === 'calidad'
          ? {
              id: null,
              nombre: 'Bandeja de Soporte Editorial',
              tipo: 'bandeja',
            }
          : null,
    material: Object.hasOwn(MATERIALES_SEGUIMIENTO, r.material)
      ? r.material
      : 'sin_clasificar',
    proceso: Object.hasOwn(PROCESOS_SEGUIMIENTO, r.proceso)
      ? r.proceso
      : 'sin_clasificar',
    estado: r.estado,
    paginas: r.paginas,
    creadoEn: iso(r.created_at)!,
    tiempos: {
      recibido,
      iniciado,
      entregado,
      fechaRecibido: r.fecha_asignada,
      fechaInicio: r.fecha_inicio,
      fechaEntrega: r.fecha_entrega,
      vence,
      horasEfectivas: efectivo === null ? null : round(efectivo / 3600000),
      horasTotales: total === null ? null : round(total / 3600000),
      horasPausadas:
        total === null || efectivo === null
          ? null
          : round((total - efectivo) / 3600000),
      esperaHoras:
        recibido && iniciado && Date.parse(iniciado) >= Date.parse(recibido)
          ? round(
              Math.max(
                0,
                new Date(iniciado).getTime() - new Date(recibido).getTime(),
              ) / 3600000,
            )
          : null,
    },
    sla: {
      estado: estadoSla,
      etiqueta: {
        sin_sla: 'Sin SLA definido',
        vencido: r.estado === 'entregado' ? 'Fuera de plazo' : 'SLA vencido',
        vence_hoy: 'Vence hoy',
        proximo: 'Próximo a vencer',
        en_plazo: 'En plazo',
      }[estadoSla],
      horasObjetivo,
      cumplimiento:
        (entregado || r.fecha_entrega) && plazo
          ? plazo === 'vencido'
            ? 'fuera_plazo'
            : 'en_plazo'
          : null,
    },
    freelance: r.freelance,
    contratoConfirmado: r.contrato_confirmado,
    pago80: r.freelance ? (nota?.pago_80 ?? null) : null,
    pago20: r.freelance ? (nota?.pago_20 ?? null) : null,
    resultadoOperativo: r.resultado_operativo,
    resultadoSeguimiento: r.resultado_seguimiento,
    cantidadComentarios:
      r.origen === 'calidad'
        ? (nota?.comentarios_canonicos ?? null)
        : (nota?.cantidad_comentarios ?? null),
    observacionesF1: nota?.observaciones_fase_1 ?? null,
    observaciones: nota?.observaciones ?? null,
    observacionesOperativas: r.observaciones_operativas,
    listadoCorrectoresLegacy:
      r.origen === 'legacy' ? (nota?.listado_correctores ?? null) : null,
    registroAnterior:
      r.origen === 'legacy'
        ? {
            'Especialista registrado': r.especialista_legacy_nombre,
            ...Object.fromEntries(
              Object.entries({
                Material: 'asignacion_tipo',
                Proceso: 'tipo_servicio',
                Estado: 'estatus',
                'Días reportados': 'total_dias',
                'Horas reportadas': 'total_horas',
                'Tiempo correcto reportado': 'tiempo_correcto',
                'Cumplimiento reportado': 'cumplimiento',
                'Resultado reportado': 'resultados_correccion',
              }).map(([label, key]) => [
                label,
                (nota as Record<string, unknown> | null)?.[key] === null ||
                (nota as Record<string, unknown> | null)?.[key] === undefined
                  ? null
                  : String((nota as Record<string, unknown>)[key]),
              ]),
            ),
          }
        : null,
    gate: { requerido: r.gate_requerido, confirmado: r.gate_confirmado },
    alertas,
    updatedAt: nota?.updated_at ? iso(nota.updated_at) : null,
    permisos: {
      notas: true,
      pagos: r.freelance,
      evaluacion:
        r.estado === 'entregado' &&
        (r.origen === 'legacy' ||
          (r.origen === 'calidad' && r.fase_numero === 1)),
      comentarios: r.estado === 'entregado' && r.origen !== 'calidad',
      paginasLegacy: r.origen === 'legacy',
    },
  };
}

export async function listarIntervenciones(
  f: FiltrosIntervenciones,
  ahora = new Date(),
  identidad?: { origen: OrigenIntervencion; id: string },
): Promise<ListaIntervenciones> {
  const valores: unknown[] = [ahora.toISOString()];
  const bind = (v: unknown) => {
    valores.push(v);
    return `$${valores.length}`;
  };
  const where: string[] = [];
  if (identidad)
    where.push(
      `origen=${bind(identidad.origen)} AND id=${bind(identidad.id)}::uuid`,
    );
  if (f.proyectoId) where.push(`proyecto_id=${bind(f.proyectoId)}::uuid`);
  if (f.q)
    where.push(
      `translate(lower(concat_ws(' ',autores,titulo_definitivo,titulo,codigo,analista_nombre,especialista_nombre,externo)),'áéíóúüñ','aeiouun') LIKE ${bind(`%${normalizar(f.q).replace(/[\\%_]/g, '\\$&')}%`)} ESCAPE '\\'`,
    );
  if (f.proceso) where.push(`proceso=${bind(f.proceso)}`);
  if (f.material) where.push(`material=${bind(f.material)}`);
  if (f.origen) where.push(`origen=${bind(f.origen)}`);
  if (f.analistaId)
    where.push(
      f.analistaId === 'sin_asignar'
        ? `analista_id IS NULL AND externo IS NULL`
        : `analista_id=${bind(f.analistaId)}::uuid`,
    );
  if (f.especialistaId)
    where.push(
      f.especialistaId === 'sin_asignar'
        ? `especialista_id IS NULL`
        : `especialista_id=${bind(f.especialistaId)}::uuid`,
    );
  if (f.freelance) where.push(`freelance=${bind(f.freelance === 'si')}`);
  if (f.resultado)
    where.push(
      f.resultado === 'sin_evaluar'
        ? `coalesce(resultado_seguimiento,resultado_operativo) IS NULL`
        : `coalesce(resultado_seguimiento,resultado_operativo)=${bind(f.resultado)}`,
    );
  const periodo = `coalesce((recibido AT TIME ZONE 'America/Caracas')::date,fecha_asignada,(created_at AT TIME ZONE 'America/Caracas')::date)`;
  if (f.from) where.push(`${periodo}>=${bind(f.from)}::date`);
  if (f.to) where.push(`${periodo}<=${bind(f.to)}::date`);
  const activa = `estado NOT IN ('entregado','cancelado')`;
  const vencida = `vence IS NOT NULL AND vence<$1::timestamptz AND ${activa}`;
  const grupoWhere = {
    todas: 'true',
    pendientes: `estado IN ('pendiente','asignado')`,
    en_progreso: `estado='en_progreso'`,
    vencidas: vencida,
    entregadas: `estado='entregado'`,
  }[f.grupo];
  const orden =
    f.orden === 'recientes'
      ? 'created_at DESC,id'
      : f.orden === 'vencimiento'
        ? 'vence ASC NULLS LAST,id'
        : `(estado='bloqueado') DESC,(${vencida}) DESC,vence ASC NULLS LAST,created_at DESC,id`;
  const size = bind(f.pageSize),
    pagina = bind(f.page);
  const consulta = `${fuentesIntervenciones()}, filtradas AS (SELECT * FROM contexto WHERE ${where.length ? where.join(' AND ') : 'true'}),
 elegidas AS (SELECT * FROM filtradas WHERE ${grupoWhere}),
 meta AS (SELECT count(*)::int total,greatest(1,ceil(count(*)::numeric/${size}))::int pages,least(${pagina}::int,greatest(1,ceil(count(*)::numeric/${size}))::int) page FROM elegidas),
 paginadas AS (SELECT * FROM elegidas ORDER BY ${orden} LIMIT ${size} OFFSET ((SELECT page FROM meta)-1)*${size})
 SELECT coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM paginadas p),'[]') items,
 (SELECT to_jsonb(meta) || jsonb_build_object('pageSize',${size}::int) FROM meta) pagination,
 (SELECT jsonb_build_object('activas',count(*) FILTER(WHERE ${activa}),'porIniciar',count(*) FILTER(WHERE estado IN ('pendiente','asignado')),
 'vencidas',count(*) FILTER(WHERE ${vencida}),'entregadasHoy',count(*) FILTER(WHERE coalesce((entregado AT TIME ZONE 'America/Caracas')::date,fecha_entrega)=($1::timestamptz AT TIME ZONE 'America/Caracas')::date),
 'freelancePendientes',count(*) FILTER(WHERE freelance AND estado!='cancelado' AND (coalesce((nota->>'pago_80')::boolean,false)=false OR (estado='entregado' AND coalesce((nota->>'pago_20')::boolean,false)=false)))) FROM filtradas) counts,
 (SELECT jsonb_build_object('todas',count(*),'pendientes',count(*) FILTER(WHERE estado IN ('pendiente','asignado')),'en_progreso',count(*) FILTER(WHERE estado='en_progreso'),'vencidas',count(*) FILTER(WHERE ${vencida}),'entregadas',count(*) FILTER(WHERE estado='entregado')) FROM filtradas) grupos,
 (SELECT jsonb_build_object('especialistas',coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',especialista_id,'nombre',especialista_nombre)) FILTER(WHERE especialista_id IS NOT NULL),'[]'),
 'analistas',coalesce(jsonb_agg(DISTINCT jsonb_build_object('id',analista_id,'nombre',analista_nombre)) FILTER(WHERE analista_id IS NOT NULL),'[]')) FROM contexto) filters`;
  const {
    rows: [data],
  } = await pool.query<{
    items: FilaIntervencion[];
    pagination: ListaIntervenciones['pagination'];
    counts: ListaIntervenciones['counts'];
    grupos: ListaIntervenciones['grupos'];
    filters: ListaIntervenciones['filters'];
  }>(consulta, valores);
  const ids = [...new Set(data!.items.map((r) => r.proyecto_id))];
  const rangos = ids.length
    ? await db.select().from(pausas).where(inArray(pausas.proyectoId, ids))
    : [];
  return {
    ...data!,
    items: data!.items.map((r) =>
      proyectarIntervencion(
        r,
        rangos.filter((p) => p.proyectoId === r.proyecto_id),
        ahora,
      ),
    ),
  };
}
const defaults: FiltrosIntervenciones = {
  q: '',
  grupo: 'todas',
  orden: 'urgentes',
  page: 1,
  pageSize: 10,
};
/** Batch projection shared by analytics; retains the same timing and SLA rules. */
export async function obtenerIntervencionesIndicadores(proyectoIds: string[], ahora: Date) {
  if (!proyectoIds.length) return [];
  const [{ rows }, rangos] = await Promise.all([
    pool.query<FilaIntervencion>(`${fuentesIntervenciones(true)} SELECT contexto.*, fecha_asignada::text fecha_asignada, fecha_inicio::text fecha_inicio, fecha_entrega::text fecha_entrega FROM contexto WHERE proyecto_id=ANY($1::uuid[]) AND origen IN ('correccion','calidad')`, [proyectoIds]),
    db.select().from(pausas).where(inArray(pausas.proyectoId, proyectoIds)),
  ]);
  const porProyecto = new Map<string, typeof rangos>();
  for (const rango of rangos) { const list = porProyecto.get(rango.proyectoId) ?? []; list.push(rango); porProyecto.set(rango.proyectoId, list); }
  return rows.map(r => proyectarIntervencion(r, porProyecto.get(r.proyecto_id) ?? [], ahora));
}
export async function obtenerIntervencion(
  origen: OrigenIntervencion,
  id: string,
) {
  return (
    (await listarIntervenciones(defaults, new Date(), { origen, id }))
      .items[0] ?? null
  );
}

export async function guardarSupervision(
  origen: OrigenIntervencion,
  id: string,
  datos: CambiosSupervision,
  actorId: string,
) {
  const actual = await obtenerIntervencion(origen, id);
  exigir(actual, 'Intervención no disponible en el ámbito de Jefatura', 404);
  await db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, actual!.proyecto.id))
      .for('update');
    const [asignacion] = await tx
      .select()
      .from(projectAssignments)
      .where(
        and(
          eq(projectAssignments.proyectoId, p!.id),
          eq(projectAssignments.tipo, 'especialista'),
          isNull(projectAssignments.workItemId),
          isNull(projectAssignments.finalizadoEn),
        ),
      );
    exigir(
      p &&
        [
          'en_proceso',
          'retrasado',
          'pausado',
          'stand_by',
          'culminado',
        ].includes(p.estado) &&
        (p.notificadoJefatura || asignacion?.usuarioId || p.especialistaId),
      'Proyecto fuera de ámbito',
      404,
    );
    const [c] =
      origen === 'correccion'
        ? await tx
            .select()
            .from(correcciones)
            .where(eq(correcciones.id, id))
            .for('update')
        : [];
    const [q] =
      origen === 'calidad'
        ? await tx
            .select()
            .from(fichaCalidadFases)
            .where(eq(fichaCalidadFases.id, id))
            .for('update')
        : [];
    const filtro =
      origen === 'correccion'
        ? eq(seguimientoFases.correccionId, id)
        : origen === 'calidad'
          ? eq(seguimientoFases.calidadFaseId, id)
          : eq(seguimientoFases.id, id);
    const [anterior] = await tx
      .select()
      .from(seguimientoFases)
      .where(filtro)
      .for('update');
    exigir(
      (anterior?.updatedAt.toISOString() ?? null) === datos.expectedUpdatedAt,
      'Otra persona actualizó este seguimiento. Recarga antes de guardar.',
      409,
    );
    if ('pago80' in datos || 'pago20' in datos)
      exigir(
        c?.freelance || (origen === 'legacy' && anterior?.freelance),
        'Solo se registra seguimiento financiero de una intervención freelance',
      );
    if ('resultadoSeguimiento' in datos || 'observacionesF1' in datos)
      exigir(
        actual!.permisos.evaluacion &&
          (origen === 'legacy'
            ? actual!.estado === 'entregado'
            : q?.numeroFase === 1 && (q.revisadoEn || q.aprobado !== null)),
        'La evaluación de seguimiento requiere F1 revisada; el cierre de Corrección pertenece al Especialista',
        409,
      );
    if ('cantidadComentarios' in datos)
      exigir(
        actual!.permisos.comentarios &&
          (origen === 'legacy'
            ? actual!.estado === 'entregado'
            : c?.fechaEntrega),
        'Comentarios de Calidad pertenecen a Soporte Editorial o la intervención aún no fue entregada',
      );
    if ('observacionesF1' in datos)
      exigir(
        q?.numeroFase === 1 ||
          (origen === 'legacy' && actual!.proceso === 'fase_calidad_1'),
        'Las observaciones F1 corresponden a una intervención de Fase de Calidad 1',
      );
    if ('paginas' in datos)
      exigir(
        origen === 'legacy',
        'Las páginas operativas pertenecen al workflow',
      );
    const cambios = {
      ...('observaciones' in datos
        ? { observaciones: datos.observaciones }
        : {}),
      ...('resultadoSeguimiento' in datos
        ? { resultadosCorreccion: datos.resultadoSeguimiento }
        : {}),
      ...('observacionesF1' in datos
        ? { observacionesFase1: datos.observacionesF1 }
        : {}),
      ...('cantidadComentarios' in datos
        ? { cantidadComentarios: datos.cantidadComentarios }
        : {}),
      ...('pago80' in datos ? { pago80: datos.pago80 } : {}),
      ...('pago20' in datos ? { pago20: datos.pago20 } : {}),
      ...('paginas' in datos ? { paginas: datos.paginas } : {}),
    };
    if (!Object.keys(cambios).length) return;
    if (
      anterior &&
      Object.entries(cambios).every(
        ([k, v]) => anterior[k as keyof typeof anterior] === v,
      )
    )
      return;
    const [nota] = anterior
      ? await tx
          .update(seguimientoFases)
          .set(cambios)
          .where(eq(seguimientoFases.id, anterior.id))
          .returning()
      : await tx
          .insert(seguimientoFases)
          .values({
            proyectoId: p!.id,
            correccionId: c?.id,
            calidadFaseId: q?.id,
            ...cambios,
          })
          .returning();
    exigir(nota, 'No se guardó la supervisión', 500);
    const antes = Object.fromEntries(
      Object.keys(cambios).map((k) => [
        k,
        anterior?.[k as keyof typeof anterior] ?? null,
      ]),
    );
    for (const [claves, accion] of [
      [['observaciones'], 'SEGUIMIENTO_NOTA_REGISTRADA'],
      [
        ['resultadosCorreccion', 'observacionesFase1'],
        'SEGUIMIENTO_EVALUACION_REGISTRADA',
      ],
      [['pago80', 'pago20'], 'SEGUIMIENTO_PAGO_REGISTRADO'],
      [['cantidadComentarios', 'paginas'], 'SEGUIMIENTO_DATOS_REGISTRADOS'],
    ] as const)
      if (claves.some((k) => k in cambios))
        await registrarEvento(tx, {
          actorId,
          accion,
          entityType: 'work_item',
          entityId: actual!.workItemId ?? id,
          proyectoId: p!.id,
          detalles: {
            origen,
            intervencionId: id,
            seguimientoId: nota!.id,
            antes,
            despues: cambios,
          },
        });
  });
  return obtenerIntervencion(origen, id);
}

export async function actividadIntervencion(
  origen: OrigenIntervencion,
  id: string,
) {
  const actual = await obtenerIntervencion(origen, id);
  if (!actual) return null;
  const { rows } = await pool.query<{
    id: string;
    fecha: Date;
    accion: string;
    actor: string;
    detalles: Record<string, unknown> | null;
  }>(
    `SELECT a.id,a.created_at fecha,a.accion,coalesce(u.nombre,'Sistema') actor,a.detalles FROM audit_logs a LEFT JOIN usuarios u ON u.id=a.actor_id
     WHERE a.proyecto_id=$1 AND (a.entity_id=$2 OR a.entity_id=$3 OR a.detalles->>'intervencionId'=$2::text OR a.detalles->>'faseId'=$2::text)
     ORDER BY a.created_at DESC,a.id DESC LIMIT 40`,
    [actual.proyecto.id, id, actual.workItemId ?? id],
  );
  const nombresIds = rows
    .flatMap((r) =>
      ['correctorId', 'anteriorCorrectorId'].map((k) => r.detalles?.[k]),
    )
    .filter(
      (v): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v),
    );
  const personas = nombresIds.length
    ? await db
        .select({ id: users.id, nombre: users.nombre })
        .from(users)
        .where(inArray(users.id, nombresIds))
    : [];
  const labels: Record<string, string> = {
    CORRECCION_SOLICITADA: 'solicitó la intervención',
    CORRECTOR_ASIGNADO: 'asignó al Corrector',
    CORRECTOR_REASIGNADO: 'reasignó la intervención',
    CORRECCION_INICIADA: 'inició la Corrección',
    CORRECCION_ENTREGADA: 'entregó la Corrección',
    CORRECCION_CERRADA: 'registró el resultado operativo de Corrección',
    CALIDAD_INICIADA: 'inició la revisión',
    CALIDAD_REVISADA: 'registró la revisión de Calidad',
    SEGUIMIENTO_NOTA_REGISTRADA: 'registró una nota de seguimiento',
    SEGUIMIENTO_EVALUACION_REGISTRADA: 'registró una evaluación de seguimiento',
    SEGUIMIENTO_PAGO_REGISTRADO: 'actualizó seguimiento de pago freelance',
    SEGUIMIENTO_DATOS_REGISTRADOS: 'actualizó datos de seguimiento',
  };
  return rows.map((r) => {
    const d = r.detalles;
    let texto = labels[r.accion] ?? 'registró un avance de la intervención';
    if (/CORRECTOR_(RE)?ASIGNADO/.test(r.accion)) {
      const nuevo =
        personas.find((p) => p.id === d?.correctorId)?.nombre ??
        d?.correctorNombre;
      const previo =
        personas.find((p) => p.id === d?.anteriorCorrectorId)?.nombre ??
        d?.anteriorCorrectorNombre;
      if (nuevo)
        texto = previo
          ? `reasignó la intervención de ${previo} a ${nuevo}`
          : `asignó la intervención a ${nuevo}`;
    }
    const despues = d?.despues as Record<string, unknown> | undefined;
    if (
      r.accion === 'SEGUIMIENTO_EVALUACION_REGISTRADA' &&
      typeof despues?.resultadosCorreccion === 'string'
    )
      texto += `: ${RESULTADOS_SEGUIMIENTO[despues.resultadosCorreccion as ResultadoSeguimiento] ?? 'Sin evaluación'}`;
    if (r.accion === 'CORRECCION_CERRADA' && typeof d?.resultado === 'string')
      texto += `: ${RESULTADOS_SEGUIMIENTO[d.resultado as ResultadoSeguimiento] ?? d.resultado}`;
    return {
      id: r.id,
      proyectoId: actual.proyecto.id,
      codigo: actual.proyecto.codigo,
      actor: r.actor,
      texto,
      fecha: iso(r.fecha)!,
      nota:
        typeof despues?.observaciones === 'string'
          ? despues.observaciones
          : null,
    };
  });
}
