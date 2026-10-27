/** Requested demonstration movements. Restricted to existing DEMO projects in local development. */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { db, pool } from '../server/db/client.js';
import { env } from '../server/config/env.js';
import { auditLogs, capitulos, editorialBlockers, proyectos, solicitudesArea, users, workItems } from '../server/db/schema/index.js';
import { sincronizarCapituloEditorial } from '../server/helpers/editorialInterventions.js';
import { actualizarCapituloEditor } from '../server/helpers/capitulos.js';
import { iniciarTrabajoEditorial, registrarAvanceEditorial } from '../server/helpers/editorialDeliveries.js';
import { reportarBloqueoEditorial, resolverBloqueoEditorial } from '../server/helpers/editorialBlockers.js';
import { crearRequestEditor, decidirRequestEditor, listarRequestsEditor, responderRequestEditor, cancelarRequestEditor } from '../server/helpers/editorOwnRequests.js';
import { listarMiTrabajo } from '../server/helpers/editorWork.js';
import { listarMisProyectos } from '../server/helpers/editorProjects.js';
import { registrarEvento } from '../server/helpers/auditLog.js';
import { diaCaracas } from '../server/helpers/atencionEspecialista.js';

const target = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/panhouse') throw Error('Only the existing local Panhouse development database is permitted');
const MARKER = 'EDITOR_DEMO_CARGA_20261027';
const folder = join(process.env.USERPROFILE!, '.codex', 'artifacts', 'panhouse-editor-demo-20261027');
await mkdir(folder, { recursive: true });
const client = await pool.connect();
try {
  if (!(await client.query('SELECT pg_try_advisory_lock(271020261) ok')).rows[0]?.ok) throw Error('A demonstration run is already in progress');
  const [editor] = await db.select().from(users).where(and(eq(users.rol, 'editor'), eq(users.activo, true)));
  const chiefs = await db.select().from(users).where(and(eq(users.rol, 'jefe_edicion'), eq(users.activo, true)));
  const chief = chiefs.find(u => u.nombre === 'Jefe Edición Demo') ?? chiefs[0];
  if (!editor || !chief) throw Error('An active Editor and Jefe de Edición are required');
  if ((await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.accion, MARKER)).limit(1)).length) {
    console.log('The requested demonstration movements were already prepared. No duplicates were created.');
  } else {
    const { rows: scope } = await pool.query<{ id: string; codigo: string; estado: string; especialista_id: string }>(`SELECT p.id,p.codigo,p.estado,p.especialista_id FROM proyectos p JOIN autores a ON a.id=p.autor_id WHERE p.editor_id=$1 AND a.nombre LIKE 'DEMO VARIOS %' ORDER BY p.codigo`, [editor.id]);
    if (scope.length < 8) throw Error('Not enough existing DEMO projects. No unrelated projects will be modified.');
    const ids = scope.map(p => p.id), today = diaCaracas(new Date());
    const before = { work: await listarMiTrabajo(editor.id, { tab: 'all', search: '', page: 1, pageSize: 50 }), requests: await listarRequestsEditor(editor.id, 'all', 1, 50) };
    await writeFile(join(folder, 'before.json'), JSON.stringify(before, null, 2));
    let materialized = 0, completed = 0, started = 0, reported = 0, cleared = 0;
    // Older demonstration chapters predate work-item synchronization. Materialize
    // those same interventions through the canonical helper, preserving their dates.
    const chapters = (await db.select().from(capitulos)).filter(c => ids.includes(c.proyectoId));
    for (const c of chapters) {
      const [existing] = await db.select({ id: workItems.id }).from(workItems).where(and(eq(workItems.proyectoId, c.proyectoId), eq(workItems.tipo, 'edicion'), eq(workItems.businessKey, 'capitulo:' + c.id)));
      if (!existing) { await db.transaction(tx => sincronizarCapituloEditorial(tx, c.id, 'crear')); materialized++; }
    }
    const active = scope.filter(p => ['en_proceso', 'retrasado'].includes(p.estado));
    const fullyReady = active.filter(p => { const own = chapters.filter(c => c.proyectoId === p.id); return own.length > 0 && own.every(c => c.fechaRespuestaReal); }).slice(0, 2);
    for (const p of fullyReady) for (const c of chapters.filter(c => c.proyectoId === p.id)) {
      await actualizarCapituloEditor(p.id, c.numero, { fechaEntregaEditor: today }, editor.id); completed++;
    }
    const remaining = active.filter(p => !fullyReady.some(x => x.id === p.id));
    for (const p of remaining.slice(0, 9)) {
      const c = chapters.find(c => c.proyectoId === p.id && !c.fechaInicioEditor && !c.fechaEntregaEditor);
      if (!c) continue;
      const [w] = await db.select().from(workItems).where(and(eq(workItems.proyectoId, p.id), eq(workItems.businessKey, 'capitulo:' + c.id)));
      await iniciarTrabajoEditorial(w!.id, editor.id);
      await registrarAvanceEditorial(w!.id, editor.id, 'Primera revisión de estructura realizada. Quedan pendientes los ajustes de estilo y la revisión de coherencia.'); started++;
    }
    for (const [index, p] of remaining.slice(0, 6).entries()) {
      const c = chapters.find(c => c.proyectoId === p.id && c.numero === 4 && !c.fechaEntregaEditor) ?? chapters.find(c => c.proyectoId === p.id && !c.fechaEntregaEditor);
      if (!c) continue;
      const [w] = await db.select().from(workItems).where(and(eq(workItems.proyectoId, p.id), eq(workItems.businessKey, 'capitulo:' + c.id)));
      const reasons = ['Falta confirmar cuál es la versión vigente del manuscrito.', 'Necesito el criterio editorial para reorganizar dos apartados.', 'Pendiente recibir la bibliografía actualizada del autor.'];
      const [open] = await db.select().from(editorialBlockers).where(and(eq(editorialBlockers.workItemId, w!.id), isNull(editorialBlockers.resolvedAt)));
      if (!open) { await reportarBloqueoEditorial(w!.id, reasons[index % reasons.length]!, editor.id); reported++; }
      if (index === 5) { await resolverBloqueoEditorial(w!.id, chief, 'Jefatura confirmó el criterio de trabajo y el Editor puede continuar con la versión acordada.'); cleared++; }
    }
    const { rows: candidates } = await pool.query<{ id: string; project_id: string; numero: number }>(`SELECT w.id,w.proyecto_id project_id,c.numero FROM work_items w JOIN capitulos c ON w.business_key='capitulo:'||c.id::text JOIN proyectos p ON p.id=w.proyecto_id WHERE w.proyecto_id=ANY($1::uuid[]) AND p.estado IN ('en_proceso','retrasado') AND w.tipo='edicion' AND w.estado IN ('pendiente','en_progreso','bloqueado') ORDER BY c.numero,p.codigo`, [ids]);
    const scenarios = [
      ['editor_apoyo', 'pending', 'Necesito una segunda revisión de la estructura antes de cerrar el capítulo.'],
      ['editor_apoyo', 'review', 'Necesito confirmar el criterio de estilo para continuar la revisión.'],
      ['editor_apoyo', 'return', 'Solicito apoyo para resolver diferencias entre dos versiones del texto.'],
      ['editor_apoyo', 'resolve', 'Necesito validar si debo conservar el orden actual de los apartados.'],
      ['editor_apoyo', 'cancel', 'Solicito apoyo para revisar la coherencia del cierre del capítulo.'],
      ['editor_apoyo', 'resend', 'Necesito una aclaración editorial sobre la secuencia narrativa.'],
      ['editor_reasignacion', 'pending', 'Solicito evaluar una redistribución porque coinciden varias entregas esta semana.'],
      ['editor_reasignacion', 'review', 'Solicito evaluar la carga actual para mantener la calidad de las próximas entregas.'],
      ['editor_reasignacion', 'return', 'Necesito que se revise mi disponibilidad para esta intervención.'],
      ['editor_apoyo', 'pending', 'Necesito acompañamiento para ajustar las referencias y citas del capítulo.'],
      ['editor_apoyo', 'resolve', 'Solicito confirmar el tratamiento de los nombres propios y las notas.'],
      ['editor_apoyo', 'return', 'Necesito apoyo con las observaciones recibidas para la siguiente versión.'],
      ['editor_apoyo', 'review', 'Solicito una revisión del enfoque antes de avanzar con los cambios.'],
      ['editor_apoyo', 'cancel', 'Necesito validar un detalle de continuidad antes de entregar.'],
      ['editor_aclaracion', 'pending', '¿Cuál es el documento de referencia que debo usar en esta revisión?'],
      ['editor_aclaracion', 'resolve', 'Necesito confirmar qué versión del manuscrito está aprobada para trabajar.'],
      ['editor_aclaracion', 'return', 'Necesito aclarar una observación del autor antes de continuar.'],
      ['editor_apoyo', 'pending', 'Solicito apoyo para revisar el cierre y sus conexiones con el siguiente capítulo.'],
    ] as const;
    const requests: { id: string; state: string; type: string; projectId: string }[] = [];
    for (const [index, [type, action, motivo]] of scenarios.entries()) {
      const w = candidates[index]; if (!w) throw Error('Not enough eligible DEMO interventions');
      const [existing] = await db.select().from(solicitudesArea).where(and(eq(solicitudesArea.workItemId, w.id), eq(solicitudesArea.tipo, type), eq(solicitudesArea.requestedById, editor.id), eq(solicitudesArea.descripcion, motivo)));
      const r = existing ?? await crearRequestEditor(editor.id, w.id, type, motivo);
      const specialistId = scope.find(p => p.id === w.project_id)!.especialista_id;
      const [specialist] = type === 'editor_aclaracion' ? await db.select().from(users).where(eq(users.id, specialistId)) : [chief];
      const recipient = specialist!;
      if (!existing) {
        if (action === 'review') await decidirRequestEditor(r.id, recipient, 1, 'review', 'Estamos revisando el contexto y la disponibilidad para atender esta solicitud.');
        if (action === 'return' || action === 'resend') await decidirRequestEditor(r.id, recipient, 1, 'return', type === 'editor_reasignacion' ? 'Indica las entregas que coinciden y la fecha en que podrías continuar.' : 'Indica el apartado concreto y la versión del documento sobre la que necesitas apoyo.');
        if (action === 'resend') await responderRequestEditor(r.id, editor.id, 2, 'La consulta corresponde al cierre del capítulo y a la versión de trabajo más reciente. Queda pendiente confirmar el criterio de continuidad.');
        if (action === 'resolve') await decidirRequestEditor(r.id, recipient, 1, 'resolve', type === 'editor_aclaracion' ? 'Trabaja con la versión más reciente compartida en la carpeta de entrada del proyecto.' : 'Conserva el orden acordado y aplica el criterio del manual editorial. Puedes continuar con la revisión.');
        if (action === 'cancel') await cancelarRequestEditor(r.id, editor.id, 1);
      }
      const [stored] = await db.select().from(solicitudesArea).where(eq(solicitudesArea.id, r.id));
      requests.push({ id: r.id, state: stored!.estado, type, projectId: w.project_id });
    }
    await db.transaction(tx => registrarEvento(tx, { actorId: chief.id, accion: MARKER, entityType: 'proyecto', entityId: scope[0]!.id, proyectoId: scope[0]!.id, detalles: { projectIds: ids, materialized, completed, started, reported, cleared, requestIds: requests.map(r => r.id) } }));
    const work = await listarMiTrabajo(editor.id, { tab: 'all', search: '', page: 1, pageSize: 50 });
    const reqs = await listarRequestsEditor(editor.id, 'all', 1, 50);
    const portfolio = await listarMisProyectos(editor.id, { search: '', page: 1, pageSize: 50, sort: 'priority' });
    const report = { at: new Date().toISOString(), editor: editor.nombre, chief: chief.nombre, scope: 'Existing local DEMO VARIOS projects only', projects: scope.length, materialized, completed, started, blockersReported: reported, blockersResolvedByChief: cleared, work: { total: work.total, counts: work.counts }, requests: { total: reqs.total, counts: reqs.counts, items: requests }, portfolio: portfolio.items.map(p => ({ code: p.code, state: p.stateLabel, counts: p.workCounts })) };
    await writeFile(join(folder, 'movements.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(271020261)'); client.release(); await pool.end();
}
