/** QA visual sobre la base de desarrollo real (localhost). No crea bases nuevas.
 * Seis proyectos, uno por estado distinto — caben completos en el tope de
 * 6 tareas prioritarias del dashboard (ver §64 del master prompt), sin que
 * ningún estado quede fuera del recorte por culpa de relleno innecesario.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
const target = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw Error('Solo QA local');
const { db } = await import('../server/db/client.js');
const { users, proyectos, autores, presupuestos, unidades, servicios, proyectosAutores, fichasTrazabilidad, workItems, fichaDocumentalDatos } = await import('../server/db/schema/index.js');
const { habilitarActivacionAmazon } = await import('../server/helpers/activacionAmazon.js');

const [soporte] = await db.select().from(users).where(eq(users.email, 'soportedigital.demo@panhouse.test'));
if (!soporte) throw Error('No existe soportedigital.demo@panhouse.test — crear el usuario demo primero');

async function nuevoProyecto(titulo: string, codigo: string) {
  const sufijo = randomUUID().slice(0, 8);
  const [autor] = await db.insert(autores).values({ nombre: titulo.split('·')[1]?.trim() ?? 'Autor de prueba' }).returning();
  const [unidad] = await db.insert(unidades).values({ nombre: 'unidad-qa-' + sufijo }).returning();
  const [presupuesto] = await db.insert(presupuestos).values({ nombre: 'presupuesto-qa-' + sufijo }).returning();
  const [servicio] = await db.insert(servicios).values({ codigo: 'SRV-QA-' + sufijo, nombre: 'Servicio de prueba', pesoComplejidad: 4, plazoDias: 180 }).returning();
  const [p] = await db.insert(proyectos).values({ codigo, titulo, autorId: autor!.id, servicioId: servicio!.id, unidadId: unidad!.id, presupuestoId: presupuesto!.id, fechaProgramadaInicio: '2026-01-01' }).returning();
  await db.insert(proyectosAutores).values({ proyectoId: p!.id, autorId: autor!.id });
  await db.insert(fichasTrazabilidad).values({ proyectoId: p!.id });
  return p!;
}
async function activar(proyectoId: string) {
  return db.transaction(tx => habilitarActivacionAmazon(tx, proyectoId, soporte!.id));
}

// 1. Preparación — formulario aún no enviado (accionable).
await activar((await nuevoProyecto('Sombras del Valle · Marina Esteves', 'PH-QA-SD-01')).id);

// 2. Cuenta activada, esperando la entrega del paquete final (no es un atraso).
const p2 = await nuevoProyecto('El Último Faro · Renata Cabrera', 'PH-QA-SD-02');
await activar(p2.id);
await db.update(fichasTrazabilidad).set({ soporteDigitalFechaActivacion: '2026-10-15' }).where(eq(fichasTrazabilidad.proyectoId, p2.id));

// 3. Pruebas KDP — paquete final disponible y cuenta activada; fecha límite vencida (accionable, overdue).
const p3 = await nuevoProyecto('Ciudad de Papel · Joaquín Ferreira', 'PH-QA-SD-03');
const w3 = await activar(p3.id);
await db.update(fichasTrazabilidad).set({ soporteDigitalFechaActivacion: '2026-10-01' }).where(eq(fichasTrazabilidad.proyectoId, p3.id));
await db.insert(fichaDocumentalDatos).values({ proyectoId: p3.id, seccion: 'diseno', datos: { paqueteFinalCargado: true } });
await db.update(workItems).set({ fechaFinPautada: '2026-10-20' }).where(eq(workItems.id, w3));

// 4. Digital completado — control interno cerrado (no equivale a publicado).
const p4 = await nuevoProyecto('Horizontes Lejanos · Daniela Ortiz', 'PH-QA-SD-04');
await activar(p4.id);
await db.update(fichasTrazabilidad).set({ digitalEstatus: 'Completado' }).where(eq(fichasTrazabilidad.proyectoId, p4.id));

// 5. Bloqueado por un gate real (solvencia) — sin cifras expuestas.
const p5 = await nuevoProyecto('Voces que Quedan · Esteban Rivas', 'PH-QA-SD-05');
const w5 = await activar(p5.id);
await db.update(workItems).set({ estado: 'bloqueado', gateBloqueante: 'Pendiente de solvencia administrativa' }).where(eq(workItems.id, w5));

// 6. Proyecto en pausa.
const p6 = await nuevoProyecto('El Jardín de las Voces · Paola Serrano', 'PH-QA-SD-06');
await activar(p6.id);
await db.update(proyectos).set({ estado: 'pausado' }).where(eq(proyectos.id, p6.id));

console.log('QA seed listo. Login:', soporte.email, '/ password123');
process.exit(0);
