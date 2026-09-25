import { apiFetch } from '../lib/api';
import type {
  AsesoriaEstado,
  AsesoriaFase,
  AsesoriaFeriaAParticipar,
  AsesoriaFeriaProyectada,
  AsesoriaFuturoAutor,
  AsesoriaNivelSatisfaccion,
  AsesoriaResponsableDistribucion,
  AsesoriaResponsableImpresion,
  Capitulo,
  CargaDisenador,
  CausaPausa,
  ColeccionPanhouse,
  CondicionEspecial,
  EjecucionServicio,
  EstadoCotizacionImpresion,
  EstadoReunion,
  FichaCalidadFase,
  FichaCompleta,
  FichaDisenoPropuesta,
  FichaDistribucionPais,
  FichaLanzamientoReunion,
  ParticipacionFerias,
  Pausa,
  PresupuestoServicio,
  PropietarioMatrizIngreso,
  Proyecto,
  ProyectoDetalleConAutores,
  PublicoSexo,
  SubtipoCrudo,
  TipoPortada,
  UsuarioEquipo,
} from '../types/api';
// Misma forma que "mis proyectos" / "proyectos en riesgo" (ProyectoConRiesgo),
// salvo que autor (singular) es autores: [] — GET /:id/riesgo migró a
// coautoría, ver ProyectoDetalleConAutores en types/api.ts.
export function fetchProyecto(proyectoId: string) {
  return apiFetch<{ proyecto: ProyectoDetalleConAutores }>(`/proyectos/${proyectoId}/riesgo`);
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

// Sección 1, dueño rrpp. perfilAutor/objetivosComerciales
// ("Resumen y Objetivos"), ingresoServicioPerfil (redundante con
// autor.categoria) e ingresoPublicoSexo/ingresoPublicoEdad/
// ingresoPublicoPerfil/ingresoCantidadCapitulos/ingresoHojasDiagramadas/
// ingresoCriterioExtra/ingresoCondicionesEspeciales/
// ingresoObservacionesEquipo/ingresoCoordinador/ingresoJefeDepartamento/
// ingresoEditor/ingresoCorrector/ingresoDisenador/ingresoCalidad
// ("Audiencia y Propósito", "Parámetros Técnicos y Equipo", "Equipo
// Editorial (Ingreso)") se eliminaron a pedido explícito del negocio —
// ver el comentario en server/db/schema/trazabilidad.ts.
export interface DatosSeccionProyectoPerfil {
  ingresoFechaIngreso?: string | null;
  ingresoFechaCierre?: string | null;
  // Solo tiene sentido cuando el servicio contratado es 'Crudo' — RRPP
  // lo llena después de que Comercial crea el proyecto (ver el
  // useEffect de cálculo de Fecha de Cierre en SeccionProyectoPerfil.tsx).
  ingresoServicioSubtipoCrudo?: SubtipoCrudo | null;
  // Sin null: mismo criterio que autores.categoria (ver server/routes/
  // autores.routes.ts) — son NOT NULL en la base, omitirlas en un PATCH
  // deja el valor actual intacto.
  ingresoServicioEjecucion?: EjecucionServicio;
  // Obligatorio cuando ingresoServicioEjecucion se manda como 'Express'
  // (ver el .superRefine de seccionProyectoPerfilSchema en el backend).
  ingresoTiempoExpresMeses?: number | null;
  ingresoServicioAlianza?: boolean;
  ingresoServicioPresupuesto?: PresupuestoServicio | null;
  ingresoObservaciones?: string | null;
}

export function actualizarSeccionProyectoPerfil(proyectoId: string, datos: DatosSeccionProyectoPerfil) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/proyecto-perfil`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Sección 1, dueño comercial — aparte del resto del perfil a propósito
// (permiso más angosto: solo comercial, ver ProyectoDetallePage.tsx),
// aunque ambas viven en la misma tarjeta/formulario, ver
// SeccionProyectoPerfil.tsx. capitulosPactados/paginasPactadas: string,
// no number — <select> de opciones predefinidas.
export interface DatosSeccionProyectoContrato {
  capitulosPactados?: string | null;
  paginasPactadas?: string | null;
  criterioExtra?: string | null;
  condicionesEspeciales?: CondicionEspecial[] | null;
}

export function actualizarSeccionProyectoContrato(proyectoId: string, datos: DatosSeccionProyectoContrato) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/proyecto-contrato`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// "Ficha Editorial (Completado por RRPP)" — dueño rrpp/jefe_area, no
// comercial (a diferencia de las dos secciones de arriba).
export interface DatosSeccionFichaEditorial {
  fechaDeseadaCulminacion?: string | null;
  temaGeneral?: string | null;
  posibleTituloLibro?: string | null;
  coleccionPanhouse?: ColeccionPanhouse | null;
  tonoEstilo?: string | null;
  publicoSexo?: PublicoSexo | null;
  publicoEdad?: string | null;
  publicoPerfil?: string | null;
  propositoSocial?: string | null;
  objetivoComercial?: string[] | null;
}

export function actualizarSeccionFichaEditorial(proyectoId: string, datos: DatosSeccionFichaEditorial) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/ficha-editorial`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// "Matriz de Ingreso (RRPP)" — dueño rrpp/jefe_area, mismo alcance que
// DatosSeccionFichaEditorial arriba.
export interface DatosSeccionMatrizIngreso {
  matrizCiudadResidencia?: string | null;
  matrizEstadoReunion?: EstadoReunion | null;
  matrizPropietario?: PropietarioMatrizIngreso | null;
  matrizContratoFirmado?: boolean;
  matrizBienvenidaGenerada?: boolean;
  matrizLinkResumen?: string | null;
  matrizDiagnosticoGenerado?: boolean;
  matrizLinkDiagnostico?: string | null;
  matrizIngresoGenerado?: boolean;
  matrizFechaReunionCreativa?: string | null;
  matrizVentaCruzada?: string[] | null;
  matrizObservacionesComerciales?: string | null;
}

export function actualizarSeccionMatrizIngreso(proyectoId: string, datos: DatosSeccionMatrizIngreso) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/matriz-ingreso`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// "Proceso de Lanzamiento y Promoción" (Área exclusiva de RRPP, Fase 1)
// — dueño rrpp/jefe_area, mismo alcance que DatosSeccionMatrizIngreso
// arriba. NO es la Sección 7 "Lanzamiento y promoción" (ver
// DatosSeccionLanzamientoGeneral/DatosReunionLanzamiento más abajo).
export interface DatosSeccionLanzamientoPromocion {
  lanzamientoPromocionFechaPrimeraReunion?: string | null;
  lanzamientoPromocionEncargadoPrimeraReunion?: PropietarioMatrizIngreso | null;
  lanzamientoPromocionPuntosTratadosPrimera?: string | null;
  lanzamientoPromocionFechaSegundaReunion?: string | null;
  lanzamientoPromocionEncargadoSegundaReunion?: PropietarioMatrizIngreso | null;
  lanzamientoPromocionAcuerdosSegunda?: string | null;
  lanzamientoPromocionObjetivoComercial?: string | null;
  lanzamientoPromocionParticipacionFerias?: ParticipacionFerias | null;
  lanzamientoPromocionIsbn?: string | null;
  lanzamientoPromocionDetallesProyeccion?: string | null;
  lanzamientoPromocionFechaTentativa?: string | null;
  lanzamientoPromocionTipo?: string | null;
  lanzamientoPromocionObservaciones?: string | null;
  lanzamientoPromocionObservacionesGenerales?: string | null;
  lanzamientoPromocionLinkMinuta?: string | null;
}

export function actualizarSeccionLanzamientoPromocion(proyectoId: string, datos: DatosSeccionLanzamientoPromocion) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/lanzamiento-promocion`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// "Matriz de Asesorías con fechas" (módulo de RRPP, debajo de Matriz de
// Ingreso) — dueño rrpp/jefe_area, mismo alcance que
// DatosSeccionMatrizIngreso arriba.
export interface DatosSeccionMatrizAsesorias {
  asesoriaEstado?: AsesoriaEstado | null;
  asesoriaEspecialistaResponsable?: string | null;
  asesoriaFechaPrimeraReunion?: string | null;
  asesoriaFechaSegundaReunion?: string | null;
  asesoriaFechaAdicional?: string | null;
  asesoriaIsbnPais?: string | null;
  asesoriaNivelSatisfaccion?: AsesoriaNivelSatisfaccion | null;
  asesoriaFase?: AsesoriaFase | null;
  asesoriaFechaSugeridaGe?: string | null;
  asesoriaFechaPautadaAutor?: string | null;
  asesoriaFeriaProyectada?: AsesoriaFeriaProyectada | null;
  asesoriaNotas?: string | null;
  asesoriaLinkMinutaGerencia?: string | null;
  asesoriaRutaPromocionEnviada?: boolean;
  asesoriaLinkRutaPromocion?: string | null;
  asesoriaFuturoAutor?: AsesoriaFuturoAutor | null;
  asesoriaInfoFeriaEnviada?: boolean;
  asesoriaParticipacionFeria?: boolean;
  asesoriaFeriaAParticipar?: AsesoriaFeriaAParticipar | null;
  asesoriaCotizacionImpresion?: boolean;
  asesoriaResponsableImpresion?: AsesoriaResponsableImpresion | null;
  asesoriaFechaCotizacionSolicitada?: string | null;
  asesoriaFechaCotizacionEnviada?: string | null;
  asesoriaCotizacionAceptada?: boolean;
  asesoriaDistribucionAceptada?: boolean;
  asesoriaResponsableDistribucion?: AsesoriaResponsableDistribucion | null;
  asesoriaNotaDistribucion?: string | null;
  asesoriaFechaContratoEnviado?: string | null;
  asesoriaContratoRecibidoFirmado?: boolean;
}

export function actualizarSeccionMatrizAsesorias(proyectoId: string, datos: DatosSeccionMatrizAsesorias) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/matriz-asesorias`, {
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

// Sección 2, dueño especialista (mismo dueño que Corrección) — vista de
// conjunto de la sección, coexiste con el detalle por capítulo en
// capitulos.ts.
export interface DatosSeccionEdicion {
  edicionEstatus?: string | null;
  edicionFechaEnvioEditor?: string | null;
  edicionFechaRecepcionEditor?: string | null;
  edicionFechaEnvioAutor?: string | null;
  edicionFechaAprobacionAutor?: string | null;
  edicionObservaciones?: string | null;
}

export function actualizarSeccionEdicion(proyectoId: string, datos: DatosSeccionEdicion) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/edicion`, {
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
  correccionEstatus?: string | null;
  correccionTipoAsignacion?: string | null;
  correccionFechaEnvio?: string | null;
  correccionFechaInicio?: string | null;
  correccionFechaEntrega?: string | null;
  correccionTotalDias?: string | null;
  correccionObservaciones?: string | null;
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

// Sección 4 (parte 2), dueño doble: el especialista dueño del proyecto
// o el disenador asignado (ver PATCH /:proyectoId/diseno-control) — a
// diferencia del brief/propuestas de arriba, que son solo de
// disenador/lider_creativo.
export interface DatosSeccionDisenoControl {
  disenoEstatus?: string | null;
  disenoFechaInicio?: string | null;
  disenoFechaEntrega?: string | null;
  disenoTotalDias?: string | null;
  disenoObservaciones?: string | null;
}

export function actualizarSeccionDisenoControl(proyectoId: string, datos: DatosSeccionDisenoControl) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/diseno-control`, {
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

// Sección 5 (parte 2), dueño doble: el especialista dueño del proyecto
// o el analista de calidad asignado (ver PATCH /:proyectoId/calidad-control)
// — a diferencia de las fases de abajo, que son de soporte_editorial
// como grupo (sin chequeo de dueño individual).
export interface DatosSeccionCalidadControl {
  calidadEstatus?: string | null;
  calidadFechaInicio?: string | null;
  calidadFechaEntrega?: string | null;
  calidadTotalDias?: string | null;
  calidadObservaciones?: string | null;
}

export function actualizarSeccionCalidadControl(proyectoId: string, datos: DatosSeccionCalidadControl) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/calidad-control`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
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

// Sección 6 (parte 2), dueño doble: el especialista dueño del proyecto
// o el encargado digital asignado (ver PATCH /:proyectoId/digital-control)
// — a diferencia de cuentaAmazon/fechaEnvioFormulario/fechaActivacion de
// arriba, que son de soporte_digital como grupo (sin chequeo de dueño
// individual).
export interface DatosSeccionDigitalControl {
  digitalEstatus?: string | null;
  digitalFechaInicio?: string | null;
  digitalFechaEntrega?: string | null;
  digitalTotalDias?: string | null;
  digitalObservaciones?: string | null;
}

export function actualizarSeccionDigitalControl(proyectoId: string, datos: DatosSeccionDigitalControl) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/digital-control`, {
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

// Sección 7 (parte 3), dueño doble: el especialista dueño del proyecto
// o el responsable de lanzamiento asignado (ver PATCH
// /:proyectoId/lanzamiento-control) — a diferencia de nivelSatisfaccion/
// reuniones de arriba, que son de rrpp como grupo (sin chequeo de dueño
// individual).
export interface DatosSeccionLanzamientoControl {
  lanzamientoEstatus?: string | null;
  lanzamientoFechaInicio?: string | null;
  lanzamientoFechaEntrega?: string | null;
  lanzamientoTotalDias?: string | null;
  lanzamientoObservaciones?: string | null;
}

export function actualizarSeccionLanzamientoControl(proyectoId: string, datos: DatosSeccionLanzamientoControl) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/lanzamiento-control`, {
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
  // Sección 8 (parte 2) — estatus agregado (macro), mismo dueño (rrpp/
  // jefe_area) que el resto de esta sección — sin dueño individual.
  impresionEstatus?: string | null;
  impresionFechaInicio?: string | null;
  impresionFechaEntrega?: string | null;
  impresionTotalDias?: string | null;
  impresionObservaciones?: string | null;
}

export function actualizarSeccionImpresion(proyectoId: string, datos: DatosSeccionImpresion) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/impresion`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
  });
}

// Sección 9 (parte 2), dueño doble: el especialista dueño del proyecto
// o el responsable logístico asignado (ver PATCH
// /:proyectoId/distribucion-control) — a diferencia de los países de
// abajo, que son de rrpp como grupo (sin chequeo de dueño individual).
export interface DatosSeccionDistribucionControl {
  distribucionEstatus?: string | null;
  distribucionFechaInicio?: string | null;
  distribucionFechaEntrega?: string | null;
  distribucionTotalDias?: string | null;
  distribucionObservaciones?: string | null;
}

export function actualizarSeccionDistribucionControl(proyectoId: string, datos: DatosSeccionDistribucionControl) {
  return apiFetch<{ ficha: FichaCompleta }>(`/fichas-trazabilidad/${proyectoId}/distribucion-control`, {
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

// Personal de la editorial para los selectores de SeccionEquipo.tsx —
// restringido a jefe_area en el backend (server/routes/usuarios.routes.ts).
export function fetchPersonalEquipo() {
  return apiFetch<{ usuarios: UsuarioEquipo[] }>('/usuarios');
}

// "Equipo asignado" (antes "Escuadrón de Producción") — las columnas de
// asignación de un proyecto en un solo PATCH, dueño jefe_area (ver
// DatosEquipoProyecto en server/helpers/proyectos.ts). null limpia una
// asignación existente.
export interface DatosEquipoProyecto {
  especialistaId?: string | null;
  editorId?: string | null;
  correctorId?: string | null;
  disenadorId?: string | null;
  jefeAreaId?: string | null;
}

export function actualizarEquipoProyecto(proyectoId: string, datos: DatosEquipoProyecto) {
  return apiFetch<{ proyecto: Proyecto }>(`/proyectos/${proyectoId}/equipo`, {
    method: 'PATCH',
    body: JSON.stringify(datos),
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