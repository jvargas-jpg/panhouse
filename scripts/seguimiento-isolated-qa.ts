/** Disposable local scenarios. Never writes to development or production data. */
import 'dotenv/config';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq } from 'drizzle-orm';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const nombre = 'panhouse_seguimiento_qa';
const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('QA requires local PostgreSQL');
const admin = new Pool({ connectionString: source.toString() });
if (
  (await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [nombre]))
    .rowCount
)
  throw new Error('QA database already exists; refuse to overwrite');
const hasTemplate = (
  await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [
    'panhouse_portafolio_qa',
  ])
).rowCount;
await admin.query(
  hasTemplate
    ? 'CREATE DATABASE panhouse_seguimiento_qa TEMPLATE panhouse_portafolio_qa'
    : 'CREATE DATABASE panhouse_seguimiento_qa',
);
await admin.end();
source.pathname = `/${nombre}`;
process.env.DATABASE_URL = source.toString();
process.env.NODE_ENV = 'development';
const { db, pool } = await import('../server/db/client.js');
await migrate(db, { migrationsFolder: './server/db/migrations' });
// The newly created, explicitly named disposable database is the only target.
if (
  (await pool.query('SELECT current_database() nombre')).rows[0].nombre !==
  nombre
)
  throw new Error('Wrong QA database');
const tables = (
  await pool.query(
    "SELECT quote_ident(tablename) nombre FROM pg_tables WHERE schemaname='public'",
  )
).rows.map((r) => r.nombre);
if (tables.length)
  await pool.query(`TRUNCATE ${tables.join(',')} RESTART IDENTITY CASCADE`);
const {
  proyectos,
  fichasTrazabilidad,
  users,
  workItems,
  fichaCalidadFases,
  correcciones,
  pausas,
  projectAssignments,
  seguimientoFases,
} = await import('../server/db/schema/index.js');
const {
  crearAutor,
  crearUnidad,
  crearPresupuesto,
  crearProyecto,
  crearServicio,
  crearFichaComercialCompleta,
} = await import('../tests/helpers/fixtures.js');
const {
  solicitarCorreccion,
  asignarCorrector,
  marcarInicioCorreccion,
  registrarEntregaCorreccion,
  cerrarCorreccion,
} = await import('../server/helpers/correcciones.js');
const { createSession } = await import('../server/helpers/session.js');
const [jefe, especialista, corrector, otro, soporte] = await db
  .insert(users)
  .values(
    [
      'jefe_area',
      'especialista',
      'corrector',
      'corrector',
      'soporte_editorial',
    ].map((rol, i) => ({
      rol: rol as typeof users.$inferInsert.rol,
      email: `seguimiento-qa-${i}@panhouse.test`,
      nombre: [
        'Jefatura Demo',
        'Elena Torres',
        'Carlos Mendoza',
        'Laura Gil',
        'Soporte Editorial',
      ][i]!,
      passwordHash: 'session-only',
    })),
  )
  .returning();
const unidad = await crearUnidad(),
  presupuesto = await crearPresupuesto(),
  servicio = await crearServicio({
    codigo: 'CR',
    nombre: 'Crudo',
    pesoComplejidad: 3,
    plazoDias: 150,
  });
const titles = [
  'La brújula de Emma',
  'Una ciudad y sus canciones',
  'Raíces del silencio',
  'El mapa interior',
  'Voces de papel',
  'Tierra de nadie',
  'El último puerto',
  'Memorias mínimas',
  'Cuerpos de luz',
  'El jardín oblicuo',
  'Los días azules',
  'Los nombres del agua',
  'El camino de vuelta',
];
const cases: Record<
  string,
  { origen: string; id: string; proyectoId: string }
> = {};
for (let i = 0; i < 13; i++) {
  const autor = await crearAutor({
    nombre: [
      'Mariana Solís',
      'Tomás Méndez',
      'Laura Gil',
      'Roberto Salazar',
      'Daniela Acosta',
      'Sofía Cabrera',
      'Andrés Herrera',
      'Valeria Ríos',
      'Javier Molina',
      'Paula Benítez',
      'Sergio León',
      'Julia Santos',
      'Elisa Vega',
    ][i],
  });
  const p = await crearProyecto({
    autorId: autor.id,
    servicioId: servicio.id,
    unidadId: unidad.id,
    presupuestoId: presupuesto.id,
    especialistaId: especialista!.id,
    fechaProgramadaInicio: '2026-10-01',
    codigo: `SG${String(i + 1).padStart(4, '0')}`,
    estado: i === 8 ? 'pausado' : 'en_proceso',
  });
  await db
    .update(proyectos)
    .set({
      titulo: titles[i],
      notificadoJefatura: true,
      fechaDeseadaAutor: '2026-11-15',
    })
    .where(eq(proyectos.id, p.id));
  const f = await crearFichaComercialCompleta(p.id);
  await db
    .update(fichasTrazabilidad)
    .set({
      ingresoServicioSubtipoCrudo: 'Tripa',
      ingresoServicioPlazoBaseDias: '150',
    })
    .where(eq(fichasTrazabilidad.id, f.id));
  await db.insert(projectAssignments).values({
    proyectoId: p.id,
    tipo: 'especialista',
    usuarioId: especialista!.id,
  });
  if ([4, 5, 6, 12].includes(i)) {
    const num = i === 4 ? 2 : i === 6 ? 3 : 1;
    const [wi] = await db
      .insert(workItems)
      .values({
        proyectoId: p.id,
        tipo:
          num === 1
            ? 'fase_calidad_1'
            : num === 3
              ? 'revision_final'
              : 'validacion',
        estado: i === 5 ? 'completado' : 'pendiente',
        businessKey: `calidad-f${num}-r1`,
      })
      .returning();
    const [q] = await db
      .insert(fichaCalidadFases)
      .values({
        fichaId: f.id,
        numeroFase: num,
        workItemId: wi!.id,
        ronda: 1,
        cantidadPaginas: 88,
        solicitadoEn: new Date(Date.now() - 86400000),
        ...(i !== 12 ? { dueAt: new Date(Date.now() + 5 * 3600000) } : {}),
        ...(i === 5
          ? {
              aprobado: true,
              iniciadoEn: new Date(Date.now() - 8 * 3600000),
              revisadoEn: new Date(),
              revisadoPorId: soporte!.id,
              cantidadComentarios: 12,
              observaciones:
                'Revisión finalizada. Conservar los acuerdos editoriales.',
            }
          : {}),
      })
      .returning();
    cases[String.fromCharCode(65 + i)] = {
      origen: 'calidad',
      id: q!.id,
      proyectoId: p.id,
    };
    if (i === 5) {
      const [q2] = await db
        .insert(fichaCalidadFases)
        .values({
          fichaId: f.id,
          numeroFase: 1,
          ronda: 2,
          solicitadoEn: new Date(),
          cantidadPaginas: 88,
        })
        .returning();
      cases.F2 = { origen: 'calidad', id: q2!.id, proyectoId: p.id };
    }
  } else {
    const alcance =
      i === 2
        ? 'cubierta_extendida'
        : i === 3
          ? 'preliminares'
          : 'tripa_completa';
    const { id } = await solicitarCorreccion(
      p.id,
      { alcance, paginas: i === 8 ? 150 : 85 },
      especialista!.id,
    );
    if (i !== 8)
      await asignarCorrector(
        id,
        {
          correctorId: i === 1 ? null : corrector!.id,
          correctorNombre: i === 1 ? 'Andrea Díaz · Freelance' : null,
          freelance: i === 1,
          contratoConfirmado: true,
        },
        especialista!.id,
      );
    if ([0, 1, 2, 3, 7, 9, 10, 11].includes(i))
      await marcarInicioCorreccion(
        id,
        undefined,
        i === 1 ? especialista!.id : corrector!.id,
      );
    if (i === 7)
      await db
        .update(correcciones)
        .set({
          dueAt: new Date(Date.now() - 86400000),
          iniciadoEn: new Date(Date.now() - 3 * 86400000),
          asignadoEn: new Date(Date.now() - 6 * 86400000),
        })
        .where(eq(correcciones.id, id));
    if (i === 9)
      await asignarCorrector(
        id,
        { correctorId: otro!.id, freelance: false, contratoConfirmado: true },
        especialista!.id,
      );
    if (i === 10 || i === 11)
      await registrarEntregaCorreccion(id, {}, corrector!.id);
    if (i === 11)
      await cerrarCorreccion(
        id,
        {
          resultado: 'deficiente',
          observaciones: 'Requiere una nueva ronda de corrección.',
        },
        especialista!.id,
      );
    cases[String.fromCharCode(65 + i)] = {
      origen: 'correccion',
      id,
      proyectoId: p.id,
    };
    if (i === 0) {
      const r = await solicitarCorreccion(
        p.id,
        { alcance: 'preliminares', paginas: 8 },
        especialista!.id,
      );
      cases.A2 = { origen: 'correccion', id: r.id, proyectoId: p.id };
      await db.insert(pausas).values({
        proyectoId: p.id,
        causa: 'autor',
        fechaInicio: new Date(Date.now() - 3600000),
        fechaFin: new Date(Date.now() - 1800000),
      });
    }
  }
  await db.insert(workItems).values({
    proyectoId: p.id,
    tipo: 'edicion',
    estado: i === 8 ? 'bloqueado' : 'en_progreso',
    fechaFinPautada: i === 7 ? '2026-10-01' : '2026-11-10',
  });
}
await db.insert(seguimientoFases).values({
  proyectoId: cases.M!.proyectoId,
  asignacionTipo: 'TEXTO CONTRAPORTADA',
  tipoServicio: 'Edición',
  estatus: 'Entregado',
  fechaInicio: '2026-09-01',
  fechaEntrega: '2026-09-02',
  tiempoCorrecto: '1',
  totalHoras: '16',
  resultadosCorreccion: 'Regular',
  observaciones: 'Registro anterior conservado sin precisión horaria',
});
await mkdir(join(tmpdir(), 'panhouse-browser-qa'), { recursive: true });
const session = await createSession(jefe!.id);
await writeFile(
  join(tmpdir(), 'panhouse-browser-qa/state-seguimiento.json'),
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
await writeFile(
  join(tmpdir(), 'panhouse-browser-qa/cases-seguimiento.json'),
  JSON.stringify(cases),
);
const { buildApp } = await import('../server/app.js');
await buildApp().listen({ host: '127.0.0.1', port: 3004 });
console.log(
  'Isolated tracking QA ready on 3004; disposable database panhouse_seguimiento_qa',
);
