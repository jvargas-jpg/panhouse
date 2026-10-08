export const TIPOS_DISENO = ['muestra_diagramacion', 'diagramacion', 'cubierta_extendida'] as const;
export type TipoDiseno = typeof TIPOS_DISENO[number];
// Manual §4.2.1-3. PENDIENTE_CONFIRMACION_CALENDARIO_SLA_DISENO:
// la fuente dice días sin definir hábiles/continuos. dueAt se pauta explícitamente.
export function diasReferenciaDiseno(tipo: TipoDiseno, condiciones: readonly string[] | null): number | null {
  if (tipo !== 'diagramacion') return 3;
  if (condiciones?.includes('Diagramación ultra especial')) return null;
  return condiciones?.includes('Diagramación especial') ? 15 : 5;
}
export function plazoDiseno(dueAt: Date | null, entregadoEn: Date | null, ahora = new Date()) {
  if (!dueAt) return null;
  if (entregadoEn) return entregadoEn > dueAt ? 'vencido' : 'en_tiempo';
  if (ahora > dueAt) return 'vencido';
  return dueAt.getTime() - ahora.getTime() <= 86400000 ? 'proximo_a_vencer' : 'en_tiempo';
}
