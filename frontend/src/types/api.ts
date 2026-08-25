// Espejo manual del contrato real de server/routes/ y server/db/schema/
// (no hay monorepo/paquete compartido con el backend todavía). Si el
// backend cambia una forma de respuesta, este archivo se desactualiza
// en silencio — mantenerlo a mano hasta que exista algo mejor.
export const ROLES = [
  'comercial',
  'rrpp',
  'jefe_area',
  'especialista',
  'jefe_edicion',
  'editor',
  'lider_creativo',
  'disenador',
  'soporte_editorial',
  'soporte_digital',
  'impresion',
  'cobranzas',
  'talento_humano',
  'direccion',
  'autor',
] as const;

export type Rol = (typeof ROLES)[number];

export type EstadoProyecto = 'en_proceso' | 'retrasado' | 'stand_by' | 'pausado' | 'culminado' | 'retirado';

export type TipoPortada = 'tipografica' | 'fotografica' | 'ilustrada';

export type EstadoCotizacionImpresion = 'solicitada' | 'enviada' | 'aceptada' | 'rechazada';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface RiesgoProyecto {
  diasEfectivosTranscurridos: number;
  diasPlazo: number;
  diasRestantes: number;
  vencido: boolean;
  enRiesgo: boolean;
}

// GET /api/proyectos/mios y GET /api/proyectos/riesgo — misma forma en
// el backend (server/helpers/alertas.ts:listarProyectosConRiesgo), un
// solo join reutilizado en vez de duplicarlo por endpoint.
export interface ProyectoConRiesgo {
  id: string;
  titulo: string | null;
  estado: EstadoProyecto;
  fechaProgramadaInicio: string;
  fechaRealInicio: string | null;
  fechaDeseadaAutor: string | null;
  disenadorId: string | null;
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
  riesgo: RiesgoProyecto;
}

// GET /api/fichas-trazabilidad/pendientes/perfil y /pendientes/contrato
// — mismo join autor/servicio que ProyectoConRiesgo pero sin riesgo
// (no se calcula acá, no aplica a esta lista).
export interface ProyectoPendienteSeccion1 {
  id: string;
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
}

// GET /api/especialistas/carga y GET /api/editores/carga — misma forma
// para los dos (server/helpers/carga.ts:CargaUsuario generalizado), ya
// vienen ordenados de mayor a menor carga desde el backend.
export interface CargaEspecialista {
  id: string;
  nombre: string;
  email: string;
  carga: number;
}

export type CargaEditor = CargaEspecialista;
export type CargaDisenador = CargaEspecialista;

// GET /api/capitulos/:proyectoId — fila completa de server/db/schema/capitulos.ts.
export interface Capitulo {
  id: string;
  proyectoId: string;
  numero: number;
  fechaEnvioAutor: string | null;
  fechaPautadaFeedback: string | null;
  fechaRespuestaReal: string | null;
  enlaces: string[] | null;
  fechaInicioEditor: string | null;
  paginas: number | null;
  fechaEntregaEditor: string | null;
}

export type CausaPausa = 'autor' | 'otro_departamento';

// GET /api/pausas/:proyectoId — fila completa de server/db/schema/pausas.ts.
export interface Pausa {
  id: string;
  proyectoId: string;
  causa: CausaPausa;
  fechaInicio: string;
  fechaFin: string | null;
  esPausadoFormal: boolean;
  fechaLimiteRetoma: string | null;
  recargoAplica: boolean;
  pagoConfirmado: boolean;
}

// GET /api/fichas-trazabilidad/:proyectoId — server/helpers/trazabilidad.ts:obtenerFichaCompleta.
export interface FichaCalidadFase {
  id: string;
  numeroFase: number;
  pdfUrl: string | null;
  pdfVersion: string | null;
  fecha: string | null;
  aprobado: boolean | null;
}

export interface FichaDisenoPropuesta {
  id: string;
  fechaEnviadaEspecialista: string | null;
  fechaEnviadaAutor: string | null;
  fechaAprobadaAutor: string | null;
  estado: string | null;
  descripcion: string | null;
  enlace: string | null;
}

export interface FichaLanzamientoReunion {
  id: string;
  fecha: string | null;
  puntosTratados: string | null;
  acuerdos: string | null;
}

export interface FichaDistribucionPais {
  id: string;
  pais: string;
  porcentajeRegalias: string | null;
}

export interface FichaCompleta {
  proyectoId: string;
  // sección 1
  perfilAutor: string | null;
  publicoObjetivo: string | null;
  objetivosComerciales: string | null;
  capitulosPactados: number | null;
  paginasPactadas: number | null;
  // sección 1 (parte 3) — Datos de ingreso
  ingresoNombreArtistico: string | null;
  ingresoNacionalidad: string | null;
  ingresoFechaNacimiento: string | null;
  ingresoTipoProyecto: string | null;
  ingresoTipoProyectoDetalle: string | null;
  ingresoFechaIngreso: string | null;
  ingresoFechaCierre: string | null;
  ingresoFechaDeseada: string | null;
  ingresoTemaGeneral: string | null;
  ingresoServicioPerfil: string | null;
  ingresoServicioEjecucion: string | null;
  ingresoServicioAlianza: string | null;
  ingresoServicioPresupuesto: string | null;
  ingresoRedesSociales: string | null;
  ingresoPersonalidad: string | null;
  ingresoOcupacion: string | null;
  ingresoObservaciones: string | null;
  // sección 1 (parte 4) — Datos de ingreso, especificaciones del proyecto
  ingresoPosibleTitulo: string | null;
  ingresoColeccion: string | null;
  ingresoPublicoSexo: string | null;
  ingresoPublicoEdad: string | null;
  ingresoPublicoPerfil: string | null;
  ingresoPropositoSocial: string | null;
  ingresoObjetivoComercial: string | null;
  ingresoTonoEstilo: string | null;
  ingresoCriterioExtra: string | null;
  ingresoCondicionesEspeciales: string | null;
  ingresoObservacionesEquipo: string | null;
  // sección 3
  correccionTripaCompleta: string | null;
  correccionTripaCompletaFechaEntrega: string | null;
  correccionTripaCompletaAprobado: boolean | null;
  correccionPreliminares: string | null;
  correccionPreliminaresFechaEntrega: string | null;
  correccionPreliminaresAprobado: boolean | null;
  correccionCubiertaExtendida: string | null;
  correccionCubiertaExtendidaFechaEntrega: string | null;
  correccionCubiertaExtendidaAprobado: boolean | null;
  disenoBriefCreativo: string | null;
  disenoTipoPortada: TipoPortada | null;
  disenoFechaReunionCreativa: string | null;
  disenoFechaEntregaBrief: string | null;
  disenoBriefAprobadoFecha: string | null;
  disenoPropuestas: FichaDisenoPropuesta[];
  calidadFases: FichaCalidadFase[];
  soporteDigitalCuentaAmazon: string | null;
  soporteDigitalFechaEnvioFormulario: string | null;
  soporteDigitalFechaActivacion: string | null;
  // sección 7 — nivelSatisfaccion queda como texto libre a propósito,
  // el tipo de dato exacto todavía no está confirmado (ver
  // server/db/schema/trazabilidad.ts).
  nivelSatisfaccion: string | null;
  lanzamientoReuniones: FichaLanzamientoReunion[];
  // sección 8
  impresionDeseaCotizacion: boolean | null;
  impresionResponsable: string | null;
  impresionEstadoCotizacion: EstadoCotizacionImpresion | null;
  impresionNotas: string | null;
  distribucionPaises: FichaDistribucionPais[];
}
// GET/POST /api/autores — fila completa de server/db/schema/autores.ts.
// relevancia es un dato interno de gestión, nunca se expone al autor.
export interface Autor {
  id: string;
  nombre: string;
  nombreArtistico: string | null;
  nacionalidad: string | null;
  fechaNacimiento: string | null;
  redesSociales: string | null;
  email: string | null;
  telefono: string | null;
  pais: string | null;
  relevancia: number | null;
}

// GET /api/catalogos — para el formulario de creación de proyecto.
export interface Servicio {
  id: string;
  codigo: string;
  nombre: string;
}

export interface Unidad {
  id: string;
  nombre: string;
}

export interface Presupuesto {
  id: string;
  nombre: string;
}

export interface Catalogos {
  servicios: Servicio[];
  unidades: Unidad[];
  presupuestos: Presupuesto[];
}

// POST /api/proyectos — fila completa de server/db/schema/proyectos.ts.
export interface Proyecto {
  id: string;
  titulo: string | null;
  autorId: string;
  servicioId: string;
  unidadId: string;
  presupuestoId: string;
  coleccionId: string | null;
  especialistaId: string | null;
  editorId: string | null;
  correctorId: string | null;
  disenadorId: string | null;
  estado: EstadoProyecto;
  fechaProgramadaInicio: string;
  fechaRealInicio: string | null;
  fechaDeseadaAutor: string | null;
  fechaFinProyectada: string | null;
  fechaProcesoIngreso: string | null;
  fechaExtraccionContenido: string | null;
  fechaCreacionContenido: string | null;
  fechaFeedbackTripa: string | null;
  fechaAsignacionCorreccion: string | null;
  fechaAsignacionDiseno: string | null;
  fechaTripaDiagramada: string | null;
  fechaAprobacionFinal: string | null;
  contratoFirmado: boolean;
  pagoCuota1: boolean;
  pagoCuota2: boolean;
  pagoCuota3: boolean;
  pagoCuota4: boolean;
  pagoCuota5: boolean;
  pagoCuota6: boolean;
}

// GET /api/proyectos/sin-editor — misma forma que ProyectoPendienteSeccion1
// (id, autor, servicio, sin riesgo), se reutiliza el tipo tal cual.
