/** QA visual sobre la base de desarrollo real (localhost). No crea bases nuevas. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
const target = new URL(process.env.DATABASE_URL!);
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw Error('Solo QA local');
const { db } = await import('../server/db/client.js');
const { users, proyectos, autores, presupuestos, unidades, servicios, proyectosAutores, fichasTrazabilidad, workItems, fichaDocumentalDatos } = await import('../server/db/schema/index.js');
const { habilitarActivacionAmazon } = await import('../server/helpers/activacionAmazon.js');
const { actualizarSeccionSoporteDigital, actualizarSeccionDigitalControl } = await import('../server/helpers/trazabilidad.js');

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
async function activar(proyectoId: string) { return db.transaction(tx => habilitarActivacionAmazon(tx, proyectoId, soporte!.id)); }

// 1. Preparación — formulario aún no enviado.
await activar((await nuevoProyecto('Sombras del Valle · Marina Esteves', 'PH-QA-MT-01')).id);

// 2. Preparación — formulario enviado, cuenta aún sin activar.
const p2 = await nuevoProyecto('Las Voces del Viento · Carlos Durán', 'PH-QA-MT-02');
await activar(p2.id);
await actualizarSeccionSoporteDigital(p2.id, { soporteDigitalFechaEnvioFormulario: '2026-10-20' }, soporte.id);

// 3. Cuenta activada, esperando la entrega del paquete final.
const p3 = await nuevoProyecto('El Último Faro · Renata Cabrera', 'PH-QA-MT-03');
await activar(p3.id);
await actualizarSeccionSoporteDigital(p3.id, { soporteDigitalFechaActivacion: '2026-10-15' }, soporte.id);

// 4. Pruebas KDP — paquete disponible, prueba aún no registrada.
const p4 = await nuevoProyecto('Ciudad de Papel · Joaquín Ferreira', 'PH-QA-MT-04');
await activar(p4.id);
await actualizarSeccionSoporteDigital(p4.id, { soporteDigitalFechaActivacion: '2026-10-01' }, soporte.id);
await db.insert(fichaDocumentalDatos).values({ proyectoId: p4.id, seccion: 'diseno', datos: { paqueteFinalCargado: true } });

// 5. Prueba registrada, carga pendiente.
const p5 = await nuevoProyecto('Raíces Invisibles · Teresa London', 'PH-QA-MT-05');
await activar(p5.id);
await actualizarSeccionSoporteDigital(p5.id, { soporteDigitalFechaActivacion: '2026-09-20' }, soporte.id);
await db.insert(fichaDocumentalDatos).values({ proyectoId: p5.id, seccion: 'diseno', datos: { paqueteFinalCargado: true } });
await db.insert(fichaDocumentalDatos).values({ proyectoId: p5.id, seccion: 'digital', datos: { pruebaArchivos: '2026-10-10', tapa: 'Mate', precioKdp: '14.99' } });

// 6. Cargas registradas — listo para marcar completado.
const p6 = await nuevoProyecto('Horizontes Lejanos · Daniela Ortiz', 'PH-QA-MT-06');
await activar(p6.id);
await actualizarSeccionSoporteDigital(p6.id, { soporteDigitalFechaActivacion: '2026-09-10' }, soporte.id);
await db.insert(fichaDocumentalDatos).values({ proyectoId: p6.id, seccion: 'diseno', datos: { paqueteFinalCargado: true } });
await db.insert(fichaDocumentalDatos).values({ proyectoId: p6.id, seccion: 'digital', datos: { pruebaArchivos: '2026-09-15', cargaKdp: '2026-09-25' } });

// 7. Digital completado.
const p7 = await nuevoProyecto('Voces que Quedan · Esteban Rivas', 'PH-QA-MT-07');
await activar(p7.id);
await actualizarSeccionDigitalControl(p7.id, { digitalEstatus: 'Completado', digitalFechaEntrega: '2026-10-05' });

// 8. Bloqueado por un gate real (solvencia).
const p8 = await nuevoProyecto('El Jardín de las Voces · Paola Serrano', 'PH-QA-MT-08');
const w8 = await activar(p8.id);
await db.update(workItems).set({ estado: 'bloqueado', gateBloqueante: 'Pendiente de solvencia administrativa' }).where(eq(workItems.id, w8));

// 9. Proyecto en pausa.
const p9 = await nuevoProyecto('La Ruta del Silencio · Gabriel Montes', 'PH-QA-MT-09');
await activar(p9.id);
await db.update(proyectos).set({ estado: 'pausado' }).where(eq(proyectos.id, p9.id));

console.log('QA seed de Mi trabajo listo. Login:', soporte.email, '/ password123');
process.exit(0);
