import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import type { Tx } from './tx.js';
import type { IndicadoresRrpp, MesRrpp } from '../../shared/rrppIndicadores.js';
import { hoyLanzamientoRrpp, fechaRrpp } from './rrppLanzamientos.js';
import { VENTA_CRUZADA_RRPP } from './rrppLanzamientoCatalogos.js';

const DIA = 86400000;
export const periodoRrppSchema = z.object({ from: fechaRrpp.optional(), to: fechaRrpp.optional() }).strict()
  .superRefine((v, c) => {
    if (!!v.from !== !!v.to) c.addIssue({ code: 'custom', message: 'Indica ambas fechas' });
    if (v.from && v.to && (v.from > v.to || (Date.parse(v.to) - Date.parse(v.from)) / DIA > 731))
      c.addIssue({ code: 'custom', message: 'El rango debe estar ordenado y abarcar como máximo 732 días' });
  });

export function ventanaRrpp(input: { from?: string; to?: string }, hoy = hoyLanzamientoRrpp()) {
  const from = input.from ?? `${hoy.slice(0, 4)}-01-01`;
  const to = input.to ?? hoy;
  const dia = (fecha: string, delta: number) => new Date(Date.parse(`${fecha}T00:00:00Z`) + delta * DIA).toISOString().slice(0, 10);
  const dias = (Date.parse(to) - Date.parse(from)) / DIA + 1;
  const desde = inicioDiaCaracas(from);
  const hasta = inicioDiaCaracas(dia(to, 1));
  const anteriorFrom = dia(from, -dias);
  const anteriorTo = dia(from, -1);
  const anteriorDesde = inicioDiaCaracas(anteriorFrom);
  return { from, to, dias, desde, hasta, anteriorDesde, anteriorHasta: desde,
    anteriorFrom, anteriorTo, zonaHoraria: 'America/Caracas', hoy };
}
function inicioDiaCaracas(fecha: string) {
  const utc = new Date(`${fecha}T00:00:00Z`);
  const zona = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', timeZoneName: 'longOffset' }).formatToParts(utc).find(p => p.type === 'timeZoneName')?.value;
  const offset = zona?.match(/^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!offset) throw new Error('No se pudo resolver el huso horario de Caracas');
  const segundos = (Number(offset[2]) * 3600 + Number(offset[3]) * 60 + Number(offset[4] ?? 0)) * (offset[1] === '+' ? 1 : -1);
  return new Date(utc.getTime() - segundos * 1000);
}

// Equivalencias explícitas; nunca descartar una categoría desconocida.
const equivalencias: Record<string, Record<string, string>> = {
  fase: { 'en asesoriamiento': 'En asesoramiento', 'en asesoramiento': 'En asesoramiento', 'esperando fecha': 'Esperando fecha', 'en espera de lanzamiento': 'En espera de lanzamiento', culminado: 'Culminado' },
  satisfaccion: { excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular' },
  eventoEstado: { 'no iniciada': 'No iniciada', 'en curso': 'En curso', bloqueada: 'Bloqueada', completada: 'Completada' },
  publicacionEstado: { nuevo: 'Nuevo', 'en curso': 'En curso', 'en revisión': 'En revisión', publicado: 'Publicado', suspendido: 'Suspendido', 'en pausa': 'En pausa' },
  publicacionTipo: { 'futuro autor': 'Futuro Autor', novedades: 'Novedades' },
  oportunidad: Object.fromEntries(VENTA_CRUZADA_RRPP.map(v => [v.toLowerCase(), v])),
};
export function normalizarCategoriaRrpp(valor: string | null, dominio: keyof typeof equivalencias): string {
  const limpio = valor?.trim().replace(/\s+/g, ' ');
  if (!limpio || /^#(REF!|N\/A|VALUE!)$/i.test(limpio)) return 'Sin clasificar';
  return equivalencias[dominio]?.[limpio.toLowerCase()] ?? limpio;
}
function categoria(col: SQL, dominio: keyof typeof equivalencias): SQL {
  const limpio = sql`regexp_replace(btrim(${col}), '[[:space:]]+', ' ', 'g')`;
  const casos = Object.entries(equivalencias[dominio] ?? {}).map(([a, b]) => sql`when ${a} then ${b}`);
  return sql`case when ${limpio} is null or ${limpio} = '' or upper(${limpio}) in ('#REF!', '#N/A', '#VALUE!') then 'Sin clasificar' else case lower(${limpio}) ${sql.join(casos, sql` `)} else ${limpio} end end`;
}
// La función ventana dentro de jsonb_agg requiere una subconsulta separada.
function grupos(consulta: SQL): SQL {
  return sql`(select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'cantidad', cantidad, 'porcentaje', porcentaje) order by cantidad desc, nombre), '[]'::jsonb)
    from (select r.*, (floor(exacto) + case when row_number() over (order by exacto - floor(exacto) desc, nombre) <= 1000 - sum(floor(exacto)) over () then 1 else 0 end) / 10.0 porcentaje
      from (select d.*, cantidad * 1000.0 / nullif(sum(cantidad) over (), 0) exacto from (${consulta}) d) r) g)`;
}
const lanzamientos = sql`('lanzamiento', 'lanzamiento digital', 'lanzamiento en amazon', 'lanzamiento en feria')`;
const fila = sql`jsonb_build_object('id', x.id, 'proyectoId', p.id, 'codigo', p.codigo,
  'nombre', coalesce(n.nombre, a.nombre), 'titulo', coalesce(p.titulo_definitivo, p.titulo),
  'fecha', x.fecha, 'tipo', x.tipo, 'estado', x.estado, 'lugar', x.lugar, 'responsable', u.nombre)`;

export async function obtenerIndicadoresRrpp(input: { from?: string; to?: string } = {}, hoy = hoyLanzamientoRrpp()): Promise<IndicadoresRrpp> {
  const v = ventanaRrpp(input, hoy);
  // Tres consultas agregadas y acotadas, un snapshot coherente, sin N+1.
  return db.transaction(async tx => {
  const result = await tx.execute(sql`
    with planes as materialized (
      select w.proyecto_id, w.created_at, w.estado trabajo, f.id,
        f.asesoria_fecha_pautada_autor, f.lanzamiento_promocion_fecha_tentativa,
        f.asesoria_feria_proyectada, f.asesoria_feria_a_participar, f.asesoria_venta_cruzada,
        f.lanzamiento_promocion_tipo, f.lanzamiento_promocion_fecha_primera_reunion,
        f.lanzamiento_promocion_primera_realizada, f.lanzamiento_promocion_fecha_segunda_reunion,
        f.lanzamiento_promocion_segunda_realizada,
        ${categoria(sql`f.asesoria_fase::text`, 'fase')} fase,
        ${categoria(sql`f.asesoria_nivel_satisfaccion::text`, 'satisfaccion')} satisfaccion
      from work_items w left join fichas_trazabilidad f on f.proyecto_id = w.proyecto_id
      where w.tipo = 'lanzamiento' and w.business_key = 'planificacion'
    ), cohorte as materialized (select * from planes where created_at >= ${v.desde} and created_at < ${v.hasta}),
    eventos as materialized (
      select e.*, ${categoria(sql`e.estado`, 'eventoEstado')} estado_normal,
        regexp_replace(lower(btrim(e.tipo)), '[[:space:]]+', ' ', 'g') tipo_normal
      from rrpp_eventos e
    ), publicadas as materialized (
      select entity_id, min(created_at) fecha from audit_logs
      where accion = 'PUBLICACION_RRPP_REALIZADA' and entity_type = 'publicacion_rrpp' group by entity_id
    ), piezas as materialized (
      select p.*, a.fecha publicada_en, ${categoria(sql`p.estado`, 'publicacionEstado')} estado_normal,
        ${categoria(sql`p.tipo`, 'publicacionTipo')} tipo_normal
      from rrpp_publicaciones p left join publicadas a on a.entity_id = p.id
    ), oportunidades as materialized (
      select distinct c.proyecto_id, ${categoria(sql`interes`, 'oportunidad')} nombre
      from cohorte c cross join lateral unnest(c.asesoria_venta_cruzada) interes
      where nullif(btrim(interes), '') is not null
    ), reuniones as materialized (
      select proyecto_id, lanzamiento_promocion_fecha_primera_reunion fecha, lanzamiento_promocion_primera_realizada realizada, 'Primera' tipo from planes where lanzamiento_promocion_fecha_primera_reunion is not null
      union all select proyecto_id, lanzamiento_promocion_fecha_segunda_reunion, lanzamiento_promocion_segunda_realizada, 'Segunda' from planes where lanzamiento_promocion_fecha_segunda_reunion is not null
      union all select p.proyecto_id, r.fecha, r.realizada, 'Adicional' from planes p join ficha_lanzamiento_reuniones r on r.ficha_id = p.id where r.fecha is not null
    ), nombres as materialized (
      select pa.proyecto_id, string_agg(a.nombre, ', ' order by a.nombre) nombre from proyectos_autores pa join autores a on a.id = pa.autor_id group by pa.proyecto_id
    )
    select jsonb_build_object(
      'summary', jsonb_build_object(
        'proyectosConPlan', (select count(*) from cohorte),
        'eventosRealizados', (select count(*) from eventos where fecha between ${v.from}::date and ${v.to}::date and fecha <= ${hoy}::date and estado_normal = 'Completada'),
        'piezasPublicadas', (select count(*) from piezas where publicada_en >= ${v.desde} and publicada_en < ${v.hasta}),
        'satisfaccionExcelente', (select round(count(*) filter (where satisfaccion = 'Excelente') * 100.0 / nullif(count(*) filter (where satisfaccion in ('Excelente', 'Bueno', 'Regular')), 0), 1) from cohorte),
        'valoraciones', (select count(*) from cohorte where satisfaccion in ('Excelente', 'Bueno', 'Regular')),
        'oportunidades', (select count(*) from oportunidades)
      ),
      'previous', jsonb_build_object(
        'planes', (select count(*) from planes where created_at >= ${v.anteriorDesde} and created_at < ${v.desde}),
        'eventos', (select count(*) from eventos where fecha between ${v.anteriorFrom}::date and ${v.anteriorTo}::date and fecha <= ${hoy}::date and estado_normal = 'Completada'),
        'publicaciones', (select count(*) from piezas where publicada_en >= ${v.anteriorDesde} and publicada_en < ${v.desde})
      ),
      'launches', jsonb_build_object(
        'fases', ${grupos(sql`select fase nombre, count(*) cantidad from cohorte group by fase`)},
        'fechas', ${grupos(sql`select case when asesoria_fecha_pautada_autor is not null then 'Fecha pautada' when lanzamiento_promocion_fecha_tentativa is not null then 'Solo tentativa' else 'Sin fecha' end nombre, count(*) cantidad from cohorte group by 1`)},
        'ferias', ${grupos(sql`select coalesce(asesoria_feria_proyectada::text, 'Sin feria registrada') nombre, count(*) cantidad from cohorte group by 1`)},
        'realizados', (select count(*) from eventos where fecha between ${v.from}::date and ${v.to}::date and fecha <= ${hoy}::date and estado_normal = 'Completada' and tipo_normal in ${lanzamientos}),
        'cancelados', (select count(*) from cohorte where trabajo = 'cancelado')
      ),
      'events', jsonb_build_object(
        'total', (select count(*) from eventos where fecha between ${v.from}::date and ${v.to}::date),
        'tipos', ${grupos(sql`select coalesce(nullif(tipo_normal, ''), 'Sin clasificar') nombre, count(*) cantidad from eventos where fecha between ${v.from}::date and ${v.to}::date group by 1`)},
        'estados', ${grupos(sql`select estado_normal nombre, count(*) cantidad from eventos where fecha between ${v.from}::date and ${v.to}::date group by 1`)},
        'proximos', (select coalesce(jsonb_agg(j order by fecha, id), '[]'::jsonb) from (
          select ${fila} j, x.fecha, x.id from eventos x join proyectos p on p.id = x.proyecto_id join autores a on a.id = p.autor_id
          left join nombres n on n.proyecto_id = p.id left join usuarios u on u.id = x.responsable_id
          where x.fecha > ${hoy}::date and x.fecha between ${v.from}::date and ${v.to}::date and x.estado_normal <> 'Completada'
          order by x.fecha, x.id limit 6) t)
      ),
      'publications', jsonb_build_object(
        'total', (select count(*) from piezas where created_at >= ${v.desde} and created_at < ${v.hasta}),
        'tipos', ${grupos(sql`select tipo_normal nombre, count(*) cantidad from piezas where created_at >= ${v.desde} and created_at < ${v.hasta} group by 1`)},
        'estados', ${grupos(sql`select estado_normal nombre, count(*) cantidad from piezas where created_at >= ${v.desde} and created_at < ${v.hasta} group by 1`)},
        'publicadasSinFecha', (select count(*) from piezas where estado_normal = 'Publicado' and publicada_en is null)
      ),
      'meetings', jsonb_build_object(
        'realizadas', (select count(*) from reuniones where fecha between ${v.from}::date and ${v.to}::date and fecha <= ${hoy}::date and realizada is true),
        'primeras', (select count(*) from reuniones where fecha between ${v.from}::date and ${v.to}::date and fecha <= ${hoy}::date and realizada is true and tipo = 'Primera'),
        'segundas', (select count(*) from reuniones where fecha between ${v.from}::date and ${v.to}::date and fecha <= ${hoy}::date and realizada is true and tipo = 'Segunda'),
        'adicionales', (select count(*) from reuniones where fecha between ${v.from}::date and ${v.to}::date and fecha <= ${hoy}::date and realizada is true and tipo = 'Adicional'),
        'pendientesSegunda', (select count(*) from cohorte where lanzamiento_promocion_segunda_realizada is not true and fase <> 'Culminado' and trabajo <> 'cancelado'),
        'sinConfirmacion', (select count(*) from reuniones where fecha between ${v.from}::date and ${v.to}::date and realizada is null),
        'promedio', (select round((select count(*) from reuniones r join cohorte c on c.proyecto_id = r.proyecto_id where r.realizada is true and r.fecha between ${v.from}::date and ${v.to}::date and r.fecha <= ${hoy}::date) * 1.0 / nullif(count(*), 0), 1) from cohorte)
      ),
      'satisfaction', ${grupos(sql`select case when satisfaccion = 'Sin clasificar' then 'Sin registrar' else satisfaccion end nombre, count(*) cantidad from cohorte group by 1`)},
      'opportunities', jsonb_build_object('tipos', ${grupos(sql`select nombre, count(*) cantidad from oportunidades group by nombre`)}, 'proyectos', (select count(distinct proyecto_id) from oportunidades)),
      'upcoming', (select coalesce(jsonb_agg(j order by fecha, id), '[]'::jsonb) from (
        select ${fila} j, x.fecha, x.id from (
          select proyecto_id id, proyecto_id, asesoria_fecha_pautada_autor fecha,
            coalesce(lanzamiento_promocion_tipo, 'Sin modalidad') tipo, fase estado,
            coalesce(asesoria_feria_a_participar::text, asesoria_feria_proyectada::text) lugar,
            (select usuario_id from project_assignments a where a.proyecto_id = planes.proyecto_id and a.tipo = 'rrpp' and a.work_item_id is null and a.finalizado_en is null limit 1) responsable_id
          from planes where asesoria_fecha_pautada_autor > ${hoy}::date and fase <> 'Culminado' and trabajo <> 'cancelado'
        ) x join proyectos p on p.id = x.proyecto_id join autores a on a.id = p.autor_id
        left join nombres n on n.proyecto_id = p.id left join usuarios u on u.id = x.responsable_id
        where p.estado not in ('culminado', 'retirado') order by x.fecha, x.id limit 6) t),
      'recent', (select coalesce(jsonb_agg(j order by orden desc, id), '[]'::jsonb) from (
        select ${fila} j, x.created_at orden, x.id from (
          select id, proyecto_id, (created_at at time zone 'America/Caracas')::date fecha, tipo_normal tipo,
            estado_normal estado, null::text lugar, responsable_id, created_at
          from piezas where created_at >= ${v.desde} and created_at < ${v.hasta}
        ) x join proyectos p on p.id = x.proyecto_id join autores a on a.id = p.autor_id
        left join nombres n on n.proyecto_id = p.id left join usuarios u on u.id = x.responsable_id
        order by x.created_at desc, x.id limit 6) t)
    ) data
  `);
  const raw = result.rows[0]?.data as Omit<IndicadoresRrpp, 'periodo' | 'monthly' | 'previousMonthly'> & { previous: { planes: number; eventos: number; publicaciones: number } };
  const cambio = (actual: number, anterior: number) => anterior === 0 ? null : Math.round((actual - anterior) / anterior * 1000) / 10;
  // Series separadas vuelven a agregarse con sus propias fronteras: un mes puede
  // contener el corte entre períodos. No asignar todo ese mes a un solo período.
  const monthly = await serieRrpp(tx, v.from, v.to, hoy);
  const previousMonthly = await serieRrpp(tx, v.anteriorFrom, v.anteriorTo, hoy);
  const { previous, ...data } = raw;
  return { ...data, periodo: { from: v.from, to: v.to, anteriorFrom: v.anteriorFrom, anteriorTo: v.anteriorTo, dias: v.dias, zonaHoraria: v.zonaHoraria, hoy },
    monthly, previousMonthly, summary: { ...raw.summary, comparacionPlanes: cambio(raw.summary.proyectosConPlan, previous.planes), comparacionEventos: cambio(raw.summary.eventosRealizados, previous.eventos), comparacionPublicaciones: cambio(raw.summary.piezasPublicadas, previous.publicaciones) } };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}

async function serieRrpp(tx: Tx, from: string, to: string, hoy: string): Promise<MesRrpp[]> {
  const v = ventanaRrpp({ from, to }, hoy);
  const r = await tx.execute(sql`
    with hechos as (
      select to_char(created_at at time zone 'America/Caracas', 'YYYY-MM') clave, 'planificaciones' tipo from work_items where tipo = 'lanzamiento' and business_key = 'planificacion' and created_at >= ${v.desde} and created_at < ${v.hasta}
      union all select to_char(fecha, 'YYYY-MM'), 'eventos' from rrpp_eventos where fecha between ${from}::date and ${to}::date and fecha <= ${hoy}::date and ${categoria(sql`estado`, 'eventoEstado')} = 'Completada'
      union all select to_char(fecha, 'YYYY-MM'), 'lanzamientos' from rrpp_eventos where fecha between ${from}::date and ${to}::date and fecha <= ${hoy}::date and ${categoria(sql`estado`, 'eventoEstado')} = 'Completada' and regexp_replace(lower(btrim(tipo)), '[[:space:]]+', ' ', 'g') in ${lanzamientos}
      union all select to_char(fecha at time zone 'America/Caracas', 'YYYY-MM'), 'publicaciones' from (select p.id, min(a.created_at) fecha from rrpp_publicaciones p join audit_logs a on a.entity_id = p.id and a.entity_type = 'publicacion_rrpp' and a.accion = 'PUBLICACION_RRPP_REALIZADA' group by p.id) p where fecha >= ${v.desde} and fecha < ${v.hasta}
      union all select to_char(created_at at time zone 'America/Caracas', 'YYYY-MM'), 'piezas' from rrpp_publicaciones where created_at >= ${v.desde} and created_at < ${v.hasta}
      union all select to_char(r.fecha, 'YYYY-MM'), 'reuniones' from (
        select f.lanzamiento_promocion_fecha_primera_reunion fecha, f.lanzamiento_promocion_primera_realizada realizada from fichas_trazabilidad f where exists(select 1 from work_items w where w.proyecto_id = f.proyecto_id and w.tipo = 'lanzamiento' and w.business_key = 'planificacion')
        union all select f.lanzamiento_promocion_fecha_segunda_reunion, f.lanzamiento_promocion_segunda_realizada from fichas_trazabilidad f where exists(select 1 from work_items w where w.proyecto_id = f.proyecto_id and w.tipo = 'lanzamiento' and w.business_key = 'planificacion')
        union all select r.fecha, r.realizada from ficha_lanzamiento_reuniones r join fichas_trazabilidad f on f.id = r.ficha_id where exists(select 1 from work_items w where w.proyecto_id = f.proyecto_id and w.tipo = 'lanzamiento' and w.business_key = 'planificacion')
      ) r where r.fecha between ${from}::date and ${to}::date and r.fecha <= ${hoy}::date and r.realizada is true
    ) select to_char(m, 'YYYY-MM') clave,
      count(*) filter(where h.tipo = 'planificaciones')::int planificaciones,
      count(*) filter(where h.tipo = 'lanzamientos')::int lanzamientos,
      count(*) filter(where h.tipo = 'eventos')::int eventos,
      count(*) filter(where h.tipo = 'publicaciones')::int publicaciones,
      count(*) filter(where h.tipo = 'piezas')::int piezas,
      count(*) filter(where h.tipo = 'reuniones')::int reuniones
    from generate_series(date_trunc('month', ${from}::date), date_trunc('month', ${to}::date), interval '1 month') m
    left join hechos h on h.clave = to_char(m, 'YYYY-MM') group by m order by m
  `);
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return r.rows.map(row => ({ ...(row as Omit<MesRrpp, 'mes'>), mes: `${meses[Number(String(row.clave).slice(5)) - 1]} ${String(row.clave).slice(2, 4)}` }));
}
