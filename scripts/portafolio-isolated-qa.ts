/** Disposable local UI scenarios. Never changes development project data. */
import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('QA requires local PostgreSQL');
const admin = new Pool({ connectionString: source.toString() });
if (
  !(
    await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [
      'panhouse_portafolio_qa',
    ])
  ).rowCount
)
  await admin.query('CREATE DATABASE panhouse_portafolio_qa');
await admin.end();
source.pathname = '/panhouse_portafolio_qa';
process.env.DATABASE_URL = source.toString();
process.env.NODE_ENV = 'development';
const { db } = await import('../server/db/client.js');
await migrate(db, { migrationsFolder: './server/db/migrations' });
const { proyectos, fichasTrazabilidad, users, workItems, projectAssignments } =
  await import('../server/db/schema/index.js');
const {
  crearAutor,
  crearUnidad,
  crearPresupuesto,
  crearProyecto,
  crearFichaComercialCompleta,
  crearServicio,
} = await import('../tests/helpers/fixtures.js');
const { createSession } = await import('../server/helpers/session.js');
const { decidirExpressJefatura, obtenerDashboardJefatura } =
  await import('../server/helpers/jefatura.js');
let [jefe] = await db
  .select()
  .from(users)
  .where(eq(users.email, 'explorer-qa@panhouse.test'))
  .limit(1);
if (!jefe) {
  [jefe] = await db
    .insert(users)
    .values({
      nombre: 'Jefatura QA aislada',
      email: 'explorer-qa@panhouse.test',
      rol: 'jefe_area',
      passwordHash: 'session-only',
    })
    .returning();
  const [especialista] = await db
    .insert(users)
    .values({
      nombre: 'Especialista QA',
      email: 'specialist-explorer-qa@panhouse.test',
      rol: 'especialista',
      passwordHash: 'session-only',
    })
    .returning();
  const unidad = await crearUnidad();
  const presupuesto = await crearPresupuesto();
  const cr = await crearServicio({
    codigo: 'CR',
    nombre: 'Crudo',
    pesoComplejidad: 3,
    plazoDias: 150,
  });
  const gw = await crearServicio({
    codigo: 'GW',
    nombre: 'Ghostwriting',
    pesoComplejidad: 4,
    plazoDias: 180,
  });
  for (let i = 0; i < 13; i++) {
    const autor = await crearAutor({ nombre: `Autor QA ${i + 1}` });
    const isCr = i < 2;
    const p = await crearProyecto({
      autorId: autor.id,
      servicioId: isCr ? cr.id : gw.id,
      unidadId: unidad.id,
      presupuestoId: presupuesto.id,
      fechaProgramadaInicio: '2026-10-11',
      codigo: `QA${String(i + 1).padStart(3, '0')}`,
      ...(i >= 3 && i < 11 ? { especialistaId: especialista!.id } : {}),
      estado: i === 3 ? 'culminado' : i === 4 ? 'retrasado' : 'en_proceso',
      ...(i === 0 || i === 2 ? { fechaDeseadaAutor: '2026-11-01' } : {}),
    });
    await db
      .update(proyectos)
      .set({
        notificadoRrpp: true,
        notificadoJefatura: i !== 12,
        tituloDefinitivo: `Proyecto QA ${i + 1}`,
      })
      .where(eq(proyectos.id, p.id));
    await crearFichaComercialCompleta(p.id);
    await db
      .update(fichasTrazabilidad)
      .set({
        ingresoFechaIngreso: '2026-10-11',
        ingresoServicioSubtipoCrudo: isCr
          ? i === 0
            ? 'Tripa'
            : 'Capítulo'
          : null,
        matrizDiagnosticoGenerado: true,
        matrizIngresoGenerado: true,
      })
      .where(eq(fichasTrazabilidad.proyectoId, p.id));
    if (i >= 3 && i < 11) {
      await db.insert(projectAssignments).values({
        proyectoId: p.id,
        tipo: 'especialista',
        usuarioId: especialista!.id,
      });
      await db.insert(workItems).values({
        proyectoId: p.id,
        tipo: 'edicion',
        estado: i === 3 ? 'completado' : 'en_progreso',
      });
    }
    if (i === 0) {
      const snapshot = await obtenerDashboardJefatura();
      const express = snapshot.proyectos.find((x) => x.id === p.id)!.express;
      await decidirExpressJefatura(p.id, jefe!.id, {
        decision: 'confirmado',
        fechaDeseada: express.fechaDeseada!,
        fechaEstandar: express.fechaEstandar!,
      });
    }
  }
}
await mkdir(join(tmpdir(), 'panhouse-browser-qa'), { recursive: true });
const session = await createSession(jefe!.id);
await writeFile(
  join(tmpdir(), 'panhouse-browser-qa/state-isolated.json'),
  JSON.stringify({
    cookies: [
      {
        name: 'panhouse_sid',
        value: session,
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  }),
);
const { buildApp } = await import('../server/app.js');
await buildApp().listen({ host: '127.0.0.1', port: 3003 });
console.log(
  'Isolated explorer QA API ready: http://localhost:3003; database panhouse_portafolio_qa',
);
