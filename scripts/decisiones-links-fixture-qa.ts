import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const source = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(source.hostname))
  throw new Error('Only disposable local QA');
source.pathname = '/panhouse_decisiones_qa';
process.env.DATABASE_URL = source.toString();
process.env.NODE_ENV = 'development';
const { db, pool } = await import('../server/db/client.js');
const { proyectos, users, decisiones } = await import('../server/db/schema/index.js');
const { eq } = await import('drizzle-orm');
const { crearAutor, crearProyecto, crearFichaComercialCompleta } = await import('../tests/helpers/fixtures.js');
const { solicitarCorreccion } = await import('../server/helpers/correcciones.js');
try {
  const [base] = await db.select().from(proyectos).where(eq(proyectos.codigo,'DQ0001'));
  const [owner] = await db.select().from(users).where(eq(users.id,base!.especialistaId!));
  if (!base || !owner) throw new Error('Initial isolated fixtures required');
  const author = await crearAutor({ nombre: 'Lucía del Mar' });
  const [previous] = await db.select().from(proyectos).where(eq(proyectos.codigo,'DQ0006'));
  const p = await crearProyecto({autorId:author.id,servicioId:base.servicioId,unidadId:base.unidadId,presupuestoId:base.presupuestoId,especialistaId:owner.id,codigo:previous?'DQ0007':'DQ0006',fechaProgramadaInicio:'2026-10-01'});
  await db.update(proyectos).set({titulo:'Los caminos de sal',estado:'en_proceso',notificadoJefatura:true}).where(eq(proyectos.id,p.id));
  await crearFichaComercialCompleta(p.id);
  const c = await solicitarCorreccion(p.id,{alcance:'tripa_completa',paginas:121},owner.id);
  const [d] = await db.select().from(decisiones).where(eq(decisiones.originCorreccionId,c.id));
  await writeFile(join(tmpdir(),'panhouse-browser-qa/case-decisiones-links.json'),JSON.stringify({id:d!.id,proyectoId:p.id,correccionId:c.id}));
  console.log('Native 121-page source created only in disposable QA for contextual links.');
} finally { await pool.end(); }
