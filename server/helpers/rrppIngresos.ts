import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  auditLogs,
  autores,
  fichasTrazabilidad,
  proyectos,
  servicios,
  workItems,
  COLECCIONES_PANHOUSE,
  ESTADOS_REUNION,
  PROPIETARIOS_MATRIZ_INGRESO,
  PUBLICOS_SEXO,
  SUBTIPOS_CRUDO,
} from '../db/schema/index.js';
import { ESTADOS_ACTIVOS } from './carga.js';
import { auditarCambioFicha, tieneTrabajoRrpp } from './intakeRrpp.js';
import { evaluarPreparacionRrpp } from './preparacionRrpp.js';
import { obtenerAutoresPorProyectos } from './proyectosAutores.js';
import { calcularCronograma } from './cronograma.js';
import {
  seccionFichaEditorialSchema,
  seccionMatrizIngresoSchema,
} from './rrppIngresoSchema.js';
import { z } from 'zod';

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Fecha inválida')
  .nullable()
  .optional();
export const ingresoRrppSchema = seccionFichaEditorialSchema
  .merge(seccionMatrizIngresoSchema)
  .extend({
    ingresoServicioSubtipoCrudo: z.enum(SUBTIPOS_CRUDO).nullable().optional(),
    fechaDeseadaCulminacion: fecha,
    matrizFechaReunionCreativa: fecha,
  })
  .strict()
  .refine(
    (v) => Object.keys(v).length > 0,
    'No se recibieron campos para guardar',
  );
const campos = Object.keys(seccionFichaEditorialSchema.shape).concat(
  Object.keys(seccionMatrizIngresoSchema.shape),
  ['ingresoServicioSubtipoCrudo'],
);
type Ficha = typeof fichasTrazabilidad.$inferSelect;
export function datosRrpp(ficha: Ficha) {
  return Object.fromEntries(campos.map((c) => [c, ficha[c as keyof Ficha]]));
}

// Mismo plazo operativo que la ficha existente. La suma se delega al cronograma
// central; Tripa conserva 90 días provisionales, sin resolver el conflicto manual.
export function fechaProyectadaIngreso(codigo: string, ficha: Ficha) {
  const dias =
    codigo === 'CR'
      ? ficha.ingresoServicioSubtipoCrudo === 'Capítulo'
        ? 150
        : ficha.ingresoServicioSubtipoCrudo === 'Tripa'
          ? 90
          : null
      : (({ SE: 60, EF: 180, EEC: 150, EET: 90 } as Record<string, number>)[
          codigo
        ] ?? 90);
  if (dias === null || !ficha.ingresoFechaIngreso) return null;
  return calcularCronograma(
    { plazoDias: dias, plazoInternoDias: null, plazoComercialDias: null },
    new Date(ficha.ingresoFechaIngreso + 'T00:00:00Z'),
  )
    .fechaFinComprometida.toISOString()
    .slice(0, 10);
}

export async function obtenerIngresosRrpp(id?: string) {
  const filas = await db
    .select({
      proyecto: proyectos,
      ficha: fichasTrazabilidad,
      autor: autores.nombre,
      servicio: { codigo: servicios.codigo, nombre: servicios.nombre },
      item: workItems,
    })
    .from(proyectos)
    .innerJoin(
      fichasTrazabilidad,
      eq(fichasTrazabilidad.proyectoId, proyectos.id),
    )
    .innerJoin(autores, eq(autores.id, proyectos.autorId))
    .innerJoin(servicios, eq(servicios.id, proyectos.servicioId))
    .leftJoin(
      workItems,
      and(
        eq(workItems.proyectoId, proyectos.id),
        eq(workItems.tipo, 'intake_rrpp'),
        eq(workItems.businessKey, 'default'),
      ),
    )
    .where(
      and(
        eq(proyectos.notificadoRrpp, true),
        id ? eq(proyectos.id, id) : undefined,
      ),
    );
  const nombres = await obtenerAutoresPorProyectos(
    filas.map((f) => f.proyecto.id),
  );
  const eventos = filas.length
    ? await db
        .select()
        .from(auditLogs)
        .where(
          and(
            inArray(
              auditLogs.proyectoId,
              filas.map((f) => f.proyecto.id),
            ),
            inArray(auditLogs.accion, [
              'RRPP_NOTIFICADO',
              'INFORMACION_COMERCIAL_ACTUALIZADA',
              'INTAKE_RRPP_INICIADO',
              'DIAGNOSTICO_ACTUALIZADO',
              'DIAGNOSTICO_COMPLETADO',
              'JEFATURA_NOTIFICADA',
            ]),
          ),
        )
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    : [];
  return filas
    .filter(
      (f) =>
        f.proyecto.notificadoJefatura ||
        (ESTADOS_ACTIVOS.includes(f.proyecto.estado) &&
          f.item?.estado !== 'cancelado'),
    )
    .map((f) => {
      const preparacion = evaluarPreparacionRrpp(f.ficha, f.servicio.codigo);
      const propios = eventos.filter((e) => e.proyectoId === f.proyecto.id);
      const ultimo = propios[0];
      const autoresProyecto = nombres.get(f.proyecto.id) ?? [
        { nombre: f.autor },
      ];
      return {
        id: f.proyecto.id,
        codigo: f.proyecto.codigo,
        titulo: f.proyecto.titulo,
        posibleTitulo: f.ficha.posibleTituloLibro,
        nombre: autoresProyecto.map((a) => a.nombre).join(', '),
        servicio: f.servicio,
        estado: f.proyecto.notificadoJefatura
          ? ('enviado' as const)
          : preparacion.listoParaJefatura
            ? ('listo' as const)
            : (f.item && f.item.estado !== 'pendiente') ||
                tieneTrabajoRrpp(f.ficha)
              ? ('diagnostico' as const)
              : ('nuevo' as const),
        preparacion,
        actualizadoAt: ultimo?.createdAt.toISOString() ?? null,
        actualizadoPor:
          ultimo?.accion === 'INFORMACION_COMERCIAL_ACTUALIZADA'
            ? 'Actualizado desde Comercial'
            : ultimo?.accion === 'RRPP_NOTIFICADO'
              ? 'Recibido de Comercial'
              : ultimo
                ? 'Actividad del ingreso'
                : 'Sin fecha de actividad registrada',
        enviadoAt:
          propios
            .find((e) => e.accion === 'JEFATURA_NOTIFICADA')
            ?.createdAt.toISOString() ?? null,
        guardadoAt:
          propios
            .find((e) =>
              ['DIAGNOSTICO_ACTUALIZADO', 'DIAGNOSTICO_COMPLETADO'].includes(
                e.accion,
              ),
            )
            ?.createdAt.toISOString() ?? null,
      };
    });
}

export async function obtenerIngresoRrpp(id: string) {
  const [fila] = await db
    .select({
      proyecto: proyectos,
      ficha: fichasTrazabilidad,
      autor: autores.nombre,
    })
    .from(proyectos)
    .innerJoin(
      fichasTrazabilidad,
      eq(fichasTrazabilidad.proyectoId, proyectos.id),
    )
    .innerJoin(autores, eq(autores.id, proyectos.autorId))
    .where(and(eq(proyectos.id, id), eq(proyectos.notificadoRrpp, true)));
  if (!fila) return null;
  const resumen = (await obtenerIngresosRrpp(id))[0];
  if (!resumen) return null;
  const coautores = (await obtenerAutoresPorProyectos([id])).get(id) ?? [];
  const f = fila.ficha;
  return {
    ...resumen,
    editable:
      !fila.proyecto.notificadoJefatura &&
      ESTADOS_ACTIVOS.includes(fila.proyecto.estado),
    contexto: {
      autorPrincipal: fila.autor,
      coautores: coautores
        .filter((a) => a.id !== fila.proyecto.autorId)
        .map((a) => a.nombre),
      fechaIngreso: f.ingresoFechaIngreso,
      ejecucion: f.ingresoServicioEjecucion,
      tiempoExpresMeses: f.ingresoTiempoExpresMeses,
      alianza: f.ingresoServicioAlianza,
      presupuesto: f.ingresoServicioPresupuesto,
      capitulos: f.capitulosPactados,
      paginas: f.paginasPactadas,
      condiciones: f.condicionesEspeciales,
      criterioExtra: f.criterioExtra,
      observaciones: f.ingresoObservaciones,
    },
    datos: datosRrpp(f),
    fechaProyectada: fechaProyectadaIngreso(resumen.servicio.codigo, f),
  };
}
export const catalogosIngresoRrpp = {
  colecciones: COLECCIONES_PANHOUSE,
  estadosReunion: ESTADOS_REUNION,
  propietarios: PROPIETARIOS_MATRIZ_INGRESO,
  publicosSexo: PUBLICOS_SEXO,
  subtiposCrudo: SUBTIPOS_CRUDO,
};

export async function guardarIngresoRrpp(
  id: string,
  datos: z.infer<typeof ingresoRrppSchema>,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(proyectos)
      .where(eq(proyectos.id, id))
      .for('update');
    if (!p?.notificadoRrpp)
      return {
        ok: false as const,
        status: 404,
        error: 'Ingreso no encontrado',
      };
    const [item] = await tx
      .select()
      .from(workItems)
      .where(
        and(
          eq(workItems.proyectoId, id),
          eq(workItems.tipo, 'intake_rrpp'),
          eq(workItems.businessKey, 'default'),
        ),
      );
    if (
      p.notificadoJefatura ||
      !ESTADOS_ACTIVOS.includes(p.estado) ||
      item?.estado === 'cancelado'
    )
      return {
        ok: false as const,
        status: 409,
        error: 'Este ingreso ya está cerrado',
      };
    const [s] = await tx
      .select()
      .from(servicios)
      .where(eq(servicios.id, p.servicioId));
    if (s?.codigo !== 'CR' && datos.ingresoServicioSubtipoCrudo != null)
      return {
        ok: false as const,
        status: 400,
        error: 'La clasificación Crudo no aplica a este servicio',
      };
    const [antes] = await tx
      .select()
      .from(fichasTrazabilidad)
      .where(eq(fichasTrazabilidad.proyectoId, id))
      .for('update');
    if (!antes)
      return { ok: false as const, status: 404, error: 'Ficha no encontrada' };
    const [despues] = await tx
      .update(fichasTrazabilidad)
      .set(datos)
      .where(eq(fichasTrazabilidad.id, antes.id))
      .returning();
    await auditarCambioFicha(tx, antes, despues!, Object.keys(datos), {
      id: actorId,
      rol: 'rrpp',
    });
    return { ok: true as const };
  });
}
