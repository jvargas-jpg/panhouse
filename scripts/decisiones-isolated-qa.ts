import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('Local QA only');
const adminUrl = new URL(source);
adminUrl.pathname = '/postgres';
const admin = new Pool({ connectionString: adminUrl.toString() });
if (
  (
    await admin.query(
      "SELECT 1 FROM pg_database WHERE datname='panhouse_decisiones_qa'",
    )
  ).rowCount
)
  throw new Error('Refuse to overwrite an existing QA database');
await admin.query(
  'CREATE DATABASE panhouse_decisiones_qa TEMPLATE panhouse_seguimiento_qa',
);
await admin.end();
source.pathname = '/panhouse_decisiones_qa';
process.env.DATABASE_URL = source.toString();
process.env.NODE_ENV = 'development';
const { db } = await import('../server/db/client.js');
await migrate(db, { migrationsFolder: './server/db/migrations' });
const { users, proyectos, decisiones } =
  await import('../server/db/schema/index.js');
const { crearAutor, crearProyecto, crearFichaComercialCompleta } =
  await import('../tests/helpers/fixtures.js');
const { solicitarCorreccion } =
  await import('../server/helpers/correcciones.js');
const { createSession } = await import('../server/helpers/session.js');
const [jefe] = await db.select().from(users).where(eq(users.rol, 'jefe_area'));
const [especialista] = await db
  .select()
  .from(users)
  .where(eq(users.rol, 'especialista'));
const [base] = await db.select().from(proyectos).limit(1);
const cases: Record<
  string,
  { id: string; proyectoId: string; correccionId: string }
> = {};
const titles = [
  'El faro de invierno',
  'Las voces del bosque',
  'La casa de la memoria',
  'Atlas de días claros',
];
for (let i = 0; i < titles.length; i++) {
  const autor = await crearAutor({
    nombre: ['Marta Salas', 'Luis Perdomo', 'Ana Torres', 'Pedro Silva'][i],
  });
  const p = await crearProyecto({
    autorId: autor.id,
    servicioId: base!.servicioId,
    unidadId: base!.unidadId,
    presupuestoId: base!.presupuestoId,
    especialistaId: especialista!.id,
    fechaProgramadaInicio: '2026-10-01',
    codigo: `DQ000${i + 1}`,
  });
  await db
    .update(proyectos)
    .set({ titulo: titles[i], estado: 'en_proceso', notificadoJefatura: true })
    .where(eq(proyectos.id, p.id));
  await crearFichaComercialCompleta(p.id);
  const c = await solicitarCorreccion(
    p.id,
    { alcance: 'tripa_completa', paginas: 146 + i * 10 },
    especialista!.id,
  );
  const [d] = await db
    .select()
    .from(decisiones)
    .where(eq(decisiones.originCorreccionId, c.id));
  cases[String.fromCharCode(65 + i)] = {
    id: d!.id,
    proyectoId: p.id,
    correccionId: c.id,
  };
}
const dir = join(tmpdir(), 'panhouse-browser-qa');
await mkdir(dir, { recursive: true });
for (const [role, user] of [
  ['jefe', jefe!],
  ['especialista', especialista!],
] as const) {
  const token = await createSession(user.id);
  await writeFile(
    join(dir, `state-decisiones-${role}.json`),
    JSON.stringify({
      cookies: [
        {
          name: 'panhouse_sid',
          value: token,
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
}
await writeFile(join(dir, 'cases-decisiones.json'), JSON.stringify(cases));
const { buildApp } = await import('../server/app.js');
await buildApp().listen({ host: '127.0.0.1', port: 3005 });
