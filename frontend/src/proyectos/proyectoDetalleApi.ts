import { apiFetch } from '../lib/api';
import type {
  Capitulo,
  CargaDisenador,
  CausaPausa,
  EstadoCotizacionImpresion,
  FichaCalidadFase,
  FichaCompleta,
  FichaDisenoPropuesta,
  FichaDistribucionPais,
  FichaLanzamientoReunion,
  Pausa,
  Proyecto,
  ProyectoConRiesgo,
  TipoPortada,
} from '../types/api';
// Misma forma que "mis proyectos" / "proyectos en riesgo" (ProyectoConRiesgo),
// solo que para un proyecto puntual y sin filtrar por estado activo.
export function fetchProyecto(proyectoId: string) {
  return apiFetch<{ proyecto: ProyectoConRiesgo }>(`/proyectos/${proyectoId}/riesgo`);
}

export function fetchFicha(proyectoId: string) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}`);
}

export function fetchCapitulos(proyectoId: string) {
  return apiFetch<{ capitulos: Capitulo[] }>(`/capitulos/${proyectoId}`);
}

export function fetchPausas(proyectoId: string) {
  return apiFetch<{ pausas: Pausa[] }>(`/pausas/${proyectoId}`);
}

export interface DatosNuevaPausa {
  proyectoId: string;
  causa: CausaPausa;
  fechaInicio: string;
}

// Solo la pausa simple (no formal): sin esPausadoFormal ni
// pagoConfirmado, hasta que esté resuelto quién puede confirmar el pago.
export function crearPausa(datos: DatosNuevaPausa) {
  return apiFetch<{ pausa: Pausa }>('/pausas', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

// Sección 1, dueño rrpp.
export interface DatosSeccionProyectoPerfil {
  perfilAutor?: string | null;
  publicoObjetivo?: string | null;
  objetivosComerciales?: string | null;
  ingresoNombreArtistico?: string | null;
  ingresoNacionalidad?: string | null;
  ingresoFechaNacimiento?: string | null;
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
  ingresoRedesSociales?: string | null;
  ingresoPersonalidad?: string | null;
  ingresoOcupacion?: string | null;
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
}

export function actualizarSeccionProyectoPerfil(proyectoId: string, datos: DatosSeccionProyectoPerfil) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/proyecto-perfil`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Sección 1, dueño comercial — aparte del perfil a propósito.
export interface DatosSeccionProyectoContrato {
  capitulosPactados?: number | null;
  paginasPactadas?: number | null;
}

export function actualizarSeccionProyectoContrato(proyectoId: string, datos: DatosSeccionProyectoContrato) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/proyecto-contrato`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Lado editor del capítulo — fuera de la ficha, ver server/helpers/capitulos.ts.
export interface DatosCapituloEditor {
  fechaInicioEditor?: string | null;
  paginas?: number | null;
  fechaEntregaEditor?: string | null;
}

export function actualizarCapituloEditor(proyectoId: string, numero: number, datos: DatosCapituloEditor) {
  return apiFetch<{ capitulo: Capitulo }>(`/capitulos/${proyectoId}/${numero}/editor`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Lado autor del capítulo — restringido a especialista (único punto de
// contacto con el autor), ver server/routes/capitulos.routes.ts.
export interface DatosCapituloAutor {
  fechaEnvioAutor?: string | null;
  fechaPautadaFeedback?: string | null;
  fechaRespuestaReal?: string | null;
  enlaces?: string[] | null;
}

export function actualizarCapituloAutor(proyectoId: string, numero: number, datos: DatosCapituloAutor) {
  return apiFetch<{ capitulo: Capitulo }>(`/capitulos/${proyectoId}/${numero}/autor`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Sección 3, dueño especialista.
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
}

export function actualizarSeccionCorreccion(proyectoId: string, datos: DatosSeccionCorreccion) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/correccion`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Sección 4, dueño disenador o lider_creativo (mismos dos roles para
// brief y propuestas — a diferencia de la sección 1, no está partida
// por campo). disenoBriefAprobadoFecha no tiene un booleano/estado
// aparte — la presencia de fecha ya es la aprobación.
export interface DatosSeccionDisenoBrief {
  disenoBriefCreativo?: string | null;
  disenoTipoPortada?: TipoPortada | null;
  disenoFechaReunionCreativa?: string | null;
  disenoFechaEntregaBrief?: string | null;
  disenoBriefAprobadoFecha?: string | null;
}

export function actualizarBriefDiseno(proyectoId: string, datos: DatosSeccionDisenoBrief) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/diseno/brief`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// estado queda como texto libre a propósito — el conjunto completo de
// valores posibles todavía no está confirmado (ver server/db/schema/trazabilidad.ts).
export interface DatosPropuestaDiseno {
  fechaEnviadaEspecialista?: string | null;
  fechaEnviadaAutor?: string | null;
  fechaAprobadaAutor?: string | null;
  estado?: string | null;
  descripcion?: string | null;
  enlace?: string | null;
}

export function agregarPropuestaDiseno(proyectoId: string, datos: DatosPropuestaDiseno) {
  return apiFetch<{ propuesta: FichaDisenoPropuesta }>(`/fichas-trazabilidad/${proyectoId}/diseno/propuestas`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export function actualizarPropuestaDiseno(proyectoId: string, propuestaId: string, datos: DatosPropuestaDiseno) {
  return apiFetch<{ propuesta: FichaDisenoPropuesta }>(`/fichas-trazabilidad/${proyectoId}/diseno/propuestas/${propuestaId}`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function eliminarPropuestaDiseno(proyectoId: string, propuestaId: string) {
  return apiFetch<{ ok: true }>(`/fichas-trazabilidad/${proyectoId}/diseno/propuestas/${propuestaId}`, {
    method: 'DELETE',
  });
}

// Sección 5, dueño soporte_editorial.
export interface DatosFaseCalidad {
  numeroFase: number;
  pdfUrl?: string | null;
  pdfVersion?: string | null;
  fecha?: string | null;
  aprobado?: boolean | null;
}

export function agregarFaseCalidad(proyectoId: string, datos: DatosFaseCalidad) {
  return apiFetch<{ fase: FichaCalidadFase }>(`/fichas-trazabilidad/${proyectoId}/calidad/fases`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export function actualizarFaseCalidad(proyectoId: string, faseId: string, datos: DatosFaseCalidad) {
  return apiFetch<{ fase: FichaCalidadFase }>(`/fichas-trazabilidad/${proyectoId}/calidad/fases/${faseId}`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function eliminarFaseCalidad(proyectoId: string, faseId: string) {
  return apiFetch<{ ok: true }>(`/fichas-trazabilidad/${proyectoId}/calidad/fases/${faseId}`, {
    method: 'DELETE',
  });
}

// Sección 6, dueño soporte_digital.
export interface DatosSeccionSoporteDigital {
  soporteDigitalCuentaAmazon?: string | null;
  soporteDigitalFechaEnvioFormulario?: string | null;
  soporteDigitalFechaActivacion?: string | null;
}

export function actualizarSeccionSoporteDigital(proyectoId: string, datos: DatosSeccionSoporteDigital) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/soporte-digital`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Sección 7 (parte general), dueño rrpp — a diferencia de las
// reuniones (varias filas), es un único valor por proyecto.
export interface DatosSeccionLanzamientoGeneral {
  nivelSatisfaccion?: string | null;
}

export function actualizarSeccionLanzamientoGeneral(proyectoId: string, datos: DatosSeccionLanzamientoGeneral) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/lanzamiento/general`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Sección 7, dueño rrpp.
export interface DatosReunionLanzamiento {
  fecha?: string | null;
  puntosTratados?: string | null;
  acuerdos?: string | null;
}

export function agregarReunionLanzamiento(proyectoId: string, datos: DatosReunionLanzamiento) {
  return apiFetch<{ reunion: FichaLanzamientoReunion }>(`/fichas-trazabilidad/${proyectoId}/lanzamiento/reuniones`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export function actualizarReunionLanzamiento(proyectoId: string, reunionId: string, datos: DatosReunionLanzamiento) {
  return apiFetch<{ reunion: FichaLanzamientoReunion }>(`/fichas-trazabilidad/${proyectoId}/lanzamiento/reuniones/${reunionId}`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function eliminarReunionLanzamiento(proyectoId: string, reunionId: string) {
  return apiFetch<{ ok: true }>(`/fichas-trazabilidad/${proyectoId}/lanzamiento/reuniones/${reunionId}`, {
    method: 'DELETE',
  });
}

// Sección 8, dueño rrpp (jefe_area también puede).
export interface DatosSeccionImpresion {
  impresionDeseaCotizacion?: boolean | null;
  impresionResponsable?: string | null;
  impresionEstadoCotizacion?: EstadoCotizacionImpresion | null;
  impresionNotas?: string | null;
}

export function actualizarSeccionImpresion(proyectoId: string, datos: DatosSeccionImpresion) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/impresion`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Sección 9, dueño rrpp.
export interface DatosPaisDistribucion {
  pais: string;
  porcentajeRegalias?: string | null;
}

export function agregarPaisDistribucion(proyectoId: string, datos: DatosPaisDistribucion) {
  return apiFetch<{ pais: FichaDistribucionPais }>(`/fichas-trazabilidad/${proyectoId}/distribucion/paises`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

export function actualizarPaisDistribucion(proyectoId: string, paisId: string, datos: DatosPaisDistribucion) {
  return apiFetch<{ pais: FichaDistribucionPais }>(`/fichas-trazabilidad/${proyectoId}/distribucion/paises/${paisId}`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

export function eliminarPaisDistribucion(proyectoId: string, paisId: string) {
  return apiFetch<{ ok: true }>(`/fichas-trazabilidad/${proyectoId}/distribucion/paises/${paisId}`, {
    method: 'DELETE',
  });
}

// Título del libro — dueño rrpp, mismo rol que el resto de Sección 1
// (Perfil), pero escribe proyectos directamente (ruta propia, ver
// server/routes/proyectos.routes.ts).
export function actualizarTituloProyecto(proyectoId: string, titulo: string | null) {
  return apiFetch<{ proyecto: Proyecto }>(`/proyectos/${proyectoId}/titulo`, {
    method: 'PATCH',
    body: JSON.stringify({ titulo }),
  });
}

// El especialista dueño del proyecto elige a quién asignar como
// disenador — mismo patrón que fetchCargaEditores/fetchCargaEquipo
// (GET /disenadores/carga), pero acá lo consulta el especialista, no
// una jefatura.
export function fetchDisenadoresCarga() {
  return apiFetch<{ disenadores: CargaDisenador[] }>('/disenadores/carga');
}

// PATCH /proyectos/:id/disenador exige que quien llama sea el
// especialista dueño del proyecto (verificarAccesoAProyecto lo
// verifica del lado del servidor); no hay chequeo extra que hacer acá.
export function asignarDisenador(proyectoId: string, disenadorId: string) {
  return apiFetch<{ proyecto: Proyecto }>(`/proyectos/${proyectoId}/disenador`, {
    method: 'PATCH',
    body: JSON.stringify({ disenadorId }),
  });
}