// Fuente: Matriz real, tipos históricos + validaciones; no catálogo de ejemplo.
export const TIPOS_EVENTO_RRPP = [
  "Conferencia",
  "Feria de Bogotá",
  "Lanzamiento",
  "Lanzamiento en Amazon",
  "Lanzamiento en feria",
  "Colegio Champagnat",
  "Feria",
  "Revelación de portada",
  "Presentación en feria",
  "Presentación",
  "Exposición",
  "Lanzamiento digital",
  "Firma de libros",
  "Bautizo",
  "Acompañamiento",
  "RRPP",
] as const;
export const ESTADOS_EVENTO_RRPP = [
  "No iniciada",
  "En curso",
  "Bloqueada",
  "Completada",
] as const;
export const FASES_EVENTO_RRPP = [
  "Antes del evento",
  "El mismo día",
  "Tras el evento",
  "Finalizado el evento",
] as const;
export const TIPOS_PUBLICACION_RRPP = ["Futuro Autor", "Novedades"] as const;
export const ESTADOS_PUBLICACION_RRPP = [
  "Nuevo",
  "En curso",
  "En revisión",
  "Publicado",
  "Suspendido",
  "En pausa",
] as const;
export const ESTADOS_PIEZA_FUTURO = [
  "pieza en desarrollo",
  "Pieza para aprobación",
  "Pieza aprobada",
  "Publicado",
] as const;
export const ESTADOS_PIEZA_NOVEDADES = [
  "pieza en desarrollo",
  "Con pieza lista",
  "Publicado",
] as const;
export const VENTA_CRUZADA_RRPP = [
  "Feria",
  "Distribución",
  "Impresión",
  "REDES SOCIALES",
  "Siguiente libro",
  "Campus Lector 3.0",
  "PLAN LECTOR",
  "Conferencias",
  "Brochure",
  "Paquete piezas para redes",
] as const;
export const EVENTOS_LANZAMIENTO_RRPP = {
  PLANIFICACION_RRPP_CREADA: "Planificación RRPP habilitada",
  PLANIFICACION_RRPP_ACTUALIZADA: "Plan de lanzamiento actualizado",
  RESPONSABLE_RRPP_ASIGNADO: "Responsable RRPP asignado",
  REUNION_LANZAMIENTO_REGISTRADA: "Reunión de lanzamiento registrada",
  REUNION_LANZAMIENTO_ELIMINADA: "Reunión de lanzamiento eliminada",
  FECHA_LANZAMIENTO_MODIFICADA: "Fecha de lanzamiento actualizada",
  RUTA_PROMOCION_ACTUALIZADA: "Ruta de promoción actualizada",
  RUTA_PROMOCION_ENVIADA: "Ruta de promoción enviada al autor",
  FERIA_RRPP_ACTUALIZADA: "Participación en feria actualizada",
  SATISFACCION_RRPP_REGISTRADA: "Nivel de satisfacción registrado",
  OPORTUNIDAD_RRPP_REGISTRADA: "Oportunidad de postventa registrada",
  EVENTO_RRPP_PROGRAMADO: "Evento RRPP programado",
  EVENTO_RRPP_ACTUALIZADO: "Evento RRPP actualizado",
  PUBLICACION_RRPP_REGISTRADA: "Publicación en redes registrada",
  PUBLICACION_RRPP_ACTUALIZADA: "Publicación en redes actualizada",
  PUBLICACION_RRPP_REALIZADA: "Publicación en redes realizada",
  LANZAMIENTO_RRPP_CULMINADO: "Lanzamiento culminado",
} as const;
