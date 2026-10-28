/** Semilla exclusiva para la base de QA de Calidad. No toca desarrollo. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
const target = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw Error('Solo QA local');
target.pathname = '/panhouse_calidad_preview_20261028'; process.env.DATABASE_URL = target.toString(); process.env.NODE_ENV = 'development';
const { db, pool } = await import('../server/db/client.js');
const { migrate } = await import('drizzle-orm/node-postgres/migrator');
await migrate(db, { migrationsFolder: './server/db/migrations' });
const s = await import('../server/db/schema/index.js');
const { hashPassword } = await import('../server/helpers/password.js');
const { createQualityRequest, eligibleQualityRequests, decideQualityRequest, cancelQualityRequest } = await import('../server/helpers/soporteEditorialRequests.js');
const { rows: prior } = await pool.query("SELECT id FROM solicitudes_area WHERE tipo LIKE 'calidad_%' LIMIT 1");
if (!prior.length) {
  const [validator] = await db.select().from(s.users).where(eq(s.users.email, 'validador@calidad.qa.test'));
  const [specialist] = await db.select().from(s.users).where(eq(s.users.rol, 'especialista'));
  const [designer] = await db.select().from(s.users).where(eq(s.users.rol, 'disenador'));
  if (!validator || !specialist || !designer) throw Error('Inicia primero soporte-editorial-work-qa-server.ts');
  await db.update(s.users).set({ email: 'especialista@calidad.qa.test' }).where(eq(s.users.id, specialist.id));
  const passwordHash = await hashPassword('password123');
  const [other] = await db.insert(s.users).values({ email: 'validador-b@calidad.qa.test', nombre: 'Segundo Validador · QA', rol: 'soporte_editorial', passwordHash }).returning();
  const [author] = await db.insert(s.autores).values({ nombre: 'Autor de prueba de solicitudes' }).returning();
  const [unit] = await db.insert(s.unidades).values({ nombre: 'Unidad QA Solicitudes de Calidad' }).returning();
  const [budget] = await db.insert(s.presupuestos).values({ nombre: 'Presupuesto QA Solicitudes de Calidad' }).returning();
  const [service] = await db.insert(s.servicios).values({ codigo: 'QAR', nombre: 'Servicio QA Solicitudes de Calidad', pesoComplejidad: 4, plazoDias: 180 }).returning();
  const [p] = await db.insert(s.proyectos).values({ codigo: 'QAR-001', titulo: 'Validación de prueba con versión independiente', autorId: author!.id, especialistaId: specialist.id, disenadorId: designer.id, unidadId: unit!.id, presupuestoId: budget!.id, servicioId: service!.id, fechaProgramadaInicio: '2026-10-28' }).returning();
  await db.insert(s.proyectosAutores).values({ proyectoId: p!.id, autorId: author!.id });
  const [f] = await db.insert(s.fichasTrazabilidad).values({ proyectoId: p!.id }).returning();
  const [dw] = await db.insert(s.workItems).values({ proyectoId: p!.id, tipo: 'diseno', estado: 'completado' }).returning();
  const [cw] = await db.insert(s.workItems).values({ proyectoId: p!.id, tipo: 'direccion_creativa', estado: 'completado' }).returning();
  const [dc] = await db.insert(s.direccionesCreativas).values({ proyectoId: p!.id, workItemId: cw!.id, tipo: 'concepto_portada', resultadoFinal: 'aprobado' }).returning();
  const [d] = await db.insert(s.disenos).values({ proyectoId: p!.id, workItemId: dw!.id, tipo: 'diagramacion', fuenteUrl: 'https://example.test/qa/source', solicitudKey: randomUUID(), preparacionConfirmada: true, direccionCreativaId: dc!.id }).returning();
  const [w] = await db.insert(s.workItems).values({ proyectoId: p!.id, tipo: 'calidad', businessKey: randomUUID() }).returning();
  const [v] = await db.insert(s.disenoVersiones).values({ disenoId: d!.id, numero: 3, enlace: 'https://example.test/qa/pdf-v3', entregaKey: randomUUID(), entregadoPorId: designer.id, handoffEn: new Date(), calidadWorkItemId: w!.id }).returning();
  const [q] = await db.insert(s.fichaCalidadFases).values({ fichaId: f!.id, workItemId: w!.id, disenoVersionId: v!.id, numeroFase: 2, ronda: 2, pdfVersion: 'V3', pdfUrl: v!.enlace, solicitadoEn: new Date() }).returning();
  await db.update(s.disenoVersiones).set({ calidadFaseId: q!.id }).where(eq(s.disenoVersiones.id, v!.id));
  const contexts = (await eligibleQualityRequests('', 1, 25)).items;
  const ordered = [contexts.find(c => c.workItemId === w!.id)!, ...contexts.filter(c => c.workItemId !== w!.id)];
  const types = ['calidad_material', 'calidad_aclaracion', 'calidad_tecnico'] as const;
  for (let i = 0; i < 13; i++) {
    const c = ordered[i % ordered.length]!, type = types[Math.floor(i / ordered.length) % 3]!;
    const r = await createQualityRequest(validator, { workItemId: c.workItemId, type, subject: `Consulta de Calidad ${i + 1}: confirmar el material recibido`, description: `Solicitud de prueba ${i + 1} sobre ${c.versionLabel}: confirmar el enlace del material que se debe comparar en esta ronda.`, idempotencyKey: randomUUID() });
    if ([0, 7].includes(i)) await decideQualityRequest(specialist, r.id, 1, 'return', 'Indica la página afectada y el enlace de la versión recibida.');
    if (i === 1) await decideQualityRequest(specialist, r.id, 1, 'review', 'Se inició la revisión del material reportado.');
    if ([3, 6, 8, 11].includes(i)) await decideQualityRequest(specialist, r.id, 1, 'resolve', 'Se confirmó con Diseño el enlace del material correspondiente a esta ronda.', c.qualityPhaseId);
    if ([4, 9].includes(i)) await cancelQualityRequest(validator, r.id, 1, 'La consulta ya no es necesaria para continuar.');
  }
  await createQualityRequest(other!, { workItemId: w!.id, type: 'calidad_material', subject: 'Solicitud privada del segundo Validador', description: 'Esta solicitud no debe aparecer en el historial del primer Validador.', idempotencyKey: randomUUID() });
  console.log('QA de solicitudes: 13 solicitudes propias y una del segundo Validador.');
}
await pool.end();
