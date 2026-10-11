/** Isolated, disposable UI QA fixture. Never writes to the development database. */
import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq, sql } from 'drizzle-orm';

const target = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(target.hostname))
  throw new Error('Preview requires local PostgreSQL');
const previewName = 'panhouse_jefatura_preview';
const admin = new Pool({ connectionString: target.toString() });
if (
  !(
    await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [
      previewName,
    ])
  ).rowCount
) {
  await admin.query('CREATE DATABASE panhouse_jefatura_preview');
}
await admin.end();
target.pathname = `/${previewName}`;
process.env.DATABASE_URL = target.toString();
process.env.NODE_ENV = 'development';
const { db, pool } = await import('../server/db/client.js');
if (process.env.PREVIEW_CLEANUP === 'true') {
  // Only the fixed local disposable database selected above can be cleaned.
  await db.execute(
    sql`TRUNCATE TABLE usuarios, autores, servicios, unidades, presupuestos CASCADE`,
  );
  await pool.end();
  console.log('Isolated QA data cleaned: panhouse_jefatura_preview');
  process.exit(0);
}
const {
  users,
  servicios,
  proyectos,
  workItems,
  direccionesCreativas,
  projectAssignments,
  fichasTrazabilidad,
} = await import('../server/db/schema/index.js');
const { crearAutor, crearUnidad, crearPresupuesto, crearProyecto, crearFichaComercialCompleta } =
  await import('../tests/helpers/fixtures.js');
const { hashPassword } = await import('../server/helpers/password.js');
const { decidirExpressJefatura } =
  await import('../server/helpers/jefatura.js');
const { asignarEspecialista } = await import('../server/helpers/proyectos.js');
await migrate(db, { migrationsFolder: './server/db/migrations' });
if (process.env.PREVIEW_REUSE_DATA !== 'true') {
  // Fixed database selected above, test-only rows are intentionally reset on each run.
  await db.execute(
    sql`TRUNCATE TABLE usuarios, autores, servicios, unidades, presupuestos CASCADE`,
  );
  const passwordHash = await hashPassword('PanhousePreview2026!');
  const [jefe, ana, beatriz, carlos, editor] = await db
    .insert(users)
    .values([
      {
        nombre: 'Ana Molina',
        email: 'jefatura@preview.panhouse.test',
        rol: 'jefe_area',
        passwordHash,
      },
      {
        nombre: 'Valentina Rojas',
        email: 'valentina@preview.panhouse.test',
        rol: 'especialista',
        passwordHash,
      },
      {
        nombre: 'Mateo Silva',
        email: 'mateo@preview.panhouse.test',
        rol: 'especialista',
        passwordHash,
      },
      {
        nombre: 'Camila Torres',
        email: 'camila@preview.panhouse.test',
        rol: 'especialista',
        passwordHash,
      },
      {
        nombre: 'Diego Salas',
        email: 'editor@preview.panhouse.test',
        rol: 'editor',
        passwordHash,
      },
      {
        nombre: 'Julia Medina',
        email: 'creativo@preview.panhouse.test',
        rol: 'lider_creativo',
        passwordHash,
      },
    ])
    .returning();
  const [ef, se, cr] = await db
    .insert(servicios)
    .values([
      {
        codigo: 'EF',
        nombre: 'Escritura fantasma',
        pesoComplejidad: 4,
        plazoDias: 180,
      },
      {
        codigo: 'SE',
        nombre: 'Sello editorial',
        pesoComplejidad: 1,
        plazoInternoDias: 60,
        plazoComercialDias: 90,
      },
      { codigo: 'CR', nombre: 'Crudo', pesoComplejidad: 3, plazoDias: 150 },
    ])
    .returning();
  const unidad = await crearUnidad();
  const presupuesto = await crearPresupuesto();
  let n = 0;
  async function proyecto(
    nombre: string,
    servicioId: string,
    extra: Partial<typeof proyectos.$inferInsert> = {},
  ) {
    const autor = await crearAutor({ nombre });
    const p = await crearProyecto({
      codigo: `QA-${++n}`,
      autorId: autor.id,
      servicioId,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-09-01',
    });
    await db
      .update(proyectos)
      .set({ notificadoRrpp: true, notificadoJefatura: true, ...extra })
      .where(eq(proyectos.id, p.id));
    await crearFichaComercialCompleta(p.id);
    await db.update(fichasTrazabilidad).set({matrizDiagnosticoGenerado:true,matrizIngresoGenerado:true,ingresoServicioSubtipoCrudo:servicioId===cr!.id?'Tripa':null, ingresoServicioEjecucion:extra.fechaDeseadaAutor?'Express':'Normal',ingresoTiempoExpresMeses:extra.fechaDeseadaAutor?3:null}).where(eq(fichasTrazabilidad.proyectoId,p.id));
    return p;
  }
  await proyecto('Isabel Figueroa', ef!.id, { especialistaId: ana!.id });
  await proyecto('Andrés Paredes', ef!.id, { especialistaId: ana!.id });
  for (const nombre of ['Lucas Méndez', 'Clara Montes', 'Daniel Blanco'])
    await proyecto(nombre, se!.id, {
      especialistaId: beatriz!.id,
      fechaProgramadaInicio: '2026-10-01',
    });
  const posible = await proyecto('Elena Márquez y Martín Ortega', ef!.id, {
    fechaDeseadaAutor: '2027-01-05',
  });
  await db.insert(workItems).values({
    proyectoId: posible.id,
    tipo: 'asignacion_especialista',
    estado: 'pendiente',
  });
  await proyecto('Sofía Álvarez', cr!.id);
  await proyecto('Teresa Peña', ef!.id, {
    tituloDefinitivo: 'La memoria de los caminos',
  });
  await proyecto('Iván Ferrer', se!.id, {
    tituloDefinitivo: 'Cuadernos de una ciudad',
  });
  await proyecto('Nora Castillo', cr!.id, {
    tituloDefinitivo: 'Semillas del mañana',
  });
  const confirmado = await proyecto('Gabriel Rivas', se!.id, {
    fechaProgramadaInicio: '2026-10-01',
    fechaDeseadaAutor: '2026-12-01',
  });
  await decidirExpressJefatura(confirmado.id, jefe!.id, {
    decision: 'confirmado',
    fechaEstandar: '2026-12-30',
    fechaDeseada: '2026-12-01',
    motivo: 'Fecha de presentación acordada para la revisión de QA.',
  });
  await proyecto('Intake todavía en RRPP', ef!.id, {
    notificadoJefatura: false,
  });
  const riesgo = await proyecto('Lucía Fernández', cr!.id, {
    fechaProgramadaInicio: '2026-05-01',
  });
  await asignarEspecialista(riesgo.id, ana!.id, jefe!.id, {
    exigirHandoff: true,
  });
  const [edicion, creativa] = await db
    .insert(workItems)
    .values([
      {
        proyectoId: riesgo.id,
        tipo: 'edicion',
        estado: 'en_progreso',
        fechaFinPautada: '2026-10-07',
      },
      {
        proyectoId: riesgo.id,
        tipo: 'direccion_creativa',
        estado: 'bloqueado',
        fechaFinPautada: '2026-10-15',
      },
    ])
    .returning();
  await db.insert(projectAssignments).values({
    proyectoId: riesgo.id,
    workItemId: edicion!.id,
    tipo: 'editor',
    usuarioId: editor!.id,
    asignadoPorId: jefe!.id,
  });
  const solicitado = await proyecto('Mariana Solís', cr!.id, {
    especialistaId: beatriz!.id,
  });
  const [solicitud] = await db
    .insert(workItems)
    .values({
      proyectoId: solicitado.id,
      tipo: 'direccion_creativa',
      estado: 'pendiente',
    })
    .returning();
  await db
    .insert(direccionesCreativas)
    .values({ proyectoId: solicitado.id, workItemId: solicitud!.id });
  await db.insert(workItems).values({
    proyectoId: solicitado.id,
    tipo: 'edicion',
    estado: 'pendiente',
  });
}
const { buildApp } = await import('../server/app.js');
const app = buildApp();
await app.listen({ host: '127.0.0.1', port: 3002 });
console.log('Isolated Jefatura QA API ready on http://localhost:3002');
