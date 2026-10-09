import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  ne,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import {
  auditLogs,
  autores,
  fichasTrazabilidad,
  fichaLanzamientoReuniones,
  projectAssignments,
  proyectos,
  rrppEventos,
  rrppPublicaciones,
  servicios,
  users,
  workItems,
  ASESORIA_FASES,
  ASESORIA_NIVELES_SATISFACCION,
  ASESORIA_FERIAS_PROYECTADAS,
  ASESORIA_FERIAS_A_PARTICIPAR,
  ASESORIA_FUTURO_AUTOR,
} from "../db/schema/index.js";
import { ESTADOS_ACTIVOS } from "./carga.js";
import {
  fechasLanzamientoCanonicas,
  guardarFichaLanzamiento,
} from "./rrppLanzamientoFicha.js";
import { PLANIFICACION_RRPP_KEY } from "./rrppLanzamientoGate.js";
import { asignarConHistorial } from "./assignments.js";
import type { Tx } from "./tx.js";
import { registrarEvento } from "./auditLog.js";
import { obtenerAutoresPorProyectos } from "./proyectosAutores.js";
import {
  EVENTOS_LANZAMIENTO_RRPP,
  ESTADOS_EVENTO_RRPP,
  ESTADOS_PUBLICACION_RRPP,
  FASES_EVENTO_RRPP,
  TIPOS_EVENTO_RRPP,
  TIPOS_PUBLICACION_RRPP,
  VENTA_CRUZADA_RRPP,
  ESTADOS_PIEZA_FUTURO,
  ESTADOS_PIEZA_NOVEDADES,
} from "./rrppLanzamientoCatalogos.js";

export class OperacionLanzamientoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hoyLanzamientoRrpp = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const fechaRrpp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v,
    "Fecha inválida",
  );
const texto = z.string().trim().max(5000).nullable().optional();
const link = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), "Usa un enlace HTTP o HTTPS")
  .nullable()
  .optional();
const fecha = fechaRrpp.nullable().optional();
const persona = z.string().uuid().nullable().optional();
export const planLanzamientoSchema = z
  .object({
    asesoriaFase: z.enum(ASESORIA_FASES).nullable().optional(),
    asesoriaFechaSugeridaGe: fecha,
    asesoriaFechaPautadaAutor: fecha,
    lanzamientoPromocionFechaTentativa: fecha,
    lanzamientoPromocionTipo: texto,
    lanzamientoPromocionObjetivoComercial: texto,
    lanzamientoPromocionDetallesProyeccion: texto,
    lanzamientoPromocionObservaciones: texto,
    lanzamientoPromocionObservacionesGenerales: texto,
    lanzamientoPromocionParticipacionFerias: z
      .enum(["Sí", "No", "Pendiente"])
      .nullable()
      .optional(),
    lanzamientoPromocionIsbn: texto,
    lanzamientoPromocionLinkMinuta: link,
    lanzamientoPromocionFechaPrimeraReunion: fecha,
    lanzamientoPromocionFechaSegundaReunion: fecha,
    lanzamientoPromocionPrimeraRealizada: z.boolean().optional(),
    lanzamientoPromocionSegundaRealizada: z.boolean().optional(),
    lanzamientoPromocionPrimeraResponsableId: persona,
    lanzamientoPromocionSegundaResponsableId: persona,
    lanzamientoPromocionPuntosTratadosPrimera: texto,
    lanzamientoPromocionAcuerdosSegunda: texto,
    asesoriaFechaAdicional: fecha,
    asesoriaNivelSatisfaccion: z
      .enum(ASESORIA_NIVELES_SATISFACCION)
      .nullable()
      .optional(),
    asesoriaFeriaProyectada: z
      .enum(ASESORIA_FERIAS_PROYECTADAS)
      .nullable()
      .optional(),
    asesoriaInfoFeriaEnviada: z.boolean().optional(),
    asesoriaParticipacionFeria: z.boolean().optional(),
    asesoriaFeriaAParticipar: z
      .enum(ASESORIA_FERIAS_A_PARTICIPAR)
      .nullable()
      .optional(),
    asesoriaLinkRutaPromocion: link,
    asesoriaRutaPromocionEnviada: z.boolean().optional(),
    asesoriaLinkMinutaGerencia: link,
    asesoriaNotas: texto,
    asesoriaVentaCruzada: z
      .array(z.enum(VENTA_CRUZADA_RRPP))
      .max(10)
      .optional(),
    asesoriaFuturoAutor: z.enum(ASESORIA_FUTURO_AUTOR).nullable().optional(),
    asesoriaCotizacionImpresion: z.boolean().optional(),
    asesoriaFechaCotizacionSolicitada: fecha,
    asesoriaNotaDistribucion: texto,
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Indica al menos un cambio");
export const reunionLanzamientoSchema = z
  .object({
    clientKey: z.string().uuid(),
    fecha: fechaRrpp,
    realizada: z.boolean().default(false),
    responsableId: persona,
    puntosTratados: texto,
    acuerdos: texto,
  })
  .strict();
export const eventoRrppSchema = z
  .object({
    proyectoId: z.string().uuid(),
    clientKey: z.string().uuid(),
    tipo: z.string().trim().min(1).max(120),
    estado: z.enum(ESTADOS_EVENTO_RRPP).default("No iniciada"),
    fase: z.enum(FASES_EVENTO_RRPP).nullable().optional(),
    fecha: fechaRrpp,
    hora: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
      .nullable()
      .optional(),
    lugar: z.string().trim().max(500).nullable().optional(),
    responsableId: persona,
    representanteId: persona,
    rutaActividad: texto,
    notasRrss: texto,
    programas: texto,
  })
  .strict();
export const publicacionRrppSchema = z
  .object({
    proyectoId: z.string().uuid(),
    clientKey: z.string().uuid(),
    tipo: z.enum(TIPOS_PUBLICACION_RRPP),
    estado: z.enum(ESTADOS_PUBLICACION_RRPP).default("Nuevo"),
    estadoPieza: z.string().max(80).nullable().optional(),
    responsableId: persona,
    detalles: texto,
    notas: texto,
  })
  .strict()
  .superRefine((v, ctx) => {
    const estados: readonly string[] =
      v.tipo === "Futuro Autor"
        ? ESTADOS_PIEZA_FUTURO
        : ESTADOS_PIEZA_NOVEDADES;
    if (v.estadoPieza && !estados.includes(v.estadoPieza))
      ctx.addIssue({
        code: "custom",
        path: ["estadoPieza"],
        message: "Estado de pieza no válido para este tipo de publicación",
      });
  });

const tienePlan = sql<boolean>`exists (select 1 from work_items w where w.proyecto_id = ${proyectos.id} and w.tipo = 'lanzamiento' and w.business_key = ${PLANIFICACION_RRPP_KEY})`;
const responsableSql = sql<
  string | null
>`(select u.nombre from project_assignments a join usuarios u on u.id = a.usuario_id where a.proyecto_id = ${proyectos.id} and a.tipo = 'rrpp' and a.work_item_id is null and a.finalizado_en is null limit 1)`;
const responsableIdSql = sql<
  string | null
>`(select a.usuario_id::text from project_assignments a where a.proyecto_id = ${proyectos.id} and a.tipo = 'rrpp' and a.work_item_id is null and a.finalizado_en is null limit 1)`;
const proximaFecha = sql<string | null>`least(
  case when ${fichasTrazabilidad.lanzamientoPromocionPrimeraRealizada} = false then ${fichasTrazabilidad.lanzamientoPromocionFechaPrimeraReunion} end,
  case when ${fichasTrazabilidad.lanzamientoPromocionSegundaRealizada} = false then ${fichasTrazabilidad.lanzamientoPromocionFechaSegundaReunion} end,
  (select min(e.fecha) from rrpp_eventos e where e.proyecto_id = ${proyectos.id} and e.estado <> 'Completada'),
  case when ${fichasTrazabilidad.asesoriaFase} is distinct from 'Culminado' then coalesce(${fichasTrazabilidad.asesoriaFechaPautadaAutor}, ${fichasTrazabilidad.lanzamientoPromocionFechaTentativa}) end
)`;
const proximaAccion = sql<string>`case
  when ${fichasTrazabilidad.asesoriaFase} = 'Culminado' then 'Seguimiento culminado'
  when ${proximaFecha} = ${fichasTrazabilidad.lanzamientoPromocionFechaPrimeraReunion} and ${fichasTrazabilidad.lanzamientoPromocionPrimeraRealizada} = false then '1ª reunión'
  when ${proximaFecha} = ${fichasTrazabilidad.lanzamientoPromocionFechaSegundaReunion} and ${fichasTrazabilidad.lanzamientoPromocionSegundaRealizada} = false then '2ª reunión'
  when ${proximaFecha} = (select min(e.fecha) from rrpp_eventos e where e.proyecto_id = ${proyectos.id} and e.estado <> 'Completada') then 'Evento programado'
  when ${proximaFecha} is not null then 'Lanzamiento'
  when ${fichasTrazabilidad.lanzamientoPromocionFechaPrimeraReunion} is null then 'Programar 1ª reunión'
  when ${fichasTrazabilidad.lanzamientoPromocionFechaSegundaReunion} is null then 'Programar 2ª reunión'
  when ${fichasTrazabilidad.asesoriaLinkRutaPromocion} is null then 'Preparar ruta de promoción'
  when ${fichasTrazabilidad.asesoriaRutaPromocionEnviada} = false then 'Enviar ruta al autor'
  else 'Definir fecha de lanzamiento' end`;
const cabecera = {
  id: proyectos.id,
  codigo: proyectos.codigo,
  nombre: autores.nombre,
  autorId: proyectos.autorId,
  servicio: { codigo: servicios.codigo, nombre: servicios.nombre },
  estado: proyectos.estado,
  fase: fichasTrazabilidad.asesoriaFase,
  feria: fichasTrazabilidad.asesoriaFeriaProyectada,
  responsable: responsableSql,
  responsableId: responsableIdSql,
  proximaFecha,
  proximaAccion,
};
const joinBase = () =>
  db
    .select(cabecera)
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .innerJoin(
      fichasTrazabilidad,
      eq(fichasTrazabilidad.proyectoId, proyectos.id),
    );
async function nombres<T extends { id: string; nombre: string }>(filas: T[]) {
  const autoresPorProyecto = await obtenerAutoresPorProyectos(
    filas.map((f) => f.id),
  );
  return filas.map((f) => ({
    ...f,
    nombre: (autoresPorProyecto.get(f.id) ?? [{ nombre: f.nombre }])
      .map((a) => a.nombre)
      .join(", "),
  }));
}
export async function catalogosLanzamientos() {
  const [responsables, tipos, representantes] = await Promise.all([
    db
      .select({ id: users.id, nombre: users.nombre })
      .from(users)
      .where(and(eq(users.rol, "rrpp"), eq(users.activo, true)))
      .orderBy(asc(users.nombre)),
    db
      .selectDistinct({ tipo: rrppEventos.tipo })
      .from(rrppEventos)
      .orderBy(asc(rrppEventos.tipo)),
    db
      .select({ id: users.id, nombre: users.nombre })
      .from(users)
      .where(and(ne(users.rol, "autor"), eq(users.activo, true)))
      .orderBy(asc(users.nombre)),
  ]);
  return {
    fases: ASESORIA_FASES,
    satisfaccion: ASESORIA_NIVELES_SATISFACCION,
    ferias: ASESORIA_FERIAS_PROYECTADAS,
    feriasConfirmadas: ASESORIA_FERIAS_A_PARTICIPAR,
    futuroAutor: ASESORIA_FUTURO_AUTOR,
    ventaCruzada: VENTA_CRUZADA_RRPP,
    responsables,
    representantes,
    tiposEvento: [
      ...new Set([...TIPOS_EVENTO_RRPP, ...tipos.map((t) => t.tipo)]),
    ],
    estadosEvento: ESTADOS_EVENTO_RRPP,
    fasesEvento: FASES_EVENTO_RRPP,
    tiposPublicacion: TIPOS_PUBLICACION_RRPP,
    estadosPublicacion: ESTADOS_PUBLICACION_RRPP,
    estadosPiezaFuturo: ESTADOS_PIEZA_FUTURO,
    estadosPiezaNovedades: ESTADOS_PIEZA_NOVEDADES,
  };
}
export async function listarPlanificacion(f: {
  q?: string;
  fase?: string;
  feria?: string;
  responsable?: string;
  pagina: number;
}) {
  const patron = `%${(f.q ?? "").replace(/[\\%_]/g, "\\$&")}%`;
  const filtros = and(
    tienePlan,
    f.fase
      ? eq(
          fichasTrazabilidad.asesoriaFase,
          f.fase as (typeof ASESORIA_FASES)[number],
        )
      : undefined,
    f.feria
      ? eq(
          fichasTrazabilidad.asesoriaFeriaProyectada,
          f.feria as (typeof ASESORIA_FERIAS_PROYECTADAS)[number],
        )
      : undefined,
    f.responsable ? sql`${responsableIdSql} = ${f.responsable}` : undefined,
    f.q
      ? sql`(${proyectos.codigo} ilike ${patron} or ${autores.nombre} ilike ${patron} or ${proyectos.titulo} ilike ${patron} or ${proyectos.tituloDefinitivo} ilike ${patron} or ${fichasTrazabilidad.posibleTituloLibro} ilike ${patron} or exists (select 1 from proyectos_autores pa join autores a on a.id = pa.autor_id where pa.proyecto_id = ${proyectos.id} and a.nombre ilike ${patron}))`
      : undefined,
  );
  const [total] = await db
    .select({ cantidad: count() })
    .from(proyectos)
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(
      fichasTrazabilidad,
      eq(fichasTrazabilidad.proyectoId, proyectos.id),
    )
    .where(filtros);
  const paginas = Math.max(1, Math.ceil((total?.cantidad ?? 0) / 25));
  const pagina = Math.min(f.pagina, paginas);
  const filas = await joinBase()
    .where(filtros)
    .orderBy(
      sql`case when ${fichasTrazabilidad.asesoriaFase} = 'Culminado' then 3 when ${proximaFecha} < (now() at time zone 'America/Caracas')::date then 0 when ${proximaFecha} is not null then 1 else 2 end`,
      asc(proximaFecha),
      asc(proyectos.codigo),
    )
    .limit(25)
    .offset((pagina - 1) * 25);
  return {
    proyectos: await nombres(filas),
    total: total?.cantidad ?? 0,
    pagina,
    paginas,
  };
}
export async function detallePlanificacion(id: string, reunionesPagina = 1) {
  const [p] = await joinBase().where(and(eq(proyectos.id, id), tienePlan));
  if (!p) return null;
  const [ficha] = await db
    .select()
    .from(fichasTrazabilidad)
    .where(eq(fichasTrazabilidad.proyectoId, id));
  const [general] = await db
    .select({
      titulo: proyectos.tituloDefinitivo,
      portadaUrl: proyectos.propuestaPortadaUrl,
    })
    .from(proyectos)
    .where(eq(proyectos.id, id));
  const f = fechasLanzamientoCanonicas(ficha!);
  const [[reunionesTotal], [eventosTotal], [publicacionesTotal]] =
    await Promise.all([
      db
        .select({ cantidad: count() })
        .from(fichaLanzamientoReuniones)
        .where(eq(fichaLanzamientoReuniones.fichaId, f.id)),
      db
        .select({ cantidad: count() })
        .from(rrppEventos)
        .where(eq(rrppEventos.proyectoId, id)),
      db
        .select({ cantidad: count() })
        .from(rrppPublicaciones)
        .where(eq(rrppPublicaciones.proyectoId, id)),
    ]);
  const reunionesPaginas = Math.max(
    1,
    Math.ceil((reunionesTotal?.cantidad ?? 0) / 25),
  );
  const reunionPagina = Math.min(reunionesPagina, reunionesPaginas);
  // Solo campos del proceso RRPP; no fugas de control de Producción.
  const campos = Object.fromEntries(
    Object.entries(f).filter(
      ([k]) =>
        k.startsWith("lanzamientoPromocion") ||
        k.startsWith("asesoria") ||
        ["posibleTituloLibro", "ingresoFechaIngreso"].includes(k),
    ),
  );
  const [
    reuniones,
    eventos,
    publicaciones,
    historial,
    asignaciones,
    participantes,
    trabajo,
  ] = await Promise.all([
    db
      .select({
        ...getTableColumns(fichaLanzamientoReuniones),
        responsable: users.nombre,
      })
      .from(fichaLanzamientoReuniones)
      .leftJoin(users, eq(users.id, fichaLanzamientoReuniones.responsableId))
      .where(eq(fichaLanzamientoReuniones.fichaId, f.id))
      .orderBy(
        desc(fichaLanzamientoReuniones.fecha),
        asc(fichaLanzamientoReuniones.id),
      )
      .limit(25)
      .offset((reunionPagina - 1) * 25),
    db
      .select({ ...getTableColumns(rrppEventos), responsable: users.nombre })
      .from(rrppEventos)
      .leftJoin(users, eq(users.id, rrppEventos.responsableId))
      .where(eq(rrppEventos.proyectoId, id))
      .orderBy(asc(rrppEventos.fecha))
      .limit(50),
    db
      .select({
        ...getTableColumns(rrppPublicaciones),
        responsable: users.nombre,
      })
      .from(rrppPublicaciones)
      .leftJoin(users, eq(users.id, rrppPublicaciones.responsableId))
      .where(eq(rrppPublicaciones.proyectoId, id))
      .orderBy(desc(rrppPublicaciones.createdAt))
      .limit(50),
    historialLanzamientos({ proyecto: id, pagina: 1 }),
    db
      .select({
        id: projectAssignments.id,
        nombre: users.nombre,
        desde: projectAssignments.asignadoEn,
        hasta: projectAssignments.finalizadoEn,
      })
      .from(projectAssignments)
      .innerJoin(users, eq(users.id, projectAssignments.usuarioId))
      .where(
        and(
          eq(projectAssignments.proyectoId, id),
          eq(projectAssignments.tipo, "rrpp"),
        ),
      )
      .orderBy(desc(projectAssignments.asignadoEn))
      .limit(30),
    db
      .select({ id: users.id, nombre: users.nombre })
      .from(users)
      .where(
        inArray(
          users.id,
          [
            f.lanzamientoPromocionPrimeraResponsableId,
            f.lanzamientoPromocionSegundaResponsableId,
          ].filter((v): v is string => Boolean(v)),
        ),
      ),
    db
      .select({ estado: workItems.estado })
      .from(workItems)
      .where(
        and(
          eq(workItems.proyectoId, id),
          eq(workItems.tipo, "lanzamiento"),
          eq(workItems.businessKey, PLANIFICACION_RRPP_KEY),
        ),
      ),
  ]);
  return {
    ...(await nombres([p]))[0]!,
    ...general,
    titulo: general?.titulo ?? f.posibleTituloLibro,
    ficha: campos,
    reuniones,
    eventos,
    publicaciones,
    totalEventos: eventosTotal?.cantidad ?? 0,
    totalPublicaciones: publicacionesTotal?.cantidad ?? 0,
    reunionesPaginacion: {
      total: reunionesTotal?.cantidad ?? 0,
      pagina: reunionPagina,
      paginas: reunionesPaginas,
    },
    historial,
    asignaciones,
    participantes,
    editable:
      ESTADOS_ACTIVOS.includes(p.estado as "en_proceso" | "retrasado") &&
      trabajo[0]?.estado !== "cancelado",
  };
}

async function validarResponsables(
  ids: (string | null | undefined)[],
  representante = false,
) {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unicos.length) return;
  const filas = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.id, unicos),
        representante ? ne(users.rol, "autor") : eq(users.rol, "rrpp"),
        eq(users.activo, true),
      ),
    );
  if (filas.length !== unicos.length)
    throw new OperacionLanzamientoError(
      400,
      representante
        ? "Selecciona una cuenta activa del equipo PanHouse"
        : "Selecciona una cuenta RRPP activa",
    );
}
async function verificarPlan(id: string) {
  const [p] = await db
    .select({ estado: proyectos.estado })
    .from(proyectos)
    .where(and(eq(proyectos.id, id), tienePlan));
  if (!p)
    throw new OperacionLanzamientoError(404, "Planificación no encontrada");
  if (!(ESTADOS_ACTIVOS as readonly string[]).includes(p.estado))
    throw new OperacionLanzamientoError(
      409,
      "El proyecto está cerrado o suspendido; su planificación es de consulta",
    );
}
async function bloquearPlan(tx: Tx, id: string) {
  const [p] = await tx
    .select()
    .from(proyectos)
    .where(and(eq(proyectos.id, id), tienePlan))
    .for("update");
  if (!p)
    throw new OperacionLanzamientoError(404, "Planificación no encontrada");
  if (!(ESTADOS_ACTIVOS as readonly string[]).includes(p.estado))
    throw new OperacionLanzamientoError(
      409,
      "El proyecto está cerrado o suspendido; su planificación es de consulta",
    );
  const [w] = await tx
    .select({ estado: workItems.estado })
    .from(workItems)
    .where(
      and(
        eq(workItems.proyectoId, id),
        eq(workItems.tipo, "lanzamiento"),
        eq(workItems.businessKey, PLANIFICACION_RRPP_KEY),
      ),
    );
  if (w?.estado === "cancelado")
    throw new OperacionLanzamientoError(409, "La planificación fue cancelada");
}
export async function actualizarPlanificacion(
  id: string,
  datos: z.infer<typeof planLanzamientoSchema>,
  actorId: string,
) {
  await verificarPlan(id);
  await validarResponsables([
    datos.lanzamientoPromocionPrimeraResponsableId,
    datos.lanzamientoPromocionSegundaResponsableId,
  ]);
  return guardarFichaLanzamiento(
    id,
    { ...datos },
    actorId,
    async (tx, _p, f, patch) => {
      await bloquearPlan(tx, id);
      const hoy = hoyLanzamientoRrpp();
      for (const n of ["Primera", "Segunda"] as const) {
        const fk = `lanzamientoPromocionFecha${n}Reunion` as const;
        const rk = `lanzamientoPromocion${n}Realizada` as const;
        if (fk in patch && f[rk] === null && !(rk in patch)) patch[rk] = false;
        const realizada = rk in patch ? patch[rk] : f[rk];
        const fechaReunion = fk in patch ? patch[fk] : f[fk];
        if (realizada && (!fechaReunion || fechaReunion > hoy))
          throw new OperacionLanzamientoError(
            400,
            "Una reunión realizada debe tener una fecha válida, hasta hoy",
          );
      }
      const enviada =
        patch.asesoriaRutaPromocionEnviada ?? f.asesoriaRutaPromocionEnviada;
      const enlace =
        "asesoriaLinkRutaPromocion" in patch
          ? patch.asesoriaLinkRutaPromocion
          : f.asesoriaLinkRutaPromocion;
      if (enviada && !enlace)
        throw new OperacionLanzamientoError(
          400,
          "Registra el enlace de la ruta antes de marcarla enviada",
        );
    },
  );
}
export async function asignarResponsableLanzamiento(
  id: string,
  responsableId: string,
  actorId: string,
) {
  await verificarPlan(id);
  await validarResponsables([responsableId]);
  return db.transaction(async (tx) => {
    await bloquearPlan(tx, id);
    const asignacion = await asignarConHistorial(tx, {
      proyectoId: id,
      tipo: "rrpp",
      usuarioId: responsableId,
      asignadoPorId: actorId,
    });
    if (asignacion.cambio)
      await registrarEvento(tx, {
        actorId,
        accion: "RESPONSABLE_RRPP_ASIGNADO",
        entityType: "project_assignment",
        entityId: asignacion.asignacionId,
        proyectoId: id,
      });
    return asignacion;
  });
}
export async function registrarReunionLanzamiento(
  id: string,
  datos: z.infer<typeof reunionLanzamientoSchema>,
  actorId: string,
  reunionId?: string,
) {
  await verificarPlan(id);
  await validarResponsables([datos.responsableId]);
  if (datos.realizada && datos.fecha > hoyLanzamientoRrpp())
    throw new OperacionLanzamientoError(
      400,
      "Una reunión futura no puede marcarse realizada",
    );
  return db.transaction(async (tx) => {
    await bloquearPlan(tx, id);
    const [f] = await tx
      .select({ id: fichasTrazabilidad.id })
      .from(fichasTrazabilidad)
      .where(eq(fichasTrazabilidad.proyectoId, id));
    if (!f) throw new OperacionLanzamientoError(404, "Ficha no encontrada");
    const { clientKey, ...contenido } = datos;
    const [existente] = await tx
      .select()
      .from(fichaLanzamientoReuniones)
      .where(
        and(
          eq(fichaLanzamientoReuniones.fichaId, f.id),
          reunionId
            ? eq(fichaLanzamientoReuniones.id, reunionId)
            : eq(fichaLanzamientoReuniones.clientKey, clientKey),
        ),
      );
    if (reunionId && !existente)
      throw new OperacionLanzamientoError(404, "Reunión no encontrada");
    if (
      existente &&
      (!reunionId ||
        Object.entries(contenido).every(
          ([k, v]) => existente[k as keyof typeof existente] === v,
        ))
    )
      return existente;
    const [fila] = existente
      ? await tx
          .update(fichaLanzamientoReuniones)
          .set(contenido)
          .where(eq(fichaLanzamientoReuniones.id, existente.id))
          .returning()
      : await tx
          .insert(fichaLanzamientoReuniones)
          .values({ fichaId: f.id, clientKey, ...contenido })
          .returning();
    await registrarEvento(tx, {
      actorId,
      accion: "REUNION_LANZAMIENTO_REGISTRADA",
      entityType: "reunion_lanzamiento",
      entityId: fila!.id,
      proyectoId: id,
    });
    return fila!;
  });
}

export async function guardarEventoRrpp(
  datos: z.infer<typeof eventoRrppSchema>,
  actorId: string,
  eventoId?: string,
) {
  await verificarPlan(datos.proyectoId);
  await validarResponsables([datos.responsableId]);
  await validarResponsables([datos.representanteId], true);
  return db.transaction(async (tx) => {
    await bloquearPlan(tx, datos.proyectoId);
    const [anterior] = await tx
      .select()
      .from(rrppEventos)
      .where(
        and(
          eq(rrppEventos.proyectoId, datos.proyectoId),
          eventoId
            ? eq(rrppEventos.id, eventoId)
            : eq(rrppEventos.clientKey, datos.clientKey),
        ),
      );
    if (eventoId && !anterior)
      throw new OperacionLanzamientoError(404, "Evento no encontrado");
    if (anterior && !eventoId) return anterior;
    if (
      anterior &&
      Object.entries(datos).every(
        ([k, v]) =>
          anterior[k as keyof typeof anterior] === v ||
          (k === "hora" && String(anterior.hora).slice(0, 5) === v),
      )
    )
      return anterior;
    const [fila] = anterior
      ? await tx
          .update(rrppEventos)
          .set(datos)
          .where(eq(rrppEventos.id, anterior.id))
          .returning()
      : await tx.insert(rrppEventos).values(datos).returning();
    await registrarEvento(tx, {
      actorId,
      accion: anterior ? "EVENTO_RRPP_ACTUALIZADO" : "EVENTO_RRPP_PROGRAMADO",
      entityType: "evento_rrpp",
      entityId: fila!.id,
      proyectoId: datos.proyectoId,
    });
    return fila!;
  });
}
export async function guardarPublicacionRrpp(
  datos: z.infer<typeof publicacionRrppSchema>,
  actorId: string,
  publicacionId?: string,
) {
  await verificarPlan(datos.proyectoId);
  await validarResponsables([datos.responsableId]);
  return db.transaction(async (tx) => {
    await bloquearPlan(tx, datos.proyectoId);
    const [anterior] = await tx
      .select()
      .from(rrppPublicaciones)
      .where(
        and(
          eq(rrppPublicaciones.proyectoId, datos.proyectoId),
          publicacionId
            ? eq(rrppPublicaciones.id, publicacionId)
            : eq(rrppPublicaciones.clientKey, datos.clientKey),
        ),
      );
    if (publicacionId && !anterior)
      throw new OperacionLanzamientoError(404, "Publicación no encontrada");
    if (anterior && !publicacionId) return anterior;
    if (
      anterior &&
      Object.entries(datos).every(
        ([k, v]) => anterior[k as keyof typeof anterior] === v,
      )
    )
      return anterior;
    const [fila] = anterior
      ? await tx
          .update(rrppPublicaciones)
          .set(datos)
          .where(eq(rrppPublicaciones.id, anterior.id))
          .returning()
      : await tx.insert(rrppPublicaciones).values(datos).returning();
    await registrarEvento(tx, {
      actorId,
      accion:
        datos.estado === "Publicado" && anterior?.estado !== "Publicado"
          ? "PUBLICACION_RRPP_REALIZADA"
          : anterior
            ? "PUBLICACION_RRPP_ACTUALIZADA"
            : "PUBLICACION_RRPP_REGISTRADA",
      entityType: "publicacion_rrpp",
      entityId: fila!.id,
      proyectoId: datos.proyectoId,
    });
    return fila!;
  });
}
export async function agendaRrpp(f: {
  desde: string;
  hasta: string;
  tipo?: string;
  proyecto?: string;
}) {
  if (
    f.desde > f.hasta ||
    Date.parse(f.hasta) - Date.parse(f.desde) > 93 * 86400000
  )
    throw new OperacionLanzamientoError(
      400,
      "El período debe ser de hasta 93 días",
    );
  const filas = await db
    .select({
      evento: getTableColumns(rrppEventos),
      codigo: proyectos.codigo,
      nombre: autores.nombre,
      responsable: users.nombre,
    })
    .from(rrppEventos)
    .innerJoin(proyectos, eq(proyectos.id, rrppEventos.proyectoId))
    .innerJoin(autores, eq(autores.id, proyectos.autorId))
    .leftJoin(users, eq(users.id, rrppEventos.responsableId))
    .where(
      and(
        sql`${rrppEventos.fecha} between ${f.desde} and ${f.hasta}`,
        f.tipo ? eq(rrppEventos.tipo, f.tipo) : undefined,
        f.proyecto ? eq(rrppEventos.proyectoId, f.proyecto) : undefined,
      ),
    )
    .orderBy(asc(rrppEventos.fecha), asc(rrppEventos.hora), asc(rrppEventos.id))
    .limit(501);
  const result = await nombres(
    filas.slice(0, 500).map((fila) => ({
      ...fila.evento,
      id: fila.evento.proyectoId,
      eventoId: fila.evento.id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      responsable: fila.responsable,
    })),
  );
  return {
    eventos: result.map((f) => ({ ...f, id: f.eventoId })),
    limiteAlcanzado: filas.length > 500,
  };
}
export async function publicacionesRrpp(f: {
  estado?: string;
  proyecto?: string;
  pagina: number;
  q?: string;
}) {
  const patron = `%${(f.q ?? "").replace(/[\\%_]/g, "\\$&")}%`;
  const filtro = and(
    f.estado ? eq(rrppPublicaciones.estado, f.estado) : undefined,
    f.proyecto ? eq(rrppPublicaciones.proyectoId, f.proyecto) : undefined,
    f.q
      ? sql`(${autores.nombre} ilike ${patron} or ${proyectos.codigo} ilike ${patron} or ${proyectos.tituloDefinitivo} ilike ${patron} or exists (select 1 from proyectos_autores pa join autores a on a.id = pa.autor_id where pa.proyecto_id = ${proyectos.id} and a.nombre ilike ${patron}))`
      : undefined,
  );
  const [total] = await db
    .select({ cantidad: count() })
    .from(rrppPublicaciones)
    .innerJoin(proyectos, eq(proyectos.id, rrppPublicaciones.proyectoId))
    .innerJoin(autores, eq(autores.id, proyectos.autorId))
    .where(filtro);
  const paginas = Math.max(1, Math.ceil((total?.cantidad ?? 0) / 25));
  const pagina = Math.min(f.pagina, paginas);
  const filas = await db
    .select({
      pieza: getTableColumns(rrppPublicaciones),
      nombre: autores.nombre,
      codigo: proyectos.codigo,
      fechaLanzamiento: sql<
        string | null
      >`coalesce(${fichasTrazabilidad.asesoriaFechaPautadaAutor}, ${fichasTrazabilidad.lanzamientoPromocionFechaTentativa})`,
      responsable: users.nombre,
    })
    .from(rrppPublicaciones)
    .innerJoin(proyectos, eq(proyectos.id, rrppPublicaciones.proyectoId))
    .innerJoin(autores, eq(autores.id, proyectos.autorId))
    .leftJoin(
      fichasTrazabilidad,
      eq(fichasTrazabilidad.proyectoId, proyectos.id),
    )
    .leftJoin(users, eq(users.id, rrppPublicaciones.responsableId))
    .where(filtro)
    .orderBy(desc(rrppPublicaciones.updatedAt), asc(rrppPublicaciones.id))
    .limit(25)
    .offset((pagina - 1) * 25);
  const result = await nombres(
    filas.map((f) => ({
      ...f.pieza,
      id: f.pieza.proyectoId,
      piezaId: f.pieza.id,
      nombre: f.nombre,
      codigo: f.codigo,
      fechaLanzamiento: f.fechaLanzamiento,
      responsable: f.responsable,
    })),
  );
  return {
    publicaciones: result.map((p) => ({ ...p, id: p.piezaId })),
    total: total?.cantidad ?? 0,
    pagina,
    paginas,
  };
}
export async function historialLanzamientos(f: {
  proyecto?: string;
  pagina: number;
}) {
  const acciones = [
    ...Object.keys(EVENTOS_LANZAMIENTO_RRPP),
    "INFORMACION_COMERCIAL_ACTUALIZADA",
  ];
  const filtro = and(
    inArray(auditLogs.accion, acciones),
    f.proyecto ? eq(auditLogs.proyectoId, f.proyecto) : tienePlan,
  );
  const [total] = await db
    .select({ cantidad: count() })
    .from(auditLogs)
    .innerJoin(proyectos, eq(proyectos.id, auditLogs.proyectoId))
    .where(filtro);
  const paginas = Math.max(1, Math.ceil((total?.cantidad ?? 0) / 30));
  const pagina = Math.min(f.pagina, paginas);
  const eventos = await db
    .select({
      id: auditLogs.id,
      fecha: auditLogs.createdAt,
      accion: auditLogs.accion,
      codigo: proyectos.codigo,
      proyectoId: proyectos.id,
      actor: users.nombre,
    })
    .from(auditLogs)
    .innerJoin(proyectos, eq(proyectos.id, auditLogs.proyectoId))
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(filtro)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(30)
    .offset((pagina - 1) * 30);
  return {
    eventos: eventos.map((e) => ({
      id: e.id,
      fecha: e.fecha.toISOString(),
      titulo:
        e.accion === "INFORMACION_COMERCIAL_ACTUALIZADA"
          ? "Comercial actualizó información"
          : EVENTOS_LANZAMIENTO_RRPP[
              e.accion as keyof typeof EVENTOS_LANZAMIENTO_RRPP
            ],
      codigo: e.codigo,
      proyectoId: e.proyectoId,
      actor: e.actor,
    })),
    total: total?.cantidad ?? 0,
    pagina,
    paginas,
  };
}
