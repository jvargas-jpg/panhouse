/** Fixtures visuales exclusivamente en una base desechable local. */
import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { eq } from 'drizzle-orm';
const nombre = 'panhouse_indicadores_qa';
const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('QA local únicamente');
const admin = new Pool({ connectionString: source.toString() });
if (
  (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [nombre]))
    .rowCount
)
  throw new Error('La base QA ya existe; no se sobrescribe');
await admin.query('CREATE DATABASE panhouse_indicadores_qa');
await admin.end();
source.pathname = `/${nombre}`;
process.env.DATABASE_URL = source.toString();
process.env.NODE_ENV = 'development';
const { db, pool } = await import('../server/db/client.js');
await migrate(db, { migrationsFolder: './server/db/migrations' });
if (
  (await pool.query('SELECT current_database() nombre')).rows[0].nombre !==
  nombre
)
  throw new Error('Base incorrecta');
const {
  proyectos,
  users,
  fichasTrazabilidad,
  projectAssignments,
  auditLogs,
  workItems,
  correcciones,
} = await import('../server/db/schema/index.js');
const {
  crearAutor,
  crearUnidad,
  crearPresupuesto,
  crearServicio,
  crearProyecto,
} = await import('../tests/helpers/fixtures.js');
const { createSession } = await import('../server/helpers/session.js');
const { obtenerDashboardJefatura, decidirExpressJefatura } =
  await import('../server/helpers/jefatura.js');
const persons = await db
  .insert(users)
  .values(
    [
      'Jefatura QA',
      'Alicia Navarro',
      'Beatriz Campos',
      'Clara Morales',
      'Diana Romero',
      'Elisa Vidal',
      'Flora Medina',
      'Gabriela Torres',
    ].map((nombre, i) => ({
      nombre,
      email: `indicadores-qa-${i}@panhouse.test`,
      rol: i ? ('especialista' as const) : ('jefe_area' as const),
      passwordHash: 'session-only',
    })),
  )
  .returning();
const unidad = await crearUnidad(),
  presupuesto = await crearPresupuesto();
const catalogo = await Promise.all([
  crearServicio({
    codigo: 'GW',
    nombre: 'Ghostwriting',
    pesoComplejidad: 4,
    plazoDias: 180,
  }),
  crearServicio({
    codigo: 'CR',
    nombre: 'Crudo',
    pesoComplejidad: 3,
    plazoDias: 150,
  }),
  crearServicio({
    codigo: 'SE',
    nombre: 'Sello editorial',
    pesoComplejidad: 2,
    plazoInternoDias: 60,
    plazoComercialDias: 90,
  }),
]);
const titles = [
  'El atlas del viento',
  'Cuadernos del sur',
  'Las horas de la casa',
  'Paisajes del recuerdo',
  'El viaje de las semillas',
  'La estación de las luces',
  'El río en la ventana',
  'El hilo de la memoria',
];
for (let i = 0; i < 42; i++) {
  const autor = await crearAutor({ nombre: `Autor de prueba ${i + 1}` });
  const servicio = catalogo[i % 3]!;
  const especialista =
    i % 11 === 0 ? undefined : persons[i < 9 ? 4 : 1 + (i % 7)]!;
  const closed = i >= 26,
    estado = closed
      ? 'culminado'
      : (
          [
            'en_proceso',
            'en_proceso',
            'en_proceso',
            'retrasado',
            'pausado',
            'stand_by',
          ] as const
        )[i % 6];
  const mes = 1 + (i % 10),
    month = String(mes).padStart(2, '0');
  const p = await crearProyecto({
    autorId: autor.id,
    servicioId: servicio.id,
    unidadId: unidad.id,
    presupuestoId: presupuesto.id,
    especialistaId: especialista?.id,
    estado,
    fechaProgramadaInicio: i % 4 === 0 ? '2026-04-01' : '2026-10-01',
    codigo: `QA-${String(i + 1).padStart(3, '0')}`,
  });
  await db
    .update(proyectos)
    .set({
      notificadoJefatura: true,
      notificadoRrpp: true,
      ...(i % 5 === 0 && !closed ? { fechaDeseadaAutor: '2026-10-31' } : {}),
    })
    .where(eq(proyectos.id, p.id));
  await db.insert(fichasTrazabilidad).values({
    proyectoId: p.id,
    ingresoTituloObra: titles[i % titles.length],
    ingresoServicioSubtipoCrudo:
      servicio.codigo === 'CR' ? (i % 2 ? 'Tripa' : 'Cap\u00edtulo') : null,
  });
  if (especialista)
    await db.insert(projectAssignments).values({
      proyectoId: p.id,
      tipo: 'especialista',
      usuarioId: especialista.id,
      asignadoPorId: persons[0]!.id,
      asignadoEn: new Date(`2026-${month}-05T14:00:00Z`),
    });
  await db.insert(auditLogs).values({
    actorId: persons[0]!.id,
    entityType: 'proyecto',
    entityId: p.id,
    proyectoId: p.id,
    accion: 'JEFATURA_NOTIFICADA',
    createdAt: new Date(`2026-${month}-03T14:00:00Z`),
  });
  if (closed)
    await db.insert(auditLogs).values({
      actorId: especialista?.id,
      entityType: 'proyecto',
      entityId: p.id,
      proyectoId: p.id,
      accion: 'PROYECTO_ESTADO_CAMBIADO',
      detalles: {
        anterior: 'en_proceso',
        nuevo: 'culminado',
        especialistaId: especialista?.id ?? null,
      },
      createdAt: new Date(`2026-${month}-08T14:00:00Z`),
    });
  if (i % 5 === 0 && !closed) {
    const s = (await obtenerDashboardJefatura()).proyectos.find(
      (q) => q.id === p.id,
    )!;
    if (s.express.estado === 'posible' && i % 2 === 0)
      await decidirExpressJefatura(p.id, persons[0]!.id, {
        decision: 'confirmado',
        fechaDeseada: s.express.fechaDeseada!,
        fechaEstandar: s.express.fechaEstandar!,
        motivo: 'Caso QA de Express confirmado',
      });
  }
  if (i < 8) {
    const [w] = await db
      .insert(workItems)
      .values({ proyectoId: p.id, tipo: 'correccion', estado: 'completado' })
      .returning();
    await db.insert(correcciones).values({
      proyectoId: p.id,
      workItemId: w!.id,
      alcance: 'preliminares',
      iniciadoEn: new Date('2026-10-04T12:00:00Z'),
      entregadoEn: new Date(`2026-10-04T${i % 3 === 0 ? '22' : '18'}:00:00Z`),
      dueAt: new Date('2026-10-04T20:00:00Z'),
      fechaEntrega: '2026-10-04',
    });
  }
}
const folder = join(tmpdir(), 'panhouse-browser-qa');
await mkdir(folder, { recursive: true });
await writeFile(
  join(folder, 'state-indicadores.json'),
  JSON.stringify({
    cookies: [
      {
        name: 'panhouse_sid',
        value: await createSession(persons[0]!.id),
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
await buildApp().listen({ host: '127.0.0.1', port: 3006 });
console.log(
  'Indicadores QA listo en 3006; datos exclusivamente sintéticos en panhouse_indicadores_qa',
);
