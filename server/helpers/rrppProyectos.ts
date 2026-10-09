import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  auditLogs,
  autores,
  capitulos,
  correcciones,
  direccionesCreativas,
  disenos,
  ESTADOS_PROYECTO,
  fichaCalidadFases,
  fichaDisenoPropuestas,
  fichaLanzamientoReuniones,
  fichasTrazabilidad,
  projectAssignments,
  proyectos,
  servicios,
  users,
  workItems,
} from '../db/schema/index.js';
import { ESTADOS_ACTIVOS } from './carga.js';
import { evaluarPreparacionRrpp } from './preparacionRrpp.js';
import { obtenerAutoresPorProyectos } from './proyectosAutores.js';
import {
  contextoComercialRrpp,
  datosRrpp,
  fechaProyectadaIngreso,
} from './rrppIngresos.js';
import { EVENTOS_PROYECTO_RRPP } from './rrppProyectoEventos.js';

export const CONTEXTOS_RRPP = {
  sin_ingreso: 'Sin ingreso RRPP',
  ingreso: 'Ingreso abierto',
  cerrado: 'Ingreso cerrado',
  enviado: 'Enviado a Jefatura',
  conceptos: 'Conceptos por aprobar',
  lanzamiento: 'Lanzamiento en curso',
} as const;
type Contexto = keyof typeof CONTEXTOS_RRPP;
const acciones = Object.keys(EVENTOS_PROYECTO_RRPP);
// Mismo alcance de lectura que GET ficha / proyecto/riesgo: RRPP es acceso por rol,
// sin ownership individual ni restricción a intake. No modifica ningún permiso.
const conceptoPendiente = sql<boolean>`exists (select 1 from ficha_diseno_propuestas p
  join direcciones_creativas d on d.id = p.direccion_creativa_id join work_items w on w.id = d.work_item_id
  where d.proyecto_id = ${proyectos.id} and d.tipo = 'concepto_portada' and d.fecha_cierre is null
  and w.estado not in ('completado', 'cancelado') and p.fecha_aprobada_rrpp is null
  and p.estado is distinct from 'Devuelta por RRPP' and ${proyectos.estado} in ('en_proceso','retrasado'))`;
const contextoSql = sql<Contexto>`case when ${conceptoPendiente} then 'conceptos'
  when exists (select 1 from work_items w where w.proyecto_id = ${proyectos.id} and w.tipo = 'lanzamiento' and w.estado = 'en_progreso') then 'lanzamiento'
  when ${proyectos.notificadoJefatura} then 'enviado'
  when ${proyectos.notificadoRrpp} and (${proyectos.estado} not in ('en_proceso','retrasado')
    or exists (select 1 from work_items w where w.proyecto_id = ${proyectos.id} and w.tipo = 'intake_rrpp' and w.estado = 'cancelado')) then 'cerrado'
  when ${proyectos.notificadoRrpp} then 'ingreso' else 'sin_ingreso' end`;
const ultimaActividad = sql<
  string | null
>`(select max(a.created_at)::text from audit_logs a
  where a.proyecto_id = ${proyectos.id} and a.accion in (${sql.join(
    acciones.map((a) => sql`${a}`),
    sql`, `,
  )}))`;
const seleccion = {
  id: proyectos.id,
  codigo: proyectos.codigo,
  autorId: proyectos.autorId,
  autorPrincipal: autores.nombre,
  estado: proyectos.estado,
  contextoRrpp: contextoSql,
  actualizadoAt: ultimaActividad,
  servicio: {
    id: servicios.id,
    codigo: servicios.codigo,
    nombre: servicios.nombre,
  },
};
const base = () =>
  db
    .select(seleccion)
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id));
function fechaIso(valor: string | Date | null | undefined) {
  return valor ? new Date(valor).toISOString() : null;
}
async function nombresLista<
  T extends {
    id: string;
    autorPrincipal: string;
    actualizadoAt: string | null;
    contextoRrpp: Contexto;
  },
>(filas: T[]) {
  const nombres = await obtenerAutoresPorProyectos(filas.map((f) => f.id));
  return filas.map((f) => ({
    ...f,
    nombre: (nombres.get(f.id) ?? [{ nombre: f.autorPrincipal }])
      .map((a) => a.nombre)
      .join(', '),
    actualizadoAt: fechaIso(f.actualizadoAt),
    contextoEtiqueta: CONTEXTOS_RRPP[f.contextoRrpp],
  }));
}
export interface FiltrosProyectosRrpp {
  q?: string;
  servicio?: string;
  estado?: (typeof ESTADOS_PROYECTO)[number];
  rrpp?: Contexto;
  orden?: 'recientes' | 'antiguos' | 'autor';
  pagina: number;
}
export async function listarProyectosRrpp(f: FiltrosProyectosRrpp) {
  // Search/paginación en SQL; coautores por EXISTS, sin duplicar filas o N+1.
  const patron = `%${(f.q ?? '').replace(/[\\%_]/g, '\\$&')}%`;
  const filtros = and(
    f.servicio ? eq(proyectos.servicioId, f.servicio) : undefined,
    f.estado ? eq(proyectos.estado, f.estado) : undefined,
    f.rrpp ? sql`${contextoSql} = ${f.rrpp}` : undefined,
    f.q
      ? sql`(${proyectos.codigo} ilike ${patron} or ${autores.nombre} ilike ${patron} or ${proyectos.titulo} ilike ${patron}
      or ${proyectos.tituloDefinitivo} ilike ${patron}
      or exists (select 1 from fichas_trazabilidad ft where ft.proyecto_id = ${proyectos.id} and ft.posible_titulo_libro ilike ${patron})
      or exists (select 1 from proyectos_autores pa join autores a on a.id = pa.autor_id where pa.proyecto_id = ${proyectos.id} and a.nombre ilike ${patron}))`
      : undefined,
  );
  const [total] = await db
    .select({ cantidad: count() })
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .where(filtros);
  const paginas = Math.max(1, Math.ceil((total?.cantidad ?? 0) / 25));
  const pagina = Math.min(f.pagina, paginas);
  const orden =
    f.orden === 'autor'
      ? asc(autores.nombre)
      : sql`${ultimaActividad} ${f.orden === 'antiguos' ? sql`asc` : sql`desc`} nulls last`;
  const filas = await base()
    .where(filtros)
    .orderBy(orden, asc(proyectos.codigo), asc(proyectos.id))
    .limit(25)
    .offset((pagina - 1) * 25);
  const catalogo = await db
    .selectDistinct({
      id: servicios.id,
      codigo: servicios.codigo,
      nombre: servicios.nombre,
    })
    .from(servicios)
    .innerJoin(proyectos, eq(proyectos.servicioId, servicios.id))
    .orderBy(asc(servicios.nombre));
  return {
    proyectos: await nombresLista(filas),
    total: total?.cantidad ?? 0,
    pagina,
    paginas,
    porPagina: 25,
    catalogos: {
      servicios: catalogo,
      estados: ESTADOS_PROYECTO,
      contextos: CONTEXTOS_RRPP,
    },
  };
}
export async function historialProyectoRrpp(id: string, pagina = 1) {
  const filtro = and(
    eq(auditLogs.proyectoId, id),
    inArray(auditLogs.accion, acciones),
  );
  const [total] = await db
    .select({ cantidad: count() })
    .from(auditLogs)
    .where(filtro);
  const filas = await db
    .select({
      id: auditLogs.id,
      accion: auditLogs.accion,
      fecha: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(filtro)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(30)
    .offset((pagina - 1) * 30);
  return {
    eventos: filas.map((e) => ({
      id: e.id,
      fecha: e.fecha.toISOString(),
      ...EVENTOS_PROYECTO_RRPP[e.accion],
    })),
    total: total?.cantidad ?? 0,
    pagina,
    paginas: Math.max(1, Math.ceil((total?.cantidad ?? 0) / 30)),
  };
}
const etapas = [
  ['ingreso', 'Ingreso RRPP', 'intake_rrpp', 'rrpp'],
  ['jefatura', 'Jefatura', 'asignacion_especialista', 'jefe_area'],
  ['creativa', 'Creativa', 'direccion_creativa', 'lider_creativo'],
  ['edicion', 'Edición', 'edicion', 'editor'],
  ['correccion', 'Corrección', 'correccion', 'corrector'],
  ['diseno', 'Diseño', 'diseno', 'disenador'],
  ['calidad', 'Calidad', 'calidad', 'validador'],
  ['lanzamiento', 'Lanzamiento', 'lanzamiento', 'rrpp'],
] as const;
const etapasAdicionales = [
  [
    'revision_cubierta',
    'Revisión interna de cubierta',
    'revision_interna_cubierta',
    'especialista',
  ],
  ['digital', 'Soporte digital', 'soporte_digital', 'soporte_digital'],
  ['impresion', 'Impresión', 'impresion', 'impresion'],
  ['distribucion', 'Distribución', 'distribucion', 'rrpp'],
] as const;
type Item = typeof workItems.$inferSelect;
export function estadoEtapa(items: Pick<Item, 'estado'>[]) {
  if (items.some((i) => i.estado === 'en_progreso')) return 'en_progreso';
  if (items.some((i) => i.estado === 'bloqueado')) return 'bloqueado';
  if (items.some((i) => i.estado === 'pendiente')) return 'pendiente';
  if (
    items.some((i) => i.estado === 'completado') &&
    items.every((i) => ['completado', 'cancelado'].includes(i.estado))
  )
    return 'completado';
  if (items.length && items.every((i) => i.estado === 'cancelado'))
    return 'cancelado';
  return 'pendiente';
}
export async function resumenProyectoRrpp(id: string) {
  const [fila] = await base().where(eq(proyectos.id, id));
  if (!fila) return null;
  const [p] = await db.select().from(proyectos).where(eq(proyectos.id, id));
  const [ficha] = await db
    .select()
    .from(fichasTrazabilidad)
    .where(eq(fichasTrazabilidad.proyectoId, id));
  // La actividad de cada área no depende de la primera página del historial.
  const ultimosPorAccion = await db
    .select({
      accion: auditLogs.accion,
      fecha: sql<string>`max(${auditLogs.createdAt})::text`,
    })
    .from(auditLogs)
    .where(
      and(eq(auditLogs.proyectoId, id), inArray(auditLogs.accion, acciones)),
    )
    .groupBy(auditLogs.accion);
  const [
    items,
    asignaciones,
    historial,
    creativas,
    propuestas,
    correccion,
    diseno,
    calidad,
    capitulosResumen,
    reuniones,
  ] = await Promise.all([
    db.select().from(workItems).where(eq(workItems.proyectoId, id)),
    db
      .select({
        tipo: projectAssignments.tipo,
        workItemId: projectAssignments.workItemId,
        nombre: users.nombre,
      })
      .from(projectAssignments)
      .innerJoin(users, eq(users.id, projectAssignments.usuarioId))
      .where(
        and(
          eq(projectAssignments.proyectoId, id),
          isNull(projectAssignments.finalizadoEn),
        ),
      ),
    historialProyectoRrpp(id),
    db
      .select({
        id: direccionesCreativas.id,
        tipo: direccionesCreativas.tipo,
        workItemId: direccionesCreativas.workItemId,
        fechaReunion: direccionesCreativas.fechaReunion,
        fechaCierre: direccionesCreativas.fechaCierre,
        resultado: direccionesCreativas.resultadoFinal,
      })
      .from(direccionesCreativas)
      .where(eq(direccionesCreativas.proyectoId, id)),
    ficha
      ? db
          .select({
            id: fichaDisenoPropuestas.id,
            direccionId: fichaDisenoPropuestas.direccionCreativaId,
            descripcion: fichaDisenoPropuestas.descripcion,
            enlace: fichaDisenoPropuestas.enlace,
            estado: fichaDisenoPropuestas.estado,
            fechaRrpp: fichaDisenoPropuestas.fechaAprobadaRrpp,
            fechaAutor: fichaDisenoPropuestas.fechaAprobadaAutor,
            fecha: fichaDisenoPropuestas.createdAt,
          })
          .from(fichaDisenoPropuestas)
          .where(eq(fichaDisenoPropuestas.fichaId, ficha.id))
          .orderBy(desc(fichaDisenoPropuestas.createdAt))
      : [],
    db
      .select({
        workItemId: correcciones.workItemId,
        dueAt: correcciones.dueAt,
        nombre: correcciones.correctorNombre,
      })
      .from(correcciones)
      .where(eq(correcciones.proyectoId, id)),
    db
      .select({ workItemId: disenos.workItemId, dueAt: disenos.dueAt })
      .from(disenos)
      .where(eq(disenos.proyectoId, id)),
    ficha
      ? db
          .select({
            workItemId: fichaCalidadFases.workItemId,
            dueAt: fichaCalidadFases.dueAt,
          })
          .from(fichaCalidadFases)
          .where(eq(fichaCalidadFases.fichaId, ficha.id))
      : [],
    db
      .select({
        cantidad: count(),
        entregados:
          sql<number>`count(*) filter (where ${capitulos.fechaEntregaEditor} is not null)`.mapWith(
            Number,
          ),
      })
      .from(capitulos)
      .where(eq(capitulos.proyectoId, id)),
    ficha
      ? db
          .select({
            id: fichaLanzamientoReuniones.id,
            fecha: fichaLanzamientoReuniones.fecha,
            puntos: fichaLanzamientoReuniones.puntosTratados,
            acuerdos: fichaLanzamientoReuniones.acuerdos,
          })
          .from(fichaLanzamientoReuniones)
          .where(eq(fichaLanzamientoReuniones.fichaId, ficha.id))
          .orderBy(asc(fichaLanzamientoReuniones.fecha))
      : [],
  ]);
  const [resumen] = await nombresLista([fila]);
  const nombres = (await obtenerAutoresPorProyectos([id])).get(id) ?? [];
  const preparacion = ficha
    ? evaluarPreparacionRrpp(ficha, fila.servicio.codigo)
    : null;
  const usuariosLegacy = [
    p!.especialistaId,
    p!.editorId,
    p!.correctorId,
    p!.disenadorId,
    p!.jefeAreaId,
  ].filter((v): v is string => !!v);
  const personas = usuariosLegacy.length
    ? await db
        .select({ id: users.id, nombre: users.nombre })
        .from(users)
        .where(inArray(users.id, usuariosLegacy))
    : [];
  const fallback: Record<string, string | null> = {
    especialista: p!.especialistaId,
    editor: p!.editorId,
    corrector: p!.correctorId,
    disenador: p!.disenadorId,
    jefe_area: p!.jefeAreaId,
  };
  const stages = [
    ...etapas,
    ...etapasAdicionales.filter(([, , tipo]) =>
      items.some((i) => i.tipo === tipo),
    ),
  ].map(([key, label, tipo, rol]) => {
    const trabajos = items.filter((i) => i.tipo === tipo);
    let estado = estadoEtapa(trabajos);
    if (key === 'ingreso' && p!.notificadoJefatura) estado = 'completado';
    if (key === 'jefatura' && p!.especialistaId && !trabajos.length)
      estado = 'completado';
    const abiertos = trabajos.filter(
      (i) => !['completado', 'cancelado'].includes(i.estado),
    );
    const responsables = [
      ...new Set(
        asignaciones
          .filter(
            (a) =>
              a.tipo === rol &&
              (!a.workItemId || abiertos.some((i) => i.id === a.workItemId)),
          )
          .map((a) => a.nombre),
      ),
    ];
    if (!responsables.length && fallback[rol]) {
      const persona = personas.find((u) => u.id === fallback[rol]);
      if (persona) responsables.push(persona.nombre);
    }
    for (const c of correccion.filter(
      (c) =>
        key === 'correccion' &&
        c.nombre &&
        abiertos.some((i) => i.id === c.workItemId),
    ))
      if (!responsables.includes(c.nombre!)) responsables.push(c.nombre!);
    const vencimientos = [...correccion, ...diseno, ...calidad]
      .filter((d) => abiertos.some((i) => i.id === d.workItemId))
      .map((d) => fechaIso(d.dueAt))
      .filter((d): d is string => !!d);
    const fechasPautadas = abiertos
      .map((i) => i.fechaFinPautada)
      .filter((d): d is string => !!d);
    const legacy = ficha
      ? ((
          {
            edicion: ficha.edicionEstatus,
            correccion: ficha.correccionEstatus,
            diseno: ficha.disenoEstatus,
            calidad: ficha.calidadEstatus,
            lanzamiento: ficha.lanzamientoEstatus,
          } as Record<string, string | null>
        )[key] ?? null)
      : null;
    return {
      key,
      label,
      estado,
      registrado: legacy,
      progress:
        key === 'ingreso' &&
        p!.notificadoRrpp &&
        (!p!.notificadoJefatura || preparacion?.listoParaJefatura)
          ? (preparacion?.progreso ?? null)
          : null,
      responsables,
      rol,
      dueAt: [...vencimientos, ...fechasPautadas].sort()[0] ?? null,
      ultimaActividad:
        ultimosPorAccion
          .filter((e) => EVENTOS_PROYECTO_RRPP[e.accion]?.etapa === key)
          .map((e) => fechaIso(e.fecha)!)
          .sort()
          .at(-1) ?? null,
      instancias: trabajos.length,
      activas: abiertos.length,
      bloqueadas: trabajos.filter((i) => i.estado === 'bloqueado').length,
    };
  });
  const activas = stages.filter((s) => s.estado === 'en_progreso');
  const pendientes = stages.filter(
    (s) => s.activas > 0 && s.estado !== 'en_progreso',
  );
  const responsablesActuales = activas.length ? activas : pendientes;
  const revision = creativas
    .filter(
      (d) =>
        d.tipo === 'concepto_portada' &&
        !d.fechaCierre &&
        !['completado', 'cancelado'].includes(
          items.find((i) => i.id === d.workItemId)?.estado ?? 'cancelado',
        ) &&
        ESTADOS_ACTIVOS.includes(p!.estado),
    )
    .map((d) => ({
      direccionId: d.id,
      propuestas: propuestas.filter(
        (pr) =>
          pr.direccionId === d.id &&
          !pr.fechaRrpp &&
          pr.estado !== 'Devuelta por RRPP',
      ),
    }))
    .filter((g) => g.propuestas.length);
  return {
    ...resumen!,
    subtipoCrudo: ficha?.ingresoServicioSubtipoCrudo ?? null,
    stages,
    responsableActual:
      responsablesActuales.length > 1
        ? `${responsablesActuales.length} áreas con trabajo ${activas.length ? 'en curso' : 'pendiente'}`
        : (responsablesActuales[0]?.label ?? 'Sin trabajo abierto registrado'),
    areasActuales: responsablesActuales.map((s) => ({
      area: s.label,
      personas: s.responsables,
    })),
    informacion: {
      autorPrincipal: fila.autorPrincipal,
      coautores: nombres
        .filter((a) => a.id !== p!.autorId)
        .map((a) => a.nombre),
      titulo: p!.tituloDefinitivo ?? p!.titulo,
      coleccion: ficha?.coleccionPanhouse ?? null,
      tema: ficha?.temaGeneral ?? null,
      publico: ficha?.publicoPerfil ?? null,
      posibleTitulo: ficha?.posibleTituloLibro ?? null,
    },
    contexto: ficha
      ? contextoComercialRrpp(
          ficha,
          fila.autorPrincipal,
          nombres.filter((a) => a.id !== p!.autorId).map((a) => a.nombre),
        )
      : null,
    diagnostico: ficha ? datosRrpp(ficha) : null,
    preparacion,
    abrirIngreso:
      p!.notificadoRrpp &&
      !p!.notificadoJefatura &&
      ESTADOS_ACTIVOS.includes(p!.estado) &&
      !items.some((i) => i.tipo === 'intake_rrpp' && i.estado === 'cancelado'),
    fechas: {
      ingreso: ficha?.ingresoFechaIngreso ?? null,
      proyectada: ficha
        ? fechaProyectadaIngreso(fila.servicio.codigo, ficha)
        : null,
      deseadaAutor: p!.fechaDeseadaAutor,
      lanzamiento: ficha?.lanzamientoPromocionFechaTentativa ?? null,
      ultimaActividad: fechaIso(fila.actualizadoAt),
    },
    eventos: historial.eventos.slice(0, 6),
    creativa: {
      intervenciones: creativas.map((d) => ({
        id: d.id,
        tipo: d.tipo,
        fechaReunion: d.fechaReunion,
        fechaCierre: d.fechaCierre,
        resultado: d.resultado,
        estado: items.find((i) => i.id === d.workItemId)?.estado ?? null,
      })),
      propuestas: propuestas.map(({ fecha, ...pr }) => ({
        ...pr,
        fecha: fecha.toISOString(),
      })),
      revision,
    },
    produccion: {
      capitulos: capitulosResumen[0] ?? { cantidad: 0, entregados: 0 },
    },
    lanzamiento: ficha
      ? {
          reuniones,
          primeraReunion: ficha.lanzamientoPromocionFechaPrimeraReunion,
          segundaReunion: ficha.lanzamientoPromocionFechaSegundaReunion,
          puntosPrimera: ficha.lanzamientoPromocionPuntosTratadosPrimera,
          acuerdosSegunda: ficha.lanzamientoPromocionAcuerdosSegunda,
          objetivo: ficha.lanzamientoPromocionObjetivoComercial,
          ferias: ficha.lanzamientoPromocionParticipacionFerias,
          tipo: ficha.lanzamientoPromocionTipo,
          observaciones: ficha.lanzamientoPromocionObservaciones,
          estatus: ficha.lanzamientoEstatus,
        }
      : null,
  };
}
