// Backfill (Fase 2, Foundation): una fila ACTIVA en project_assignments
// por cada FK de asignación actualmente no nula en `proyectos`
// (especialistaId/editorId/disenadorId/jefeAreaId/correctorId) — ver
// docs/arquitectura/11-fase2-modelo-canonico.md §N. Idempotente: si ya
// existe una asignación activa para ese (proyecto, tipo), no duplica
// nada (usa la misma condición de scope que asignarConHistorial).
//
// asignadoEn = proyectos.createdAt es una aproximación honesta, no un
// dato real de cuándo ocurrió la asignación histórica (ese hecho nunca
// se registró) — se documenta así, no se presenta como si fuera exacto.
// asignadoPorId queda null: quién hizo cada asignación histórica
// tampoco se registró nunca, y no hay forma de reconstruirlo sin
// inventar un responsable.
import { and, eq, isNull } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { db } from '../client.js';
import { projectAssignments, proyectos } from '../schema/index.js';
import type { TipoAsignacion } from '../schema/enums.js';

const MAPEO_FK_A_TIPO: { columna: 'especialistaId' | 'editorId' | 'disenadorId' | 'jefeAreaId' | 'correctorId'; tipo: TipoAsignacion }[] = [
  { columna: 'especialistaId', tipo: 'especialista' },
  { columna: 'editorId', tipo: 'editor' },
  { columna: 'disenadorId', tipo: 'disenador' },
  { columna: 'jefeAreaId', tipo: 'jefe_area' },
  { columna: 'correctorId', tipo: 'corrector' },
];

export async function backfillProjectAssignmentsDesdeFk(): Promise<{ proyectosRevisados: number; asignacionesCreadas: number }> {
  const filas = await db.select().from(proyectos);
  let asignacionesCreadas = 0;

  await db.transaction(async (tx) => {
    for (const proyecto of filas) {
      for (const { columna, tipo } of MAPEO_FK_A_TIPO) {
        const usuarioId = proyecto[columna];
        if (!usuarioId) continue;

        const [activaExistente] = await tx
          .select({ id: projectAssignments.id })
          .from(projectAssignments)
          .where(
            and(
              eq(projectAssignments.proyectoId, proyecto.id),
              eq(projectAssignments.tipo, tipo),
              isNull(projectAssignments.workItemId),
              isNull(projectAssignments.finalizadoEn),
            ),
          )
          .limit(1);
        if (activaExistente) continue;

        await tx.insert(projectAssignments).values({
          proyectoId: proyecto.id,
          tipo,
          usuarioId,
          asignadoPorId: null,
          asignadoEn: new Date(proyecto.createdAt),
        });
        asignacionesCreadas += 1;
      }
    }
  });

  return { proyectosRevisados: filas.length, asignacionesCreadas };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  backfillProjectAssignmentsDesdeFk()
    .then((resultado) => {
      console.log('Backfill project_assignments completo:', resultado);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error en backfill de project_assignments:', err);
      process.exit(1);
    });
}
