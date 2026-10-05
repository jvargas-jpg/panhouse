// Backfill (Fase 2, Foundation — ver docs/arquitectura/11-fase2-modelo-canonico.md §N):
// una fila en work_items por cada (proyecto, área) que ya tenga algún
// dato en las columnas legacy *Estatus/*Fecha*/*TotalDias/*Observaciones
// de fichas_trazabilidad. Idempotente: usa crearWorkItemSiNoExiste, así
// que correrlo dos veces no duplica nada.
//
// Deliberadamente NO intenta mapear el texto libre de *Estatus
// ('en curso', 'pendiente', 'Completado'...) al enum cerrado de
// work_items.estado — ese texto nunca fue un catálogo confirmado (ver
// el comentario de origen en server/db/schema/trazabilidad.ts), así que
// adivinar la correspondencia sería inventar una regla que el negocio
// no dio. En vez de eso: todo work item backfilleado nace 'pendiente'
// (default seguro) y el texto original de *Estatus se preserva tal
// cual, antepuesto a observaciones — ningún dato se pierde ni se
// reinterpreta.
//
// edicion es un caso especial (ver enums.ts, comentario de
// TIPOS_WORK_ITEM): solo sus columnas genéricas (estatus/observaciones)
// migran; edicionFechaEnvioEditor/FechaRecepcionEditor/FechaEnvioAutor/
// FechaAprobacionAutor son un ciclo específico de Edición, no el
// patrón genérico de las otras 7 áreas, y se quedan en fichas_trazabilidad.
import { isNotNull, or } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { db } from '../client.js';
import { fichasTrazabilidad } from '../schema/index.js';
import { crearWorkItemSiNoExiste } from '../../helpers/workItems.js';
import type { TipoWorkItem } from '../../helpers/workItems.js';

interface AreaGenerica {
  tipo: TipoWorkItem;
  estatus: keyof typeof fichasTrazabilidad.$inferSelect;
  fechaInicio?: keyof typeof fichasTrazabilidad.$inferSelect;
  fechaEntrega?: keyof typeof fichasTrazabilidad.$inferSelect;
  totalDias?: keyof typeof fichasTrazabilidad.$inferSelect;
  observaciones: keyof typeof fichasTrazabilidad.$inferSelect;
}

const AREAS: AreaGenerica[] = [
  { tipo: 'edicion', estatus: 'edicionEstatus', observaciones: 'edicionObservaciones' },
  {
    tipo: 'correccion',
    estatus: 'correccionEstatus',
    fechaInicio: 'correccionFechaInicio',
    fechaEntrega: 'correccionFechaEntrega',
    totalDias: 'correccionTotalDias',
    observaciones: 'correccionObservaciones',
  },
  {
    tipo: 'diseno',
    estatus: 'disenoEstatus',
    fechaInicio: 'disenoFechaInicio',
    fechaEntrega: 'disenoFechaEntrega',
    totalDias: 'disenoTotalDias',
    observaciones: 'disenoObservaciones',
  },
  {
    tipo: 'calidad',
    estatus: 'calidadEstatus',
    fechaInicio: 'calidadFechaInicio',
    fechaEntrega: 'calidadFechaEntrega',
    totalDias: 'calidadTotalDias',
    observaciones: 'calidadObservaciones',
  },
  {
    tipo: 'soporte_digital',
    estatus: 'digitalEstatus',
    fechaInicio: 'digitalFechaInicio',
    fechaEntrega: 'digitalFechaEntrega',
    totalDias: 'digitalTotalDias',
    observaciones: 'digitalObservaciones',
  },
  {
    tipo: 'lanzamiento',
    estatus: 'lanzamientoEstatus',
    fechaInicio: 'lanzamientoFechaInicio',
    fechaEntrega: 'lanzamientoFechaEntrega',
    totalDias: 'lanzamientoTotalDias',
    observaciones: 'lanzamientoObservaciones',
  },
  {
    tipo: 'impresion',
    estatus: 'impresionEstatus',
    fechaInicio: 'impresionFechaInicio',
    fechaEntrega: 'impresionFechaEntrega',
    totalDias: 'impresionTotalDias',
    observaciones: 'impresionObservaciones',
  },
  {
    tipo: 'distribucion',
    estatus: 'distribucionEstatus',
    fechaInicio: 'distribucionFechaInicio',
    fechaEntrega: 'distribucionFechaEntrega',
    totalDias: 'distribucionTotalDias',
    observaciones: 'distribucionObservaciones',
  },
];

export async function backfillWorkItemsDesdeFicha(): Promise<{ fichasRevisadas: number; workItemsCreados: number }> {
  const condiciones = AREAS.flatMap((area) =>
    [area.estatus, area.fechaInicio, area.fechaEntrega, area.totalDias, area.observaciones]
      .filter((col): col is keyof typeof fichasTrazabilidad.$inferSelect => Boolean(col))
      .map((col) => isNotNull(fichasTrazabilidad[col])),
  );

  const fichas = await db
    .select()
    .from(fichasTrazabilidad)
    .where(condiciones.length > 0 ? or(...condiciones) : undefined);

  let workItemsCreados = 0;

  await db.transaction(async (tx) => {
    for (const ficha of fichas) {
      for (const area of AREAS) {
        const estatusTexto = ficha[area.estatus] as string | null;
        const fechaInicioReal = area.fechaInicio ? (ficha[area.fechaInicio] as string | null) : null;
        const fechaFinReal = area.fechaEntrega ? (ficha[area.fechaEntrega] as string | null) : null;
        const observacionesOriginal = ficha[area.observaciones] as string | null;

        const tieneDatos = Boolean(estatusTexto || fechaInicioReal || fechaFinReal || observacionesOriginal);
        if (!tieneDatos) continue;

        const observaciones = estatusTexto
          ? `[Estatus original: ${estatusTexto}]${observacionesOriginal ? ` ${observacionesOriginal}` : ''}`
          : (observacionesOriginal ?? undefined);

        await crearWorkItemSiNoExiste(tx, { proyectoId: ficha.proyectoId, tipo: area.tipo, observaciones });
        workItemsCreados += 1;
      }
    }
  });

  return { fichasRevisadas: fichas.length, workItemsCreados };
}

// Ejecutable directo (tsx server/db/backfill/0001-work-items-desde-ficha.ts)
// además de importable/testeable — pathToFileURL (no comparar strings a
// mano) para que la comparación funcione igual en Windows y POSIX.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  backfillWorkItemsDesdeFicha()
    .then((resultado) => {
      console.log('Backfill work_items completo:', resultado);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error en backfill de work_items:', err);
      process.exit(1);
    });
}
