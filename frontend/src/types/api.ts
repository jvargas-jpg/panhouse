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

// GET /api/usuarios — personal interno para los selectores de
// SeccionEquipo.tsx. Subconjunto de Usuario (sin email): esta lista no
// necesita ese dato, y evitarlo reduce lo que expone un endpoint
// legible por cualquier jefe_area.
export interface UsuarioEquipo {
  id: string;
  nombre: string;
  rol: Rol;
}

// GET /api/seguimiento — "Control de Tiempos", matriz de rendimiento de
// jefe_area (server/helpers/seguimiento.ts). totalDias/totalHoras
// llegan como string: son columnas numeric de Postgres, node-postgres
// las devuelve como texto para no perder precisión.
export interface RegistroSeguimiento {
  id: string;
  proyecto: { id: string; autorNombre: string };
  analista: { id: string; nombre: string } | null;
  asignacionTipo: string | null;
  paginas: number | null;
  fechaAsignada: string | null;
  horaRecibida: string | null;
  fechaInicio: string | null;
  horaInicio: string | null;
  fechaEntrega: string | null;
  horaEntrega: string | null;
  estatus: string | null;
  totalDias: string | null;
  totalHoras: string | null;
  observaciones: string | null;
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
  especialistaId: string | null;
  editorId: string | null;
  correctorId: string | null;
  calidadId: string | null;
  digitalId: string | null;
  lanzamientoId: string | null;
  distribucionId: string | null;
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
  // sección 1 (parte 5) — Datos de ingreso, Equipo Editorial
  ingresoCoordinador: string | null;
  ingresoJefeDepartamento: string | null;
  ingresoEditor: string | null;
  ingresoCorrector: string | null;
  ingresoDisenador: string | null;
  ingresoCalidad: string | null;
  // sección 2
  edicionEstatus: string | null;
  edicionFechaEnvioEditor: string | null;
  edicionFechaRecepcionEditor: string | null;
  edicionFechaEnvioAutor: string | null;
  edicionFechaAprobacionAutor: string | null;
  edicionObservaciones: string | null;
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
  correccionEstatus: string | null;
  correccionTipoAsignacion: string | null;
  correccionFechaEnvio: string | null;
  correccionFechaInicio: string | null;
  correccionFechaEntrega: string | null;
  correccionTotalDias: string | null;
  correccionObservaciones: string | null;
  disenoBriefCreativo: string | null;
  disenoTipoPortada: TipoPortada | null;
  disenoFechaReunionCreativa: string | null;
  disenoFechaEntregaBrief: string | null;
  disenoBriefAprobadoFecha: string | null;
  disenoEstatus: string | null;
  disenoFechaInicio: string | null;
  disenoFechaEntrega: string | null;
  disenoTotalDias: string | null;
  disenoObservaciones: string | null;
  disenoPropuestas: FichaDisenoPropuesta[];
  calidadEstatus: string | null;
  calidadFechaInicio: string | null;
  calidadFechaEntrega: string | null;
  calidadTotalDias: string | null;
  calidadObservaciones: string | null;
  calidadFases: FichaCalidadFase[];
  soporteDigitalCuentaAmazon: string | null;
  soporteDigitalFechaEnvioFormulario: string | null;
  soporteDigitalFechaActivacion: string | null;
  digitalEstatus: string | null;
  digitalFechaInicio: string | null;
  digitalFechaEntrega: string | null;
  digitalTotalDias: string | null;
  digitalObservaciones: string | null;
  // sección 7 — nivelSatisfaccion queda como texto libre a propósito,
  // el tipo de dato exacto todavía no está confirmado (ver
  // server/db/schema/trazabilidad.ts).
  nivelSatisfaccion: string | null;
  lanzamientoEstatus: string | null;
  lanzamientoFechaInicio: string | null;
  lanzamientoFechaEntrega: string | null;
  lanzamientoTotalDias: string | null;
  lanzamientoObservaciones: string | null;
  lanzamientoReuniones: FichaLanzamientoReunion[];
  // sección 8
  impresionDeseaCotizacion: boolean | null;
  impresionResponsable: string | null;
  impresionEstadoCotizacion: EstadoCotizacionImpresion | null;
  impresionNotas: string | null;
  impresionEstatus: string | null;
  impresionFechaInicio: string | null;
  impresionFechaEntrega: string | null;
  impresionTotalDias: string | null;
  impresionObservaciones: string | null;
  distribucionEstatus: string | null;
  distribucionFechaInicio: string | null;
  distribucionFechaEntrega: string | null;
  distribucionTotalDias: string | null;
  distribucionObservaciones: string | null;
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
  calidadId: string | null;
  digitalId: string | null;
  lanzamientoId: string | null;
  distribucionId: string | null;
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

// GET /api/proyectos/activos — selector del módulo de pagos
// (RegistrarPagoPage.tsx). Mismo shape que server/helpers/proyectos.ts:ProyectoResumen.
export interface ProyectoResumen {
  id: string;
  titulo: string | null;
  estado: EstadoProyecto;
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
}

// POST/GET /api/pagos — módulo financiero de Comercial. Sin relación
// con proyectos.pagoCuota1..6 de arriba (checklist de seis cuotas fijas
// sin ruta propia) ni con el portal SSO de /api/portal/pagos/enlace:
// esto es el historial real de pagos recibidos por proyecto.
export interface Pago {
  id: string;
  proyectoId: string;
  monto: string;
  moneda: string;
  fechaPago: string;
  metodoPago: string;
  referencia: string | null;
  comprobanteUrl: string | null;
  estatus: string;
  motivoRechazo: string | null;
  proyecto: {
    id: string;
    titulo: string | null;
    autorNombre: string;
    servicioCodigo: string;
  };
}
