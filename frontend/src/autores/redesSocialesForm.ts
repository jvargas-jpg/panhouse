import type { RedesSociales } from '../types/api';

// Puente entre la UI dinámica de Redes Sociales (una fila por red
// agregada, ver SocialNetworksSection.tsx) y las columnas planas que ya
// existían en el payload/backend (RedesSociales, server/db/schema/autores.ts,
// columna jsonb). No se agrega ni renombra ningún campo: cada `id` de
// acá es exactamente una propiedad que el backend ya acepta.
//
// "X / Twitter" se guarda en el campo `x` (no `twitter` — así vivía el
// dato desde antes de esta pasada de UI).
export type PlataformaRedSocial = keyof RedesSociales;

export const PLATAFORMAS_REDES_SOCIALES: { id: PlataformaRedSocial; etiqueta: string; placeholder?: string }[] = [
  { id: 'x', etiqueta: 'X / Twitter', placeholder: '@usuario' },
  { id: 'instagram', etiqueta: 'Instagram', placeholder: '@usuario' },
  { id: 'facebook', etiqueta: 'Facebook' },
  { id: 'linkedin', etiqueta: 'LinkedIn' },
  { id: 'tiktok', etiqueta: 'TikTok', placeholder: '@usuario' },
  { id: 'youtube', etiqueta: 'YouTube' },
];

export interface FilaRedSocial {
  id: string;
  plataforma: PlataformaRedSocial;
  valor: string;
}

// Reconstruye las filas dinámicas a partir del objeto plano guardado —
// usado al precargar edición. Una fila por cada red que ya tiene valor;
// si el autor no tiene ninguna, la lista arranca vacía (no seis filas
// en blanco).
export function filasDesdeRedesSociales(redesSociales: RedesSociales | null): FilaRedSocial[] {
  if (!redesSociales) return [];
  return PLATAFORMAS_REDES_SOCIALES.filter((p) => redesSociales[p.id]).map((p) => ({
    id: crypto.randomUUID(),
    plataforma: p.id,
    valor: redesSociales[p.id] as string,
  }));
}

// Inverso: colapsa las filas dinámicas al mismo objeto plano que espera
// el payload — mismo criterio de siempre (solo entradas con algo
// escrito, recortadas; undefined si no queda ninguna, para que crear/
// editar sigan omitiendo/borrando el campo exactamente como antes).
export function redesSocialesDesdeFilas(filas: FilaRedSocial[]): RedesSociales | undefined {
  const entradas = filas.filter((f) => f.valor.trim() !== '').map((f) => [f.plataforma, f.valor.trim()] as const);
  if (entradas.length === 0) return undefined;
  return Object.fromEntries(entradas) as RedesSociales;
}
