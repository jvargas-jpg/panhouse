import type { LibroAutor } from '../types/api';

// Traduce los ocho campos *Estatus de trazabilidad interna (jerga de
// producción: "edicionEstatus", "disenoEstatus"...) a una sola etiqueta
// amigable para el badge "Fase Actual" del autor — recorre de la fase
// más avanzada a la más temprana y devuelve la primera con estatus
// registrado, porque un estatus en una fase posterior implica que ya se
// completaron las anteriores (misma señal acumulativa que
// calcularFaseKanban en proyectos/MisProyectosPage.tsx).
const FASES_EN_ORDEN: Array<{ campo: keyof LibroAutor; etiqueta: string }> = [
  { campo: 'distribucionEstatus', etiqueta: 'Distribución' },
  { campo: 'impresionEstatus', etiqueta: 'Impresión' },
  { campo: 'lanzamientoEstatus', etiqueta: 'Lanzamiento' },
  { campo: 'digitalEstatus', etiqueta: 'Publicación Digital' },
  { campo: 'calidadEstatus', etiqueta: 'Control de Calidad' },
  { campo: 'disenoEstatus', etiqueta: 'Diseño Visual' },
  { campo: 'correccionEstatus', etiqueta: 'Corrección' },
  { campo: 'edicionEstatus', etiqueta: 'En Edición' },
];

export function calcularFaseActual(libro: LibroAutor): string {
  if (libro.estado === 'culminado') return 'Publicado';

  const faseActiva = FASES_EN_ORDEN.find((fase) => Boolean(libro[fase.campo]));
  return faseActiva?.etiqueta ?? 'Inicio';
}

// Stepper simplificado de LibroDetalleAutorPage.tsx — 4 hitos, no los 8
// reales (esos son jerga de producción). Mismo criterio acumulativo que
// calcularFaseActual, agrupado en 4 baldes en vez de 8.
export const HITOS_STEPPER = ['Inicio', 'Edición', 'Diseño', 'Publicación'] as const;

export function calcularPasoStepper(libro: LibroAutor): number {
  const enPublicacion =
    libro.estado === 'culminado' ||
    Boolean(libro.lanzamientoEstatus) ||
    Boolean(libro.digitalEstatus) ||
    Boolean(libro.impresionEstatus) ||
    Boolean(libro.distribucionEstatus);
  if (enPublicacion) return 4;

  const enDiseno = Boolean(libro.disenoEstatus) || Boolean(libro.calidadEstatus);
  if (enDiseno) return 3;

  const enEdicion = Boolean(libro.edicionEstatus) || Boolean(libro.correccionEstatus);
  if (enEdicion) return 2;

  return 1;
}
