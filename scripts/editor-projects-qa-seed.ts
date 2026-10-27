/** Persisted domain fixtures exclusively in the existing isolated local QA DB. */
import 'dotenv/config';
import { eq, and } from 'drizzle-orm';
const target = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw Error('Local QA only');
target.pathname = '/panhouse_editor_preview_20261026'; process.env.DATABASE_URL = target.toString(); process.env.NODE_ENV = 'development';
const { db, pool } = await import('../server/db/client.js');
const { users, proyectos, proyectosAutores, autores, servicios, unidades, presupuestos, workItems } = await import('../server/db/schema/index.js');
const { asignarEditor, solicitarEditor } = await import('../server/helpers/proyectos.js');
const { crearCapitulo, actualizarCapituloEditor, actualizarCapituloAutor } = await import('../server/helpers/capitulos.js');
const { diaCaracas } = await import('../server/helpers/atencionEspecialista.js');
const [editor] = await db.select().from(users).where(eq(users.email, 'editor@edicion.qa.test'));
const [other] = await db.select().from(users).where(eq(users.email, 'editor-b@edicion.qa.test'));
const [chief] = await db.select().from(users).where(eq(users.rol, 'jefe_edicion'));
const [specialist] = await db.select().from(users).where(eq(users.rol, 'especialista'));
const [service] = await db.select().from(servicios); const [unit] = await db.select().from(unidades); const [budget] = await db.select().from(presupuestos);
if (!editor || !other || !chief || !specialist || !service || !unit || !budget) throw Error('Start scripts/editor-qa-server.ts first');
const today = diaCaracas(new Date());
for (const [code, title, kind] of [['PORT-ALL', 'Intervenciones de prueba', 'many'], ['PORT-DONE', 'Edición completada de prueba', 'done'], ['PORT-EMPTY', 'Participación sin trabajo de prueba', 'empty'], ['PORT-A', 'Proyecto de archivo de prueba', 'active'], ['PORT-B', 'Proyecto de revisión de prueba', 'active'], ['PORT-HISTORY', 'Participación histórica de prueba', 'history']] as const) {
  if ((await db.select({ id: proyectos.id }).from(proyectos).where(eq(proyectos.codigo, code))).length) continue;
  const [a] = await db.insert(autores).values({ nombre: 'Autor de prueba · Portafolio' }).returning();
  const [p] = await db.insert(proyectos).values({ codigo: code, titulo: title, autorId: a!.id, servicioId: service.id, unidadId: unit.id, presupuestoId: budget.id, especialistaId: specialist.id, fechaProgramadaInicio: today }).returning();
  await db.insert(proyectosAutores).values({ proyectoId: p!.id, autorId: a!.id });
  await solicitarEditor(p!.id, specialist.id); await asignarEditor(p!.id, editor.id, chief.id);
  if (kind === 'many') for (let n = 1; n <= 12; n++) await crearCapitulo(p!.id, n, editor.id);
  if (kind === 'done') {
    await crearCapitulo(p!.id, 1, editor.id);
    await actualizarCapituloEditor(p!.id, 1, { fechaInicioEditor: '2026-10-01', fechaEntregaEditor: '2026-10-02' }, editor.id);
    await actualizarCapituloAutor(p!.id, 1, { fechaEnvioAutor: '2026-10-05', fechaRespuestaReal: '2026-10-06' }, specialist.id);
    await actualizarCapituloEditor(p!.id, 1, { fechaEntregaEditor: '2026-10-07' }, editor.id);
  }
  if (kind === 'empty') await db.update(workItems).set({ estado: 'cancelado' }).where(and(eq(workItems.proyectoId, p!.id), eq(workItems.tipo, 'edicion')));
  if (kind === 'history') await asignarEditor(p!.id, other.id, chief.id, 'Rotación de prueba del portafolio');
}
await pool.end(); console.log('Portfolio QA fixtures ready in isolated preview database');
