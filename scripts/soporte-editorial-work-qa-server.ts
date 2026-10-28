/** QA local aislado. No modifica proyectos ni credenciales de desarrollo. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';

const target = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw Error('Solo QA local');
const database = 'panhouse_calidad_preview_20261028';
const admin = new Pool({ connectionString: target.toString() });
if (!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [database])).rowCount) await admin.query('CREATE DATABASE panhouse_calidad_preview_20261028');
await admin.end();
target.pathname = '/' + database; process.env.DATABASE_URL = target.toString(); process.env.NODE_ENV = 'development';
const { db } = await import('../server/db/client.js');
await migrate(db, { migrationsFolder: './server/db/migrations' });
const { users, proyectos, autores, fichasTrazabilidad, workItems, direccionesCreativas, disenos, disenoVersiones, fichaCalidadFases } = await import('../server/db/schema/index.js');
const { crearUsuario, crearProyectoDePrueba } = await import('../tests/helpers/fixtures.js');
const { entregarDiseno, coordinarVersion } = await import('../server/helpers/diseno.js');
const { iniciarCalidad, resolverCalidad, criteriosDeFase } = await import('../server/helpers/calidad.js');
if (!(await db.select().from(users).limit(1)).length) {
  const support = await crearUsuario('soporte_editorial'), specialist = await crearUsuario('especialista'), designer = await crearUsuario('disenador');
  await db.update(users).set({ nombre: 'Validador de Calidad · QA', email: 'validador@calidad.qa.test' }).where(eq(users.id, support.id));
  await db.update(users).set({ nombre: 'Especialista · QA' }).where(eq(users.id, specialist.id));
  await db.update(users).set({ nombre: 'Diseñador · QA' }).where(eq(users.id, designer.id));
  for (const [index, state] of ['new', 'overdue', 'soon', 'review', 'waiting', 'completed', 'new-version', 'blocked', 'paused', 'new', 'new', 'new'].entries()) {
    const p = await crearProyectoDePrueba({ especialistaId: specialist.id, disenadorId: designer.id });
    await db.update(proyectos).set({ titulo: `Prueba de Calidad ${index + 1} · ${state}`, codigo: `CAL-QA-${index + 1}` }).where(eq(proyectos.id, p.id));
    await db.update(autores).set({ nombre: 'Autor de prueba' }).where(eq(autores.id, p.autorId));
    await db.insert(fichasTrazabilidad).values({ proyectoId: p.id });
    const [cw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'direccion_creativa', estado: 'completado' }).returning();
    const [dc] = await db.insert(direccionesCreativas).values({ proyectoId: p.id, workItemId: cw!.id, tipo: 'concepto_portada', resultadoFinal: 'aprobado' }).returning();
    const [dw] = await db.insert(workItems).values({ proyectoId: p.id, tipo: 'diseno', estado: 'en_progreso' }).returning();
    const [d] = await db.insert(disenos).values({ proyectoId: p.id, workItemId: dw!.id, tipo: 'diagramacion', direccionCreativaId: dc!.id, fuenteUrl: 'https://example.test/qa/tripa-fuente', solicitudKey: randomUUID(), preparacionConfirmada: true }).returning();
    const handoff = async () => {
      const v = await entregarDiseno(d!.id, { enlace: 'https://example.test/qa/pdf-diagramado', entregaKey: randomUUID() }, designer);
      await coordinarVersion(d!.id, v.id, { accion: 'handoff_calidad' }, specialist);
      const [version] = await db.select().from(disenoVersiones).where(eq(disenoVersiones.id, v.id));
      return version!.calidadFaseId!;
    };
    let phaseId = await handoff();
    if (['overdue', 'soon', 'review'].includes(state)) await iniciarCalidad(phaseId, state === 'review' ? undefined : new Date(Date.now() + (state === 'overdue' ? -8 : 8) * 3600000).toISOString(), support);
    if (['waiting', 'completed', 'new-version'].includes(state)) await resolverCalidad(phaseId, { aprobar: state === 'completed', cantidadComentarios: state === 'completed' ? 0 : 2, comentariosUrl: state === 'completed' ? undefined : 'https://example.test/qa/pdf-comentado', observaciones: 'Observaciones de prueba de esta ronda.', checklist: Object.fromEntries(criteriosDeFase(1).map(c => [c, { cumple: true }])) }, support);
    if (state === 'new-version') phaseId = await handoff();
    if (state === 'blocked') {
      const [q] = await db.select().from(fichaCalidadFases).where(eq(fichaCalidadFases.id, phaseId));
      await db.update(workItems).set({ estado: 'bloqueado', gateBloqueante: 'Material fuente pendiente de confirmar por Especialista.' }).where(eq(workItems.id, q!.workItemId!));
    }
    if (state === 'paused') await db.update(proyectos).set({ estado: 'pausado' }).where(eq(proyectos.id, p.id));
  }
}
const { buildApp } = await import('../server/app.js');
await buildApp().listen({ host: '127.0.0.1', port: 3013 });
console.log('Calidad QA aislado: API 3013. Cuenta validador@calidad.qa.test / password123 (solo base QA).');
