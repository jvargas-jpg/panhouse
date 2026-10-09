import { and, count, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client.js';
import { autores, fichasTrazabilidad, proyectos, servicios } from '../db/schema/index.js';
import { evaluarPreparacionComercial } from './preparacionComercial.js';

export const periodoIndicadoresSchema = z.object({ periodo: z.enum(['3m', '6m', '12m']).default('6m') }).strict();
const cantidadSchema = z.number().int().nonnegative();
export const indicadoresComercialesSchema = z.object({
  periodo: z.object({ meses: z.number(), desde: z.string(), hasta: z.string(), anteriorDesde: z.string(), anteriorHasta: z.string(), zonaHoraria: z.literal('America/Caracas') }),
  summary: z.object({ autores: cantidadSchema, proyectos: cantidadSchema, listos: cantidadSchema, completitud: z.number().nullable(), crecimientoAutores: z.number().nullable(), crecimientoProyectos: z.number().nullable() }),
  funnel: z.object({ autores: cantidadSchema, proyectos: cantidadSchema, completos: cantidadSchema, listos: cantidadSchema, entregados: cantidadSchema, proyectosPorAutor: z.number().nullable(), completosPorcentaje: z.number().nullable(), listosPorcentaje: z.number().nullable(), entregadosPorcentaje: z.number().nullable() }),
  monthly: z.array(z.object({ clave: z.string(), mes: z.string(), autores: cantidadSchema, proyectos: cantidadSchema, listos: cantidadSchema })),
  services: z.array(z.object({ servicio: z.string(), cantidad: cantidadSchema })),
  countries: z.array(z.object({ pais: z.string(), cantidad: cantidadSchema })),
  timings: z.object({ promedioDias: z.number().nullable(), comparacionPorcentaje: z.number().nullable(), motivo: z.string() }),
});
export type IndicadoresComerciales = z.infer<typeof indicadoresComercialesSchema>;

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
// Venezuela usa UTC-4. Las fronteras y buckets son meses de Caracas,
// independientes de la zona horaria del proceso Node/Postgres.
export function ventanaIndicadores(meses: number, ahora: Date) {
  const local = new Date(ahora.getTime() - 4 * 60 * 60 * 1000);
  const inicioMes = (desplazamiento: number) => new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + desplazamiento, 1, 4));
  return { desde: inicioMes(1 - meses), hasta: ahora, anteriorDesde: inicioMes(1 - meses * 2), anteriorHasta: inicioMes(1 - meses) };
}
function claveMes(fecha: Date) {
  return new Date(fecha.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 7);
}
function porcentaje(numerador: number, denominador: number) {
  return denominador === 0 ? null : Math.round(numerador / denominador * 1000) / 10;
}
function crecimiento(actual: number, anterior: number) {
  return anterior === 0 ? null : porcentaje(actual - anterior, anterior);
}

/**
 * Cohorte: TODOS los proyectos creados en la ventana (sin excluir estados).
 * Readiness actual = evaluarPreparacionComercial, sin reconstruir el pasado.
 * Completo y listo coinciden por definición del dominio; no hay otro gate.
 * Entregado = notificadoRrpp persistido, que registra RRPP_NOTIFICADO al enviarse.
 * Es un hecho independiente: puede seguir entregado aunque luego se edite la ficha.
 * Todos los porcentajes de proyectos usan esta misma cohorte como denominador.
 * Comparaciones solo de altas; N meses previos completos vs ventana actual
 * hasta ahora (mes en curso parcial). No comparamos readiness histórica.
 */
export async function obtenerIndicadoresComerciales(periodo: '3m' | '6m' | '12m' = '6m', ahora = new Date()): Promise<IndicadoresComerciales> {
  const meses = Number.parseInt(periodo, 10);
  const ventana = ventanaIndicadores(meses, ahora);
  return db.transaction(async (tx) => {
    const pais = sql<string>`coalesce(nullif(lower(btrim(${autores.pais})), ''), 'Sin país registrado')`;
    const mesAutor = sql<string>`to_char(${autores.createdAt} at time zone 'America/Caracas', 'YYYY-MM')`;
    const actualAutores = and(gte(autores.createdAt, ventana.desde), lt(autores.createdAt, ventana.hasta));
    const actualProyectos = and(gte(proyectos.createdAt, ventana.desde), lt(proyectos.createdAt, ventana.hasta));
    // Una transacción usa una sola conexión PG; consultas secuenciales.
    const [autoresMensuales, filasProyectos, countries, services] = [
      await tx.select({ clave: mesAutor, cantidad: count() }).from(autores)
        .where(and(gte(autores.createdAt, ventana.anteriorDesde), lt(autores.createdAt, ventana.hasta))).groupBy(mesAutor),
      // Solo columnas necesarias y ventana acotada, sin N+1 ni datos personales.
      // Readiness se agrega EN BACKEND usando el evaluador canónico en vez de
      // escribir una segunda regla SQL que pudiera divergir de la ficha.
      await tx.select({ createdAt: proyectos.createdAt, notificadoRrpp: proyectos.notificadoRrpp,
        servicioId: proyectos.servicioId, unidadId: proyectos.unidadId, presupuestoId: proyectos.presupuestoId,
        autorId: proyectos.autorId,
        ingresoFechaIngreso: fichasTrazabilidad.ingresoFechaIngreso,
        ingresoServicioEjecucion: fichasTrazabilidad.ingresoServicioEjecucion,
        ingresoServicioAlianza: fichasTrazabilidad.ingresoServicioAlianza,
        capitulosPactados: fichasTrazabilidad.capitulosPactados, paginasPactadas: fichasTrazabilidad.paginasPactadas,
      }).from(proyectos).leftJoin(fichasTrazabilidad, eq(fichasTrazabilidad.proyectoId, proyectos.id))
        .where(and(gte(proyectos.createdAt, ventana.anteriorDesde), lt(proyectos.createdAt, ventana.hasta))),
      await tx.select({ pais, cantidad: count() }).from(autores).where(actualAutores).groupBy(pais).orderBy(desc(count()), pais),
      await tx.select({ servicio: servicios.nombre, cantidad: count() }).from(proyectos)
        .innerJoin(servicios, eq(servicios.id, proyectos.servicioId)).where(actualProyectos)
        .groupBy(servicios.nombre).orderBy(desc(count()), servicios.nombre),
    ] as const;
    const monthly: IndicadoresComerciales['monthly'] = Array.from({ length: meses }, (_, i) => {
      const fecha = new Date(Date.UTC(ventana.desde.getUTCFullYear(), ventana.desde.getUTCMonth() + i, 1, 4));
      return { clave: claveMes(fecha), mes: MESES[fecha.getUTCMonth()]!, autores: 0, proyectos: 0, listos: 0 };
    });
    const buckets = new Map(monthly.map((m) => [m.clave, m]));
    let autoresAnterior = 0;
    for (const fila of autoresMensuales) {
      const bucket = buckets.get(fila.clave);
      if (bucket) bucket.autores = fila.cantidad;
      else autoresAnterior += fila.cantidad;
    }
    let proyectosAnterior = 0;
    let entregados = 0;
    for (const fila of filasProyectos) {
      const bucket = buckets.get(claveMes(fila.createdAt));
      if (!bucket) { proyectosAnterior++; continue; }
      bucket.proyectos++;
      // autorId legacy es obligatorio y FK; el listado canónico usa ese autor
      // como fallback cuando no existen filas de coautoría.
      if (evaluarPreparacionComercial({ ...fila, autores: [{ id: fila.autorId }] }).listoParaRrpp) bucket.listos++;
      if (fila.notificadoRrpp) entregados++;
    }
    const totalAutores = monthly.reduce((s, m) => s + m.autores, 0);
    const totalProyectos = monthly.reduce((s, m) => s + m.proyectos, 0);
    const listos = monthly.reduce((s, m) => s + m.listos, 0);
    const completitud = porcentaje(listos, totalProyectos);
    return indicadoresComercialesSchema.parse({
      periodo: { meses, desde: ventana.desde.toISOString(), hasta: ventana.hasta.toISOString(), anteriorDesde: ventana.anteriorDesde.toISOString(), anteriorHasta: ventana.anteriorHasta.toISOString(), zonaHoraria: 'America/Caracas' },
      summary: { autores: totalAutores, proyectos: totalProyectos, listos, completitud, crecimientoAutores: crecimiento(totalAutores, autoresAnterior), crecimientoProyectos: crecimiento(totalProyectos, proyectosAnterior) },
      funnel: { autores: totalAutores, proyectos: totalProyectos, completos: listos, listos, entregados, proyectosPorAutor: porcentaje(totalProyectos, totalAutores), completosPorcentaje: completitud, listosPorcentaje: completitud, entregadosPorcentaje: porcentaje(entregados, totalProyectos) },
      monthly, services, countries,
      timings: { promedioDias: null, comparacionPorcentaje: null, motivo: 'No se registra el momento exacto en que la ficha cumple la preparación comercial. La fecha de entrega a RRPP y la última edición no equivalen a esa fecha.' },
    });
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
