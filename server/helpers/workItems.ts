import { and, eq } from 'drizzle-orm';
import { workItems } from '../db/schema/index.js';
import type { Tx } from './tx.js';

// Catálogo de tipos de trabajo conocidos — union type en código, NO un
// pgEnum de base de datos (ver el comentario de `tipo` en
// server/db/schema/workItems.ts): "el proceso cambia", agregar un tipo
// nuevo es agregarlo acá, nunca una migración ALTER TYPE.
//
// SINGLETON (una sola instancia por proyecto, businessKey='default'):
// 'intake_rrpp' | 'asignacion_especialista'.
//
// REPEATABLE (múltiples instancias por proyecto, cada una con su propia
// businessKey — ej. 'ronda-2', 'correccion-2'): el resto. Se amplía a
// medida que cada pipeline de Fase 5 se implementa sobre fuentes reales
// (Manual del Especialista, matrices de Editores/Corrección/Creativa),
// nunca especulativamente.
export const TIPOS_WORK_ITEM_SINGLETON = ['intake_rrpp', 'asignacion_especialista'] as const;

export const TIPOS_WORK_ITEM_REPEATABLE = ['edicion', 'correccion', 'diseno', 'calidad', 'soporte_digital', 'lanzamiento', 'impresion', 'distribucion'] as const;

export const TIPOS_WORK_ITEM = [...TIPOS_WORK_ITEM_SINGLETON, ...TIPOS_WORK_ITEM_REPEATABLE] as const;

export type TipoWorkItem = (typeof TIPOS_WORK_ITEM)[number];

const BUSINESS_KEY_SINGLETON = 'default';

function esSingleton(tipo: TipoWorkItem): boolean {
  return (TIPOS_WORK_ITEM_SINGLETON as readonly string[]).includes(tipo);
}

// Crea la instancia si no existe todavía para este (proyecto, tipo,
// businessKey) — idempotente por el UNIQUE del schema: un segundo
// intento con la misma clave no duplica fila, solo devuelve la
// existente. No usa upsert "a ciegas" (no pisa un work item que ya
// avanzó de estado por reinsertarlo en 'pendiente').
//
// Para tipos SINGLETON, businessKey se ignora y siempre usa el default
// — un proyecto solo pasa por su intake de RRPP una vez, sin importar
// qué clave se pida. Para tipos REPEATABLE, businessKey identifica la
// instancia concreta (ej. 'ronda-2'); si se omite, cae también en
// 'default' — primera instancia implícita de ese tipo, válido para
// pipelines que hoy solo necesitan una (sección 2.6/2.8 de la ficha
// siguen siendo macro-resumen 1:1, ver docs/arquitectura/
// 11-fase2-modelo-canonico.md §J), y se amplía con businessKey real en
// cuanto el pipeline necesite más de una.
export async function crearWorkItemSiNoExiste(
  tx: Tx,
  input: { proyectoId: string; tipo: TipoWorkItem; businessKey?: string; pasoId?: string | null; observaciones?: string },
): Promise<string> {
  const businessKey = esSingleton(input.tipo) ? BUSINESS_KEY_SINGLETON : (input.businessKey ?? BUSINESS_KEY_SINGLETON);

  const [existente] = await tx
    .select({ id: workItems.id })
    .from(workItems)
    .where(and(eq(workItems.proyectoId, input.proyectoId), eq(workItems.tipo, input.tipo), eq(workItems.businessKey, businessKey)))
    .limit(1);
  if (existente) return existente.id;

  const [creado] = await tx
    .insert(workItems)
    .values({
      proyectoId: input.proyectoId,
      tipo: input.tipo,
      businessKey,
      pasoId: input.pasoId ?? null,
      observaciones: input.observaciones,
    })
    .returning({ id: workItems.id });
  if (!creado) throw new Error('El insert de work_items no devolvió ninguna fila');
  return creado.id;
}

// Transición de estado — no reemplaza proyectos.estado (macro) ni
// pretende ser un motor de estados genérico: solo mueve la fila de
// (proyecto, tipo, businessKey) al estado pedido, con fecha real de fin
// cuando corresponde. Idempotente en el sentido de que marcar
// 'completado' un work item que ya está 'completado' no falla, solo no
// hace nada.
export async function transicionarWorkItem(
  tx: Tx,
  input: { proyectoId: string; tipo: TipoWorkItem; businessKey?: string; estado: 'en_progreso' | 'bloqueado' | 'completado' | 'cancelado' },
): Promise<void> {
  const businessKey = input.businessKey ?? BUSINESS_KEY_SINGLETON;
  const [fila] = await tx
    .select({ id: workItems.id, estado: workItems.estado })
    .from(workItems)
    .where(and(eq(workItems.proyectoId, input.proyectoId), eq(workItems.tipo, input.tipo), eq(workItems.businessKey, businessKey)))
    .limit(1);
  if (!fila || fila.estado === input.estado) return;

  const fechaFinReal = input.estado === 'completado' ? new Date().toISOString().slice(0, 10) : undefined;
  await tx
    .update(workItems)
    .set({ estado: input.estado, ...(fechaFinReal ? { fechaFinReal } : {}) })
    .where(eq(workItems.id, fila.id));
}
