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

// Ciclo de aprobación de portada (Portal del Autor) — varchar en la
// base de datos, no un enum de Postgres (ver server/db/schema/enums.ts:
// DecisionPortada), mismo criterio en el frontend.
export type DecisionPortada = 'pendiente' | 'aprobada' | 'rechazada';

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
  // Botones "Notificar a RRPP" / "Notificar a Jefatura" de Fase 1
  // (ProyectoDetallePage.tsx) — ver POST /:id/notificar-rrpp y
  // POST /:id/notificar-jefatura, los dos pasos de la cascada.
  notificadoRrpp: boolean;
  notificadoJefatura: boolean;
  autor: { id: string; nombre: string };
  servicio: { id: string; codigo: string; nombre: string };
  riesgo: RiesgoProyecto;
}

// Perfil completo del autor (no solo id/nombre): ProyectoDetallePage.tsx
// lo muestra de solo lectura en la Sección 1 — ver SeccionProyectoPerfil.tsx.
// Mismos campos que Autor (más abajo), sin los de contacto/país (que no
// hacen falta en esa tarjeta).
export interface AutorConPerfil {
  id: string;
  nombre: string;
  nombreArtistico: string | null;
  nacionalidad: string | null;
  fechaNacimiento: string | null;
  redesSociales: RedesSociales | null;
  personalidad: string[] | null;
  ocupacion: string | null;
}

// GET /api/proyectos/:id/riesgo — única ruta migrada a coautoría hasta
// ahora (etapa aditiva, ver server/helpers/proyectosAutores.ts):
// `autores: []` reemplaza a `autor` solo en esta respuesta puntual.
// "Mis proyectos" (fetchMisProyectos) y el panel de jefatura
// (fetchProyectosRiesgo) siguen usando ProyectoConRiesgo tal cual, sin tocar.
export type ProyectoDetalleConAutores = Omit<ProyectoConRiesgo, 'autor'> & {
  autores: AutorConPerfil[];
};

// GET /api/fichas-trazabilidad/pendientes/perfil y /pendientes/contrato
// — mismo join autor/servicio que ProyectoConRiesgo pero sin riesgo
// (no se calcula acá, no aplica a esta lista). unidadId/presupuestoId/
// fechaProgramadaInicio opcionales a propósito: solo las listas
// "pendientes/*" (server/helpers/trazabilidad.ts) los traen —
// GET /proyectos/sin-editor reutiliza esta misma forma pero sale de una
// consulta distinta (listarProyectosSinEditor) que no los incluye.
export interface ProyectoPendienteSeccion1 {
  id: string;
  titulo: string | null;
  // Primer autor, por compatibilidad — ListaProyectosPendientes.tsx sigue
  // usándolo tal cual. `autores` (coautoría) es la lista completa —
  // ProyectosPendientesCrmList.tsx es el único consumidor migrado a ella.
  autor: { id: string; nombre: string };
  autores: { id: string; nombre: string }[];
  servicio: { id: string; codigo: string; nombre: string };
  unidadId?: string;
  presupuestoId?: string;
  fechaProgramadaInicio?: string;
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
  // sección 1 (parte 3) — Datos de ingreso. ingresoNombreArtistico/
  // ingresoNacionalidad/ingresoFechaNacimiento/ingresoRedesSociales/
  // ingresoPersonalidad/ingresoOcupacion se eliminaron: duplicaban los
  // campos del perfil del autor (ver Autor más abajo) — esos ahora se
  // muestran de solo lectura desde proyecto.autores, no se vuelven a
  // pedir acá.
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
// Perfil digital del autor — seis plataformas, todas opcionales. Mismo
// tipo que RedesSociales en server/db/schema/autores.ts (columna jsonb).
export interface RedesSociales {
  instagram?: string;
  x?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
}

// GET/POST /api/autores — fila completa de server/db/schema/autores.ts.
export interface Autor {
  id: string;
  nombre: string;
  nombreArtistico: string | null;
  nacionalidad: string | null;
  fechaNacimiento: string | null;
  redesSociales: RedesSociales | null;
  personalidad: string[] | null;
  ocupacion: string | null;
  email: string | null;
  telefono: string | null;
  pais: string | null;
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
  manuscritoUrl: string | null;
  propuestaPortadaUrl: string | null;
  portadaDecisionAutor: DecisionPortada;
  portadaFeedback: string | null;
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
  notificadoRrpp: boolean;
  notificadoJefatura: boolean;
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

// GET /api/proyectos (raíz) — jefatura/jefaturaApi.ts define su propio
// ProyectoResumen local con `autores: []` en vez de reexportar uno de
// acá (mismo patrón que ya tenía antes de la migración a coautoría, ver
// server/helpers/proyectosAutores.ts) — nada que declarar en este archivo.

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

// GET /api/notificaciones, PATCH /api/notificaciones/:id/leer — sistema
// global de alertas (hoy solo lo dispara la creación de un proyecto por
// comercial, ver server/helpers/proyectos.ts). El backend ya filtra por
// rolDestino === el rol de la sesión, así que lo que llega acá siempre
// es "mío".
export interface Notificacion {
  id: string;
  proyectoId: string | null;
  rolDestino: string;
  mensaje: string;
  leido: boolean;
  createdAt: string;
}

// GET /api/proyectos/mis-libros y PATCH /api/proyectos/:id/manuscrito —
// Portal del Autor (server/helpers/portalAutor.ts:LibroAutor). Forma
// deliberadamente angosta y separada de ProyectoConRiesgo: sin fechas/
// días de fase (control de tiempos interno) ni ids de asignación
// (escuadrón de producción), solo el estatus de texto de cada fase para
// el badge "Fase Actual" (ver portalAutor/faseAutor.ts).
export interface LibroAutor {
  id: string;
  titulo: string | null;
  estado: string;
  manuscritoUrl: string | null;
  servicio: { codigo: string; nombre: string };
  edicionEstatus: string | null;
  correccionEstatus: string | null;
  disenoEstatus: string | null;
  calidadEstatus: string | null;
  digitalEstatus: string | null;
  lanzamientoEstatus: string | null;
  impresionEstatus: string | null;
  distribucionEstatus: string | null;
  // Ciclo de aprobación de portada — el otro lado lo sube especialista/
  // disenador (PATCH /:id/propuesta-portada, interno); el autor decide
  // acá (PATCH /:id/decision-portada, ver portalAutorApi.ts).
  propuestaPortadaUrl: string | null;
  portadaDecisionAutor: DecisionPortada;
  portadaFeedback: string | null;
}

// GET /api/metricas/comercial — server/helpers/metricas.ts.
export interface KpisComerciales {
  clientesMesActual: number;
  clientesMesAnterior: number;
  // null cuando el mes anterior tuvo 0 clientes registrados (no hay
  // porcentaje de crecimiento real sobre cero) — el frontend lo muestra
  // como "Nuevo", no como un +100%/+Infinity% inventado.
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
