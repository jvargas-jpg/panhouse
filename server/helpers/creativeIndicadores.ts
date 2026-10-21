import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import type { IndicadoresCreativos, MesCreativo } from '../../shared/creativeIndicadores.js';
import { ventanaRrpp } from './rrppIndicadores.js';
import { hoyLanzamientoRrpp } from './rrppLanzamientos.js';
import { creativeSourceSql } from './creativeInbox.js';
import { getCreativeActivity } from './creativeLeader.js';
import type { Tx } from './tx.js';

const DIA = 86400000;
// Mismas reglas de rango que RRPP (ver rrppIndicadores.ts), con un filtro de servicio propio.
export const periodoCreativoSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  servicio: z.string().uuid().optional(),
}).strict().superRefine((v, c) => {
  if (!!v.from !== !!v.to) c.addIssue({ code: 'custom', message: 'Indica ambas fechas' });
  if (v.from && v.to && (v.from > v.to || (Date.parse(v.to) - Date.parse(v.from)) / DIA > 731))
    c.addIssue({ code: 'custom', message: 'El rango debe estar ordenado y abarcar como máximo 732 días' });
});

// Un "hito" formal = DIRECCION_CREATIVA_CERRADA disparado por el cierre automático de recursos
// (ver registrarRecursosCreativos en direccionCreativa.ts), no un cierre manual/rechazo cualquiera.
const RAZON_RECURSOS_COMPLETOS = 'Recursos completos del concepto aprobado';

function grupos(consulta: SQL): SQL {
  return sql`(select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'cantidad', cantidad, 'porcentaje', porcentaje) order by cantidad desc, nombre), '[]'::jsonb)
    from (select r.*, (floor(exacto) + case when row_number() over (order by exacto - floor(exacto) desc, nombre) <= 1000 - sum(floor(exacto)) over () then 1 else 0 end) / 10.0 porcentaje
      from (select d.*, cantidad * 1000.0 / nullif(sum(cantidad) over (), 0) exacto from (${consulta}) d) r) g)`;
}

export async function obtenerIndicadoresCreativos(
  userId: string,
  input: { from?: string; to?: string; servicio?: string } = {},
  hoy = hoyLanzamientoRrpp(),
): Promise<IndicadoresCreativos> {
  const v = ventanaRrpp(input, hoy);
  const servicioFiltro = input.servicio ? sql`and service_id = ${input.servicio}` : sql``;

  const [{ raw, monthly, previousMonthly }, activity] = await Promise.all([
    db.transaction(async tx => {
      const result = await tx.execute(sql`
        ${creativeSourceSql(userId)},
        dc as materialized (select * from classified where true ${servicioFiltro}),
        project_state as materialized (
          select distinct on (project_id) project_id, service_id, service_name, status, phase, task_group
          from dc order by project_id, (status = 'Completada') asc, changed_at desc
        ),
        concepts_last as materialized (
          select direccion_creativa_id, max(created_at) as ultimo_concepto
          from ficha_diseno_propuestas where direccion_creativa_id in (select id from dc) group by direccion_creativa_id
        ),
        resources as materialized (
          select dc.id, dc.fecha_cierre, approved.fecha_aprobada_autor as inicio
          from dc left join lateral (
            select p.fecha_aprobada_autor from ficha_diseno_propuestas p
            where p.direccion_creativa_id = dc.id and p.fecha_aprobada_autor is not null
            order by p.fecha_aprobada_autor limit 1
          ) approved on true
          where dc.tipo = 'concepto_portada' and dc.fecha_cierre is not null and dc.resultado_final = 'aprobado'
        ),
        covers as materialized (
          select dc.id, min(v.entregado_en) as entregado_en, max(a.created_at) as verificado_en
          from dc join diseno_versiones v on v.revision_creativa_id = dc.id join disenos d on d.id = v.diseno_id
          join audit_logs a on a.entity_id = d.work_item_id and a.accion = 'CUBIERTA_REVISION_CREATIVA'
          where dc.tipo = 'revision_cubierta' group by dc.id
        ),
        milestones as materialized (
          select a.id, a.created_at, 'Brief finalizado' as hito, dc.project_id, dc.code, dc.title, dc.authors, dc.service_name
          from audit_logs a join dc on dc.work_item_id = a.entity_id where a.accion = 'BRIEF_CREATIVO_GENERADO'
          union all
          select a.id, a.created_at, 'Concepto aprobado por el autor', dc.project_id, dc.code, dc.title, dc.authors, dc.service_name
          from audit_logs a join dc on dc.work_item_id = a.entity_id where a.accion = 'CONCEPTO_APROBADO_AUTOR'
          union all
          select a.id, a.created_at, 'Recursos entregados', dc.project_id, dc.code, dc.title, dc.authors, dc.service_name
          from audit_logs a join dc on dc.work_item_id = a.entity_id
          where a.accion = 'DIRECCION_CREATIVA_CERRADA' and a.detalles ->> 'reason' = ${RAZON_RECURSOS_COMPLETOS}
          union all
          select a.id, a.created_at, 'Cubierta verificada', dc.project_id, dc.code, dc.title, dc.authors, dc.service_name
          from audit_logs a join disenos d on d.work_item_id = a.entity_id join dc on dc.id = d.direccion_creativa_id
          where a.accion = 'CUBIERTA_REVISION_CREATIVA'
        )
        select jsonb_build_object(
          'summary', jsonb_build_object(
            'briefsElaborados', (select count(*) from dc where fecha_brief_enviado_especialista between ${v.from}::date and ${v.to}::date),
            'conceptosCreados', (select count(*) from ficha_diseno_propuestas c join dc on dc.id = c.direccion_creativa_id where c.created_at >= ${v.desde} and c.created_at < ${v.hasta}),
            'recursosEntregados', (select count(*) from resources where fecha_cierre between ${v.from}::date and ${v.to}::date),
            'cubiertasVerificadas', (select count(*) from covers where verificado_en >= ${v.desde} and verificado_en < ${v.hasta})
          ),
          'previous', jsonb_build_object(
            'briefs', (select count(*) from dc where fecha_brief_enviado_especialista between ${v.anteriorFrom}::date and ${v.anteriorTo}::date),
            'conceptos', (select count(*) from ficha_diseno_propuestas c join dc on dc.id = c.direccion_creativa_id where c.created_at >= ${v.anteriorDesde} and c.created_at < ${v.desde}),
            'recursos', (select count(*) from resources where fecha_cierre between ${v.anteriorFrom}::date and ${v.anteriorTo}::date),
            'cubiertas', (select count(*) from covers where verificado_en >= ${v.anteriorDesde} and verificado_en < ${v.desde})
          ),
          'stateDistribution', ${grupos(sql`select case when status = 'Completada' then 'Completado' when phase = 'BLOCKED' then 'Bloqueada'
            else case task_group when 'BRIEF' then 'Brief / reunión' when 'CONCEPT' then 'Conceptos' when 'RESOURCES' then 'Recursos' when 'COVER_REVIEW' then 'Cubierta' end end nombre,
            count(*) cantidad from project_state group by 1`)},
          'byService', ${grupos(sql`select service_name nombre, count(*) cantidad from project_state group by 1`)},
          'cycleTimes', jsonb_build_array(
            jsonb_build_object('id', 'brief', 'etiqueta', 'Brief',
              'promedioDias', (select round(avg(extract(epoch from (fecha_brief_enviado_especialista::timestamptz - work_created_at)) / 86400)::numeric, 1) from dc
                where fecha_brief_enviado_especialista between ${v.from}::date and ${v.to}::date and fecha_brief_enviado_especialista::timestamptz >= work_created_at),
              'muestras', (select count(*) from dc where fecha_brief_enviado_especialista between ${v.from}::date and ${v.to}::date and fecha_brief_enviado_especialista::timestamptz >= work_created_at)),
            jsonb_build_object('id', 'conceptos', 'etiqueta', 'Conceptos',
              'promedioDias', (select round(avg(extract(epoch from (cl.ultimo_concepto - dc.fecha_brief_aprobado_autor::timestamptz)) / 86400)::numeric, 1) from dc join concepts_last cl on cl.direccion_creativa_id = dc.id
                where dc.fecha_brief_aprobado_autor is not null and cl.ultimo_concepto >= dc.fecha_brief_aprobado_autor::timestamptz and cl.ultimo_concepto::date between ${v.from}::date and ${v.to}::date),
              'muestras', (select count(*) from dc join concepts_last cl on cl.direccion_creativa_id = dc.id
                where dc.fecha_brief_aprobado_autor is not null and cl.ultimo_concepto >= dc.fecha_brief_aprobado_autor::timestamptz and cl.ultimo_concepto::date between ${v.from}::date and ${v.to}::date)),
            jsonb_build_object('id', 'recursos', 'etiqueta', 'Recursos',
              'promedioDias', (select round(avg(extract(epoch from (fecha_cierre::timestamp - inicio::timestamp)) / 86400)::numeric, 1) from resources
                where inicio is not null and fecha_cierre >= inicio and fecha_cierre between ${v.from}::date and ${v.to}::date),
              'muestras', (select count(*) from resources where inicio is not null and fecha_cierre >= inicio and fecha_cierre between ${v.from}::date and ${v.to}::date)),
            jsonb_build_object('id', 'cubierta', 'etiqueta', 'Cubierta',
              'promedioDias', (select round(avg(extract(epoch from (verificado_en - entregado_en)) / 86400)::numeric, 1) from covers
                where verificado_en >= entregado_en and verificado_en >= ${v.desde} and verificado_en < ${v.hasta}),
              'muestras', (select count(*) from covers where verificado_en >= entregado_en and verificado_en >= ${v.desde} and verificado_en < ${v.hasta}))
          ),
          'workload', jsonb_build_object(
            'activas', (select count(*) from dc where actionable),
            'enEsperaTerceros', (select count(*) from dc where phase in ('WAIT_RRPP', 'WAIT_AUTHOR', 'WAIT_DESIGN', 'WAIT_SPECIALIST')),
            'completadasPeriodo', (select count(*) from dc where fecha_cierre between ${v.from}::date and ${v.to}::date)
          ),
          'milestones', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'proyectoId', project_id, 'codigo', code,
            'titulo', coalesce(nullif(title, ''), 'Proyecto #' || code), 'autores', authors,
            'servicio', service_name, 'hito', hito, 'fecha', created_at) order by created_at desc, id), '[]'::jsonb)
            from (select * from milestones where created_at >= ${v.desde} and created_at < ${v.hasta} order by created_at desc, id limit 5) t),
          'filters', jsonb_build_object('services', coalesce((select jsonb_agg(jsonb_build_object('id', service_id, 'label', service_name) order by 2)
            from (select distinct service_id, service_name from classified) s), '[]'::jsonb))
        ) data
      `);
      const raw = result.rows[0]?.data as Omit<IndicadoresCreativos, 'periodo' | 'monthly' | 'previousMonthly' | 'activity'> & {
        previous: { briefs: number; conceptos: number; recursos: number; cubiertas: number };
      };
      // Series separadas con sus propias fronteras: un mes puede contener el corte entre
      // períodos (mismo criterio que RRPP, ver serieRrpp en rrppIndicadores.ts).
      const monthly = await serieCreativa(tx, userId, v.from, v.to, input.servicio);
      const previousMonthly = await serieCreativa(tx, userId, v.anteriorFrom, v.anteriorTo, input.servicio);
      return { raw, monthly, previousMonthly };
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' }),
    getCreativeActivity(userId),
  ]);

  const cambio = (actual: number, anterior: number) => (anterior === 0 ? null : Math.round(((actual - anterior) / anterior) * 1000) / 10);
  const { previous, ...data } = raw;
  return {
    ...data,
    periodo: { from: v.from, to: v.to, anteriorFrom: v.anteriorFrom, anteriorTo: v.anteriorTo, dias: v.dias, zonaHoraria: v.zonaHoraria, hoy: v.hoy },
    monthly,
    previousMonthly,
    activity,
    summary: {
      ...data.summary,
      comparacionBriefs: cambio(data.summary.briefsElaborados, previous.briefs),
      comparacionConceptos: cambio(data.summary.conceptosCreados, previous.conceptos),
      comparacionRecursos: cambio(data.summary.recursosEntregados, previous.recursos),
      comparacionCubiertas: cambio(data.summary.cubiertasVerificadas, previous.cubiertas),
    },
  };
}

async function serieCreativa(tx: Tx, userId: string, from: string, to: string, servicio?: string): Promise<MesCreativo[]> {
  const v = ventanaRrpp({ from, to });
  const servicioFiltro = servicio ? sql`and service_id = ${servicio}` : sql``;
  const r = await tx.execute(sql`
    ${creativeSourceSql(userId)},
    dc as materialized (select * from classified where true ${servicioFiltro}),
    hechos as (
      select to_char(fecha_brief_enviado_especialista, 'YYYY-MM') clave, 'briefs' tipo from dc where fecha_brief_enviado_especialista between ${from}::date and ${to}::date
      union all select to_char(c.created_at at time zone 'America/Caracas', 'YYYY-MM'), 'conceptos' from ficha_diseno_propuestas c join dc on dc.id = c.direccion_creativa_id where c.created_at >= ${v.desde} and c.created_at < ${v.hasta}
      union all select to_char(dc.fecha_cierre, 'YYYY-MM'), 'recursos' from dc where dc.tipo = 'concepto_portada' and dc.resultado_final = 'aprobado' and dc.fecha_cierre between ${from}::date and ${to}::date
      union all select to_char(a.created_at at time zone 'America/Caracas', 'YYYY-MM'), 'cubiertas' from audit_logs a join disenos d on d.work_item_id = a.entity_id join dc on dc.id = d.direccion_creativa_id
        where a.accion = 'CUBIERTA_REVISION_CREATIVA' and a.created_at >= ${v.desde} and a.created_at < ${v.hasta}
    )
    select to_char(m, 'YYYY-MM') clave,
      count(*) filter (where h.tipo = 'briefs')::int briefs,
      count(*) filter (where h.tipo = 'conceptos')::int conceptos,
      count(*) filter (where h.tipo = 'recursos')::int recursos,
      count(*) filter (where h.tipo = 'cubiertas')::int cubiertas
    from generate_series(date_trunc('month', ${from}::date), date_trunc('month', ${to}::date), interval '1 month') m
    left join hechos h on h.clave = to_char(m, 'YYYY-MM') group by m order by m
  `);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return r.rows.map(row => ({ ...(row as Omit<MesCreativo, 'mes'>), mes: `${meses[Number(String(row.clave).slice(5)) - 1]} ${String(row.clave).slice(2, 4)}` }));
}

const celdaCsv = (value: string | number | null) => {
  const text = String(value ?? '');
  return `"${(/^[\s]*[=+\-@]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
};
export function csvIndicadoresCreativos(data: IndicadoresCreativos) {
  const rows: (string | number | null)[][] = [
    ['Mes', 'Briefs elaborados', 'Conceptos creados', 'Recursos entregados', 'Cubiertas verificadas'],
    ...data.monthly.map(m => [m.mes, m.briefs, m.conceptos, m.recursos, m.cubiertas]),
    [],
    ['Resumen del período', data.periodo.from, data.periodo.to],
    ['Briefs elaborados', data.summary.briefsElaborados],
    ['Conceptos creados', data.summary.conceptosCreados],
    ['Recursos entregados', data.summary.recursosEntregados],
    ['Cubiertas verificadas', data.summary.cubiertasVerificadas],
    [],
    ['Estado actual de proyectos creativos'],
    ...data.stateDistribution.map(d => [d.nombre, d.cantidad, d.porcentaje]),
    [],
    ['Proyectos por servicio'],
    ...data.byService.map(d => [d.nombre, d.cantidad, d.porcentaje]),
    [],
    ['Tiempo promedio por fase (días)'],
    ...data.cycleTimes.map(c => [c.etiqueta, c.promedioDias, c.muestras]),
  ];
  return '﻿' + rows.map(row => row.map(celdaCsv).join(',')).join('\r\n') + '\r\n';
}
