/** Domain fixtures live only in the named isolated local QA database. */
import 'dotenv/config';
import { eq, and } from 'drizzle-orm';
const target = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw Error('Local QA only');
target.pathname = '/panhouse_editor_preview_20261026'; process.env.DATABASE_URL = target.toString(); process.env.NODE_ENV = 'development';
const { db, pool } = await import('../server/db/client.js');
const { users, proyectos, proyectosAutores, autores, servicios, unidades, presupuestos, workItems, solicitudesArea, capitulos } = await import('../server/db/schema/index.js');
const { asignarEditor, solicitarEditor } = await import('../server/helpers/proyectos.js');
const { crearCapitulo } = await import('../server/helpers/capitulos.js');
const { crearRequestEditor, decidirRequestEditor, cancelarRequestEditor } = await import('../server/helpers/editorOwnRequests.js');
const [editor] = await db.select().from(users).where(eq(users.email, 'editor@edicion.qa.test'));
const [other] = await db.select().from(users).where(eq(users.email, 'editor-b@edicion.qa.test'));
const [chief] = await db.select().from(users).where(eq(users.rol, 'jefe_edicion'));
const [specialist] = await db.select().from(users).where(eq(users.rol, 'especialista'));
const [service] = await db.select().from(servicios), [unit] = await db.select().from(unidades), [budget] = await db.select().from(presupuestos);
if (!editor || !other || !chief || !specialist || !service || !unit || !budget) throw Error('Start the isolated Editor QA preview first');
async function project(code: string, owner: typeof editor) {
  const [existing] = await db.select().from(proyectos).where(eq(proyectos.codigo, code)); if (existing) return existing;
  const [a] = await db.insert(autores).values({ nombre: 'Autor de prueba de solicitudes' }).returning();
  const [p] = await db.insert(proyectos).values({ codigo: code, titulo: 'Verificación de solicitudes editoriales', autorId: a!.id, servicioId: service!.id, unidadId: unit!.id, presupuestoId: budget!.id, especialistaId: specialist!.id, fechaProgramadaInicio: '2026-10-27' }).returning();
  await db.insert(proyectosAutores).values({ proyectoId: p!.id, autorId: a!.id });
  await solicitarEditor(p!.id, specialist!.id); await asignarEditor(p!.id, owner!.id, chief!.id); return p!;
}
const p = await project('REQ-QA', editor);
for (let n = 1; n <= 16; n++) {
  if (!(await db.select({id:capitulos.id}).from(capitulos).where(and(eq(capitulos.proyectoId,p.id),eq(capitulos.numero,n)))).length) await crearCapitulo(p.id, n, editor.id);
  const [w] = (await pool.query<{ id: string }>(`SELECT w.id FROM work_items w JOIN capitulos c ON w.business_key='capitulo:'||c.id::text WHERE w.proyecto_id=$1 AND c.numero=$2`, [p.id, n])).rows;
  if (!w) throw Error('Missing chapter work item');
  const existing = await db.select().from(solicitudesArea).where(and(eq(solicitudesArea.workItemId, w.id), eq(solicitudesArea.requestedById, editor.id)));
  if (existing.length) {
    const repeat = existing.find(r => n === 6 && r.tipo === 'editor_aclaracion' && ['pendiente','en_revision'].includes(r.estado));
    if (repeat) await decidirRequestEditor(repeat.id, specialist, repeat.version, 'return', 'Indica el apartado y la versión del documento que necesitas revisar.');
    continue;
  }
  const type = n % 3 === 0 ? 'editor_aclaracion' : n % 3 === 1 ? 'editor_apoyo' : 'editor_reasignacion';
  const r = await crearRequestEditor(editor.id, w.id, type, 'Necesito validar el criterio editorial antes de continuar con esta intervención.');
  const recipient = type === 'editor_aclaracion' ? specialist : chief;
  if (n === 1 || n === 6) await decidirRequestEditor(r.id, recipient, 1, 'return', 'Indica el apartado y la versión del documento que necesitas revisar.');
  else if (n === 3) await decidirRequestEditor(r.id, recipient, 1, 'resolve', 'Utiliza el documento más reciente de la carpeta de entrada del proyecto.');
  else if (n === 4) await cancelarRequestEditor(r.id, editor.id, 1);
  else if (n === 5) await decidirRequestEditor(r.id, recipient, 1, 'review', 'Estamos evaluando la disponibilidad para atender tu solicitud.');
}
const foreign = await project('REQ-OTHER', other);
const [w] = await db.select().from(workItems).where(eq(workItems.proyectoId, foreign.id));
if (!(await db.select().from(solicitudesArea).where(eq(solicitudesArea.workItemId, w!.id))).length) await crearRequestEditor(other.id, w!.id, 'editor_apoyo', 'Solicitud privada del segundo Editor para validar permisos.');
await pool.end(); console.log('Request QA scenarios ready in isolated database');
