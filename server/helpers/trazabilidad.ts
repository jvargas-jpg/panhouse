import { and, desc, eq, inArray, isNull, notInArray, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  autores,
  fichaCalidadFases,
  fichaDisenoPropuestas,
  fichaDistribucionPaises,
  fichaLanzamientoReuniones,
  fichasTrazabilidad,
  proyectos,
  servicios,
  type EstadoCotizacionImpresion,
  type TipoPortada,
} from '../db/schema/index.js';

import { ESTADOS_ACTIVOS } from './carga.js';
import { obtenerAutoresPorProyectos, type AutorDeProyecto } from './proyectosAutores.js';

// Se llama al crear el proyecto: nace vacía, cada sección se completa
// después de forma independiente. Ver server/helpers/proyectos.ts —
// mismo patrón de "función de dominio separada, sin ruta HTTP todavía"
// que asignarEspecialista.
export async function crearFichaTrazabilidad(proyectoId: string) {
  const [fila] = await db.insert(fichasTrazabilidad).values({ proyectoId }).returning();
  if (!fila) throw new Error('El insert de la ficha de trazabilidad no devolvió ninguna fila');
  return fila;
}

async function obtenerFichaPorProyecto(proyectoId: string) {
  const [ficha] = await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, proyectoId)).limit(1);
  if (!ficha) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return ficha;
}

// Para la pantalla de detalle: las nueve secciones en una sola llamada
// (la fila principal más las cuatro tablas hijas, en paralelo) en vez
// de que el frontend tenga que pedir sección por sección. Sección 8
// (Impresión) viaja igual que las demás — es una columna más de la fila
// principal, aunque hoy no exista ninguna ruta para escribirla todavía.
export async function obtenerFichaCompleta(proyectoId: string) {
  const [ficha] = await db.select().from(fichasTrazabilidad).where(eq(fichasTrazabilidad.proyectoId, proyectoId)).limit(1);
  if (!ficha) return undefined;

  const [calidadFases, disenoPropuestas, lanzamientoReuniones, distribucionPaises] = await Promise.all([
    db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.fichaId, ficha.id)).orderBy(fichaCalidadFases.numeroFase),
    db.select().from(fichaDisenoPropuestas).where(eq(fichaDisenoPropuestas.fichaId, ficha.id)),
    db.select().from(fichaLanzamientoReuniones).where(eq(fichaLanzamientoReuniones.fichaId, ficha.id)),
    db.select().from(fichaDistribucionPaises).where(eq(fichaDistribucionPaises.fichaId, ficha.id)),
  ]);

  return { ...ficha, calidadFases, disenoPropuestas, lanzamientoReuniones, distribucionPaises };
}

export interface ProyectoPendienteSeccion1 {
  id: string;
  // Nulo en proyectos creados antes de que el título fuera obligatorio
  // en el alta (CrearProyectoModalForm.tsx) — ProyectosPendientesCrmList.tsx
  // muestra un texto de respaldo cuando falta.
  titulo: string | null;
  // Se mantiene (primer autor) por compatibilidad — ListaProyectosPendientes.tsx
  // (RrppHomePage, SoporteEditorialHomePage, SoporteDigitalHomePage,
  // DisenadorHomePage) sigue leyéndolo tal cual. `autores` es la lista
  // completa (coautoría, ver proyectos_autores) — ProyectosPendientesCrmList.tsx
  // (pestaña "Proyectos" del CRM) es el único consumidor migrado a ella.
  autor: { id: string; nombre: string };
  autores: AutorDeProyecto[];
  servicio: { id: string; codigo: string; nombre: string };
  // Parámetros comerciales (unidad/presupuesto/fecha programada) — solo
  // los ids, sin nombre resuelto: quien los consume (CrearProyectoModalForm.tsx
  // en modo edición) ya tiene el catálogo completo vía GET /catalogos, así
  // que alcanza con el id para preseleccionar el <select> correcto.
  unidadId: string;
  presupuestoId: string;
  fechaProgramadaInicio: string;
}

// Base de las dos "notificaciones internas" (rrpp, comercial): mismo
// join autor/servicio que alertas.ts, pero filtrado por columnas de la
// ficha en vez de por riesgo de plazo. "Pendiente" = las columnas de esa
// mitad de la sección 1 siguen TODAS vacías — mismo criterio que ya usa
// la pantalla de detalle para mostrar "Sin completar" (ver
// SinCompletar/CamposReadOnly en el frontend): en cuanto se llena un
// campo, el proyecto ya no cuenta como "sin completar" para esta lista.
// Solo proyectos activos — un proyecto culminado o retirado no necesita
// que nadie termine de llenar su ficha.
async function listarProyectosPendientesSeccion1(condicionFicha: SQL | undefined): Promise<ProyectoPendienteSeccion1[]> {
  const filas = await db
    .select({
      id: proyectos.id,
      titulo: proyectos.titulo,
      autorId: autores.id,
      autorNombre: autores.nombre,
      servicioId: servicios.id,
      servicioCodigo: servicios.codigo,
      servicioNombre: servicios.nombre,
      unidadId: proyectos.unidadId,
      presupuestoId: proyectos.presupuestoId,
      fechaProgramadaInicio: proyectos.fechaProgramadaInicio,
    })
    .from(proyectos)
    .innerJoin(fichasTrazabilidad, eq(fichasTrazabilidad.proyectoId, proyectos.id))
    .innerJoin(autores, eq(proyectos.autorId, autores.id))
    .innerJoin(servicios, eq(proyectos.servicioId, servicios.id))
    .where(and(inArray(proyectos.estado, ESTADOS_ACTIVOS), condicionFicha))
    .orderBy(desc(proyectos.createdAt));

  // Coautoría: una sola consulta en lote (no N+1) para todos los
  // proyectos de esta página — ver obtenerAutoresPorProyectos.
  const autoresPorProyecto = await obtenerAutoresPorProyectos(filas.map((fila) => fila.id));

  return filas.map((fila) => ({
    id: fila.id,
    titulo: fila.titulo,
    autor: { id: fila.autorId, nombre: fila.autorNombre },
    autores: autoresPorProyecto.get(fila.id) ?? [{ id: fila.autorId, nombre: fila.autorNombre }],
    servicio: { id: fila.servicioId, codigo: fila.servicioCodigo, nombre: fila.servicioNombre },
    unidadId: fila.unidadId,
    presupuestoId: fila.presupuestoId,
    fechaProgramadaInicio: fila.fechaProgramadaInicio,
  }));
}

// "Proyectos pendientes de tu perfil" — pantalla de inicio de rrpp.
export function listarProyectosPendientesPerfil(): Promise<ProyectoPendienteSeccion1[]> {
  return listarProyectosPendientesSeccion1(
    and(
      isNull(fichasTrazabilidad.perfilAutor),
      isNull(fichasTrazabilidad.publicoObjetivo),
      isNull(fichasTrazabilidad.objetivosComerciales),
    ),
  );
}

// "Proyectos pendientes de lo contractual" — sección extra en la
// pantalla de comercial, junto al formulario de crear autor.
export function listarProyectosPendientesContrato(): Promise<ProyectoPendienteSeccion1[]> {
  return listarProyectosPendientesSeccion1(and(isNull(fichasTrazabilidad.capitulosPactados), isNull(fichasTrazabilidad.paginasPactadas)));
}

// "Proyectos pendientes de soporte digital" — mismo criterio que
// perfil/contrato: las tres columnas de la sección siguen vacías.
export function listarProyectosPendientesSoporteDigital(): Promise<ProyectoPendienteSeccion1[]> {
  return listarProyectosPendientesSeccion1(
    and(
      isNull(fichasTrazabilidad.soporteDigitalCuentaAmazon),
      isNull(fichasTrazabilidad.soporteDigitalFechaEnvioFormulario),
      isNull(fichasTrazabilidad.soporteDigitalFechaActivacion),
    ),
  );
}

// A diferencia de perfil/contrato/soporte digital, las secciones 4 y 5
// no viven solo en columnas de fichasTrazabilidad — tienen tabla hija
// (varias filas por naturaleza). "Pendiente" ahí no es "columna vacía",
// es "todavía no tiene ninguna fila". Se resuelve con una subconsulta
// de los fichaId que SÍ tienen al menos una fila, y se excluyen esos —
// dos queries simples en vez de un join con filas duplicadas a
// desduplicar después.
async function idsDeFichaConPropuestasDeDiseno(): Promise<string[]> {
  const filas = await db.selectDistinct({ fichaId: fichaDisenoPropuestas.fichaId }).from(fichaDisenoPropuestas);
  return filas.map((fila) => fila.fichaId);
}

async function idsDeFichaConFasesDeCalidad(): Promise<string[]> {
  const filas = await db.selectDistinct({ fichaId: fichaCalidadFases.fichaId }).from(fichaCalidadFases);
  return filas.map((fila) => fila.fichaId);
}

// "Proyectos pendientes de diseño" — pantalla de inicio de disenador
// (y, cuando se construya, lider_creativo). Pendiente = sin brief Y sin
// ninguna propuesta todavía, mismo criterio que ya usa SeccionDiseno.tsx
// en el frontend para mostrar "Sin completar".
export async function listarProyectosPendientesDiseno(): Promise<ProyectoPendienteSeccion1[]> {
  const idsConPropuestas = await idsDeFichaConPropuestasDeDiseno();
  return listarProyectosPendientesSeccion1(
    and(
      isNull(fichasTrazabilidad.disenoBriefCreativo),
      idsConPropuestas.length > 0 ? notInArray(fichasTrazabilidad.id, idsConPropuestas) : undefined,
    ),
  );
}

// "Proyectos pendientes de calidad" — pantalla de inicio de
// soporte_editorial. Pendiente = todavía sin ninguna fase registrada.
export async function listarProyectosPendientesCalidad(): Promise<ProyectoPendienteSeccion1[]> {
  const idsConFases = await idsDeFichaConFasesDeCalidad();
  return listarProyectosPendientesSeccion1(idsConFases.length > 0 ? notInArray(fichasTrazabilidad.id, idsConFases) : undefined);
}

// Cada "actualizarSeccionX" toca solo sus propias columnas en
// fichas_trazabilidad — un .set() parcial nunca escribe las columnas
// de las otras secciones, así que no hay forma de que una pise a otra.

// Sección 1 partida en dos por dueño distinto: el perfil del autor lo
// captura RRPP en la reunión inicial; los capítulos/páginas pactados
// son parte de lo que comercial ya vendió, aparte del resto de la
// sección — cada función toca solo sus propias columnas.

export interface DatosSeccionProyectoPerfil {
  perfilAutor?: string | null;
  publicoObjetivo?: string | null;
  objetivosComerciales?: string | null;
  ingresoTipoProyecto?: string | null;
  ingresoTipoProyectoDetalle?: string | null;
  ingresoFechaIngreso?: string | null;
  ingresoFechaCierre?: string | null;
  ingresoFechaDeseada?: string | null;
  ingresoTemaGeneral?: string | null;
  ingresoServicioPerfil?: string | null;
  ingresoServicioEjecucion?: string | null;
  ingresoServicioAlianza?: string | null;
  ingresoServicioPresupuesto?: string | null;
  ingresoObservaciones?: string | null;
  ingresoPosibleTitulo?: string | null;
  ingresoColeccion?: string | null;
  ingresoPublicoSexo?: string | null;
  ingresoPublicoEdad?: string | null;
  ingresoPublicoPerfil?: string | null;
  ingresoPropositoSocial?: string | null;
  ingresoObjetivoComercial?: string | null;
  ingresoTonoEstilo?: string | null;
  ingresoCriterioExtra?: string | null;
  ingresoCondicionesEspeciales?: string | null;
  ingresoObservacionesEquipo?: string | null;
  ingresoCoordinador?: string | null;
  ingresoJefeDepartamento?: string | null;
  ingresoEditor?: string | null;
  ingresoCorrector?: string | null;
  ingresoDisenador?: string | null;
  ingresoCalidad?: string | null;
}

export async function actualizarSeccionProyectoPerfil(proyectoId: string, datos: DatosSeccionProyectoPerfil) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

export interface DatosSeccionProyectoContrato {
  capitulosPactados?: number | null;
  paginasPactadas?: number | null;
}

export async function actualizarSeccionProyectoContrato(proyectoId: string, datos: DatosSeccionProyectoContrato) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

// Sección 2 — Edición de estilo. Mismo dueño que Corrección
// (especialista); vista de conjunto, coexiste con el detalle por
// capítulo en `capitulos`.
export interface DatosSeccionEdicion {
  edicionEstatus?: string | null;
  edicionFechaEnvioEditor?: string | null;
  edicionFechaRecepcionEditor?: string | null;
  edicionFechaEnvioAutor?: string | null;
  edicionFechaAprobacionAutor?: string | null;
  edicionObservaciones?: string | null;
}

export async function actualizarSeccionEdicion(proyectoId: string, datos: DatosSeccionEdicion) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

export interface DatosSeccionCorreccion {
  correccionTripaCompleta?: string | null;
  correccionTripaCompletaFechaEntrega?: string | null;
  correccionTripaCompletaAprobado?: boolean | null;
  correccionPreliminares?: string | null;
  correccionPreliminaresFechaEntrega?: string | null;
  correccionPreliminaresAprobado?: boolean | null;
  correccionCubiertaExtendida?: string | null;
  correccionCubiertaExtendidaFechaEntrega?: string | null;
  correccionCubiertaExtendidaAprobado?: boolean | null;
  correccionEstatus?: string | null;
  correccionTipoAsignacion?: string | null;
  correccionFechaEnvio?: string | null;
  correccionFechaInicio?: string | null;
  correccionFechaEntrega?: string | null;
  correccionTotalDias?: string | null;
  correccionObservaciones?: string | null;
}

export async function actualizarSeccionCorreccion(proyectoId: string, datos: DatosSeccionCorreccion) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

// Brief + los cuatro campos confirmados contra la matriz real de
// Dirección Creativa que lo acompañan: mismo dueño (disenador/
// lider_creativo), misma ruta, se guardan juntos.
export interface DatosSeccionDisenoBrief {
  disenoBriefCreativo?: string | null;
  disenoTipoPortada?: TipoPortada | null;
  disenoFechaReunionCreativa?: string | null;
  disenoFechaEntregaBrief?: string | null;
  disenoBriefAprobadoFecha?: string | null;
}

export async function actualizarBriefDiseno(proyectoId: string, datos: DatosSeccionDisenoBrief) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

// Sección 4 (parte 2) — Diseño, estatus agregado (macro). Dueño doble:
// el especialista dueño del proyecto o el disenador asignado (ver
// verificarAccesoAProyecto en helpers/proyectos.ts, que ya resuelve
// ambas ramas) — a diferencia del brief/propuestas de arriba, que son
// solo de disenador/lider_creativo.
export interface DatosSeccionDisenoControl {
  disenoEstatus?: string | null;
  disenoFechaInicio?: string | null;
  disenoFechaEntrega?: string | null;
  disenoTotalDias?: string | null;
  disenoObservaciones?: string | null;
}

export async function actualizarSeccionDisenoControl(proyectoId: string, datos: DatosSeccionDisenoControl) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

// Sección 5 (parte 2) — Calidad, estatus agregado (macro). Dueño doble:
// el especialista dueño del proyecto o el analista de calidad asignado
// (ver verificarAccesoControlCalidad en helpers/proyectos.ts, aislado
// del verificarAccesoAProyecto compartido — ver el comentario ahí).
export interface DatosSeccionCalidadControl {
  calidadEstatus?: string | null;
  calidadFechaInicio?: string | null;
  calidadFechaEntrega?: string | null;
  calidadTotalDias?: string | null;
  calidadObservaciones?: string | null;
}

export async function actualizarSeccionCalidadControl(proyectoId: string, datos: DatosSeccionCalidadControl) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

export interface DatosPropuestaDiseno {
  fechaEnviadaEspecialista?: string | null;
  fechaEnviadaAutor?: string | null;
  fechaAprobadaAutor?: string | null;
  estado?: string | null;
  descripcion?: string | null;
  enlace?: string | null;
}

export async function agregarPropuestaDiseno(proyectoId: string, datos: DatosPropuestaDiseno) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .insert(fichaDisenoPropuestas)
    .values({ fichaId: ficha.id, ...datos })
    .returning();
  if (!fila) throw new Error('El insert de la propuesta de diseño no devolvió ninguna fila');
  return fila;
}

// El where con fichaId (no solo el id de la propuesta) evita que un
// disenador/lider_creativo con permiso sobre el rol, pero no sobre
// este proyecto puntual, toque una fila de otra ficha adivinando el
// uuid — devuelve undefined en vez de tocar una fila ajena, y la ruta
// lo traduce a 404.
export async function actualizarPropuestaDiseno(proyectoId: string, propuestaId: string, datos: DatosPropuestaDiseno) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .update(fichaDisenoPropuestas)
    .set(datos)
    .where(and(eq(fichaDisenoPropuestas.id, propuestaId), eq(fichaDisenoPropuestas.fichaId, ficha.id)))
    .returning();
  return fila;
}

export async function eliminarPropuestaDiseno(proyectoId: string, propuestaId: string) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .delete(fichaDisenoPropuestas)
    .where(and(eq(fichaDisenoPropuestas.id, propuestaId), eq(fichaDisenoPropuestas.fichaId, ficha.id)))
    .returning();
  return fila;
}

export interface DatosFaseCalidad {
  numeroFase: number;
  pdfUrl?: string | null;
  pdfVersion?: string | null;
  fecha?: string | null;
  aprobado?: boolean | null;
}

export async function agregarFaseCalidad(proyectoId: string, datos: DatosFaseCalidad) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .insert(fichaCalidadFases)
    .values({ fichaId: ficha.id, ...datos })
    .returning();
  if (!fila) throw new Error('El insert de la fase de calidad no devolvió ninguna fila');
  return fila;
}

export async function actualizarFaseCalidad(proyectoId: string, faseId: string, datos: DatosFaseCalidad) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .update(fichaCalidadFases)
    .set(datos)
    .where(and(eq(fichaCalidadFases.id, faseId), eq(fichaCalidadFases.fichaId, ficha.id)))
    .returning();
  return fila;
}

export async function eliminarFaseCalidad(proyectoId: string, faseId: string) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .delete(fichaCalidadFases)
    .where(and(eq(fichaCalidadFases.id, faseId), eq(fichaCalidadFases.fichaId, ficha.id)))
    .returning();
  return fila;
}

export interface DatosSeccionSoporteDigital {
  soporteDigitalCuentaAmazon?: string | null;
  soporteDigitalFechaEnvioFormulario?: string | null;
  soporteDigitalFechaActivacion?: string | null;
}

export async function actualizarSeccionSoporteDigital(proyectoId: string, datos: DatosSeccionSoporteDigital) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

// Sección 6 (parte 2) — Soporte digital, estatus agregado (macro). Dueño
// doble: el especialista dueño del proyecto o el encargado digital
// asignado (ver verificarAccesoControlDigital en helpers/proyectos.ts,
// aislado del verificarAccesoAProyecto compartido — ver el comentario ahí).
export interface DatosSeccionDigitalControl {
  digitalEstatus?: string | null;
  digitalFechaInicio?: string | null;
  digitalFechaEntrega?: string | null;
  digitalTotalDias?: string | null;
  digitalObservaciones?: string | null;
}

export async function actualizarSeccionDigitalControl(proyectoId: string, datos: DatosSeccionDigitalControl) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

// Sección 7 (parte general) — a diferencia de las reuniones (varias
// filas), es un único valor por proyecto, columna directa en
// fichasTrazabilidad. TODO (Regla de negocio no confirmada): ver
// nivelSatisfaccion en server/db/schema/trazabilidad.ts.
export interface DatosSeccionLanzamientoGeneral {
  nivelSatisfaccion?: string | null;
}

export async function actualizarSeccionLanzamientoGeneral(proyectoId: string, datos: DatosSeccionLanzamientoGeneral) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

// Sección 7 (parte 3) — Lanzamiento, estatus agregado (macro). Dueño
// doble: el especialista dueño del proyecto o el responsable de
// lanzamiento asignado (ver verificarAccesoControlLanzamiento en
// helpers/proyectos.ts, aislado del verificarAccesoAProyecto compartido
// — ver el comentario ahí).
export interface DatosSeccionLanzamientoControl {
  lanzamientoEstatus?: string | null;
  lanzamientoFechaInicio?: string | null;
  lanzamientoFechaEntrega?: string | null;
  lanzamientoTotalDias?: string | null;
  lanzamientoObservaciones?: string | null;
}

export async function actualizarSeccionLanzamientoControl(proyectoId: string, datos: DatosSeccionLanzamientoControl) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

export interface DatosReunionLanzamiento {
  fecha?: string | null;
  puntosTratados?: string | null;
  acuerdos?: string | null;
}

export async function agregarReunionLanzamiento(proyectoId: string, datos: DatosReunionLanzamiento) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .insert(fichaLanzamientoReuniones)
    .values({ fichaId: ficha.id, ...datos })
    .returning();
  if (!fila) throw new Error('El insert de la reunión de lanzamiento no devolvió ninguna fila');
  return fila;
}

export async function actualizarReunionLanzamiento(proyectoId: string, reunionId: string, datos: DatosReunionLanzamiento) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .update(fichaLanzamientoReuniones)
    .set(datos)
    .where(and(eq(fichaLanzamientoReuniones.id, reunionId), eq(fichaLanzamientoReuniones.fichaId, ficha.id)))
    .returning();
  return fila;
}

export async function eliminarReunionLanzamiento(proyectoId: string, reunionId: string) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .delete(fichaLanzamientoReuniones)
    .where(and(eq(fichaLanzamientoReuniones.id, reunionId), eq(fichaLanzamientoReuniones.fichaId, ficha.id)))
    .returning();
  return fila;
}

// Sección 8 — Impresión, dueño rrpp (jefe_area también puede, mismo
// alcance amplio que ya tiene sobre el resto de la ficha).
export interface DatosSeccionImpresion {
  impresionDeseaCotizacion?: boolean | null;
  impresionResponsable?: string | null;
  impresionEstadoCotizacion?: EstadoCotizacionImpresion | null;
  impresionNotas?: string | null;
  // Sección 8 (parte 2) — estatus agregado (macro), mismo dueño (rrpp/
  // jefe_area) que el resto de esta sección — sin dueño individual, ver
  // el comentario en server/db/schema/trazabilidad.ts.
  impresionEstatus?: string | null;
  impresionFechaInicio?: string | null;
  impresionFechaEntrega?: string | null;
  impresionTotalDias?: string | null;
  impresionObservaciones?: string | null;
}

export async function actualizarSeccionImpresion(proyectoId: string, datos: DatosSeccionImpresion) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

// Sección 9 (parte 2) — Distribución, estatus agregado (macro). Dueño
// doble: el especialista dueño del proyecto o el responsable logístico
// asignado (ver verificarAccesoControlDistribucion en
// helpers/proyectos.ts, aislado del verificarAccesoAProyecto compartido
// — ver el comentario ahí).
export interface DatosSeccionDistribucionControl {
  distribucionEstatus?: string | null;
  distribucionFechaInicio?: string | null;
  distribucionFechaEntrega?: string | null;
  distribucionTotalDias?: string | null;
  distribucionObservaciones?: string | null;
}

export async function actualizarSeccionDistribucionControl(proyectoId: string, datos: DatosSeccionDistribucionControl) {
  const [fila] = await db
    .update(fichasTrazabilidad)
    .set(datos)
    .where(eq(fichasTrazabilidad.proyectoId, proyectoId))
    .returning();
  if (!fila) throw new Error(`Ficha de trazabilidad no encontrada para el proyecto: ${proyectoId}`);
  return fila;
}

export interface DatosPaisDistribucion {
  pais: string;
  porcentajeRegalias?: string | null;
}

export async function agregarPaisDistribucion(proyectoId: string, datos: DatosPaisDistribucion) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .insert(fichaDistribucionPaises)
    .values({ fichaId: ficha.id, ...datos })
    .returning();
  if (!fila) throw new Error('El insert del país de distribución no devolvió ninguna fila');
  return fila;
}

export async function actualizarPaisDistribucion(proyectoId: string, paisId: string, datos: DatosPaisDistribucion) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .update(fichaDistribucionPaises)
    .set(datos)
    .where(and(eq(fichaDistribucionPaises.id, paisId), eq(fichaDistribucionPaises.fichaId, ficha.id)))
    .returning();
  return fila;
}

export async function eliminarPaisDistribucion(proyectoId: string, paisId: string) {
  const ficha = await obtenerFichaPorProyecto(proyectoId);
  const [fila] = await db
    .delete(fichaDistribucionPaises)
    .where(and(eq(fichaDistribucionPaises.id, paisId), eq(fichaDistribucionPaises.fichaId, ficha.id)))
    .returning();
  return fila;
}