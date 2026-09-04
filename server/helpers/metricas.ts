import { count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { autores, proyectos, servicios } from '../db/schema/index.js';

const MESES_ABREVIADOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Cuántos meses de historial trae clientesPorMes — incluye el mes
// actual, así que "6" son los últimos 6 meses cerrando en el actual
// (ej. si hoy es junio: Ene, Feb, Mar, Abr, May, Jun).
const MESES_HISTORIAL = 6;

function inicioDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

// Suma (o resta, con cantidad negativa) meses completos, siempre
// devolviendo el primer día de ese mes — evita el bug clásico de sumar
// meses con setMonth cuando el día actual no existe en el mes destino
// (ej. 31 de enero + 1 mes → JS lo desborda a marzo si se suma sobre
// el día 31 directo; acá nunca importa porque siempre se parte del
// día 1).
function sumarMeses(fecha: Date, cantidad: number): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + cantidad, 1);
}

export interface KpisComerciales {
  clientesMesActual: number;
  clientesMesAnterior: number;
  // null cuando el mes anterior tuvo 0 clientes registrados: un
  // porcentaje de crecimiento sobre cero no es un número real (división
  // por cero) — el frontend lo muestra como "Nuevo" en vez de inventar
  // un +100%/+Infinity% sin sentido.
  crecimientoClientesPorcentaje: number | null;
  proyectosMesActual: number;
}

export interface ClientesPorMes {
  mes: string;
  cantidad: number;
}

export interface ProyectosPorMes {
  mes: string;
  cantidad: number;
}

export interface PaisRanking {
  pais: string;
  cantidad: number;
}

export interface ServicioRanking {
  servicio: string;
  cantidad: number;
}

export interface MetricasComerciales {
  kpis: KpisComerciales;
  clientesPorMes: ClientesPorMes[];
  proyectosPorMes: ProyectosPorMes[];
  topPaises: PaisRanking[];
  proyectosPorServicio: ServicioRanking[];
}

// Cuenta, para cada uno de los últimos MESES_HISTORIAL meses (cerrando
// en inicioMesActual), cuántas fechas de `filas` caen en ese mes —
// misma lógica para clientesPorMes (autores.createdAt) y
// proyectosPorMes (proyectos.createdAt), sin duplicar el bucketing.
function contarPorMes(fechas: Date[], inicioVentanaHistorial: Date): { mes: string; cantidad: number }[] {
  const resultado: { mes: string; cantidad: number }[] = [];
  for (let i = 0; i < MESES_HISTORIAL; i++) {
    const inicioBucket = sumarMeses(inicioVentanaHistorial, i);
    const finBucket = sumarMeses(inicioBucket, 1);
    const cantidad = fechas.filter((fecha) => fecha >= inicioBucket && fecha < finBucket).length;
    resultado.push({ mes: MESES_ABREVIADOS[inicioBucket.getMonth()]!, cantidad });
  }
  return resultado;
}

// `ahora` con valor por defecto (no fijo dentro de la función): permite
// tests deterministas pasando una fecha fija, mismo patrón que
// evaluarRiesgoProyecto en helpers/alertas.ts.
//
// clientesMesActual/clientesMesAnterior/clientesPorMes traen solo
// createdAt y agrupan en JS (esta tabla no tiene volumen para que sea un
// problema, y evita duplicar en SQL y en TS la lógica de "a qué mes
// pertenece esta fecha"). topPaises y proyectosPorServicio sí agrupan en
// SQL (GROUP BY): el primero necesita lower(pais) para unificar
// mayúsculas, algo que conviene resolver en la base de datos, no
// replicando la misma normalización en JS. Ambos son rankings
// históricos (no solo los últimos 6 meses ni el mes en curso).
//
// lower(pais) — mismo valor que agrupa topPaises en SQL (ver más abajo).
// Vive como constante para no repetir el mismo fragmento en el SELECT,
// el WHERE y el GROUP BY.
const paisEnMinuscula = sql<string>`lower(${autores.pais})`;

export async function obtenerMetricasComerciales(ahora: Date = new Date()): Promise<MetricasComerciales> {
  const inicioMesActual = inicioDeMes(ahora);
  const inicioMesAnterior = sumarMeses(inicioMesActual, -1);
  const inicioVentanaHistorial = sumarMeses(inicioMesActual, -(MESES_HISTORIAL - 1));
  const finMesActual = sumarMeses(inicioMesActual, 1);

  const [autoresFilas, proyectosFilas, topPaisesFilas, proyectosPorServicio] = await Promise.all([
    db.select({ createdAt: autores.createdAt }).from(autores),
    // Igual que autoresFilas: trae TODO el createdAt (no solo el mes en
    // curso) porque tanto proyectosMesActual como proyectosPorMes lo
    // necesitan, cada uno con su propia ventana — mismo criterio que
    // clientesMesActual/clientesPorMes más abajo, una sola consulta en
    // vez de una por cada métrica derivada.
    db.select({ createdAt: proyectos.createdAt }).from(proyectos),
    // Agrupa en SQL convirtiendo a minúsculas (lower(pais)): 'Venezuela'
    // y 'venezuela' —datos mezclados de antes del <select> de
    // CrearAutorForm.tsx— ahora suman como un solo país en vez de
    // competir como dos entradas separadas del ranking.
    db
      .select({ pais: paisEnMinuscula, cantidad: count() })
      .from(autores)
      .where(isNotNull(autores.pais))
      .groupBy(paisEnMinuscula)
      .orderBy(desc(count())),
    // Cuenta proyectos por tipo de servicio — todo el histórico (no solo
    // el mes en curso), mismo criterio "ranking histórico" que topPaises.
    db
      .select({ servicio: servicios.nombre, cantidad: count() })
      .from(proyectos)
      .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
      .groupBy(servicios.nombre)
      .orderBy(desc(count())),
  ]);

  const clientesMesActual = autoresFilas.filter((a) => a.createdAt >= inicioMesActual).length;
  const clientesMesAnterior = autoresFilas.filter((a) => a.createdAt >= inicioMesAnterior && a.createdAt < inicioMesActual).length;

  const crecimientoClientesPorcentaje =
    clientesMesAnterior === 0 ? null : Math.round(((clientesMesActual - clientesMesAnterior) / clientesMesAnterior) * 1000) / 10;

  // Acotado también por arriba (< finMesActual), no solo por abajo: sin
  // el límite superior, un proyecto con createdAt futuro (datos de
  // prueba, o un reloj de servidor desincronizado) contaría igual.
  const proyectosMesActual = proyectosFilas.filter((p) => p.createdAt >= inicioMesActual && p.createdAt < finMesActual).length;

  const clientesPorMes = contarPorMes(
    autoresFilas.map((a) => a.createdAt),
    inicioVentanaHistorial,
  );
  const proyectosPorMes = contarPorMes(
    proyectosFilas.map((p) => p.createdAt),
    inicioVentanaHistorial,
  );

  return {
    kpis: {
      clientesMesActual,
      clientesMesAnterior,
      crecimientoClientesPorcentaje,
      proyectosMesActual,
    },
    clientesPorMes,
    proyectosPorMes,
    topPaises: topPaisesFilas,
    proyectosPorServicio,
  };
}
