// Estado derivado: no registra una entrega ni depende de campos de RRPP.
export const CAMPOS_COMERCIALES = ['autores', 'servicioId', 'unidadId', 'presupuestoId',
  'ingresoFechaIngreso', 'ingresoServicioEjecucion', 'ingresoServicioAlianza',
  'capitulosPactados', 'paginasPactadas'] as const;
export type FaltanteComercial = typeof CAMPOS_COMERCIALES[number];
export interface PreparacionComercial {
  listoParaRrpp: boolean;
  faltantesComercial: FaltanteComercial[];
}
export interface DatosPreparacionComercial {
  autores: readonly { id: string }[];
  servicioId: string | null | undefined;
  unidadId: string | null | undefined;
  presupuestoId: string | null | undefined;
  ingresoFechaIngreso: string | null | undefined;
  ingresoServicioEjecucion: string | null | undefined;
  ingresoServicioAlianza: boolean | null | undefined;
  capitulosPactados: string | null | undefined;
  paginasPactadas: string | null | undefined;
}
export function evaluarPreparacionComercial(datos: DatosPreparacionComercial): PreparacionComercial {
  const faltantesComercial = CAMPOS_COMERCIALES.filter((campo) => {
    if (campo === 'autores') return datos.autores.length === 0;
    if (campo === 'ingresoServicioAlianza') return datos[campo] == null;
    return !datos[campo]?.trim();
  });
  return { listoParaRrpp: faltantesComercial.length === 0, faltantesComercial };
}
