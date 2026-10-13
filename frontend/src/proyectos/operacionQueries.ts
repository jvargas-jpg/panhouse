import type { QueryClient } from '@tanstack/react-query';
export function invalidarOperacion(cache: QueryClient, id: string) {
  for (const key of [['proyecto',id],['ficha',id],['ficha-viva',id],['solicitud'],['solicitudes'],['mi-trabajo'],['especialista-inicio'],['especialista-inicio-actividad'],['especialista-cartera'],['rrpp','launch','planes'],['rrpp','launch','detalle',id]]) {
    cache.invalidateQueries({queryKey:key});
  }
}
