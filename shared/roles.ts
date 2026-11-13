// Canonical business and public API roles. Contexts are defined separately.
export const ROLES = [
  'comercial',
  'rrpp',
  'jefe_area',
  'especialista',
  'jefe_edicion',
  'editor',
  'lider_creativo',
  'disenador',
  // Fase 5 (5B Corrección) — rol de login para correctores INTERNOS
  // (ver comentario de `correcciones.correctorId`/`freelance` en
  // server/db/schema/correcciones.ts): un corrector freelance real
  // nunca tiene cuenta, así que este rol solo lo usa el roster corto de
  // correctores internos (Matriz: Francis/Paola/Carolina/etc.) que sí
  // necesitan "Mis Correcciones". No existía como rol de login hasta
  // ahora — ya existía como `proposito` de project_assignments (ver el
  // comentario ahí), que es un concepto distinto (quién corrigió ESTA
  // ronda, con o sin cuenta).
  'corrector',
  'validador',
  'soporte_digital',
  'impresion',
  // Dueño de la sección DISTRIBUCIÓN de la Ficha; RRPP solo deriva oportunidades.
  'distribucion',
  'cobranzas',
  'talento_humano',
  'direccion',
  'admin',
  'autor',
] as const;

export type Rol = (typeof ROLES)[number];

