import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { workItems } from '../server/db/schema/index.js';
import { crearWorkItemSiNoExiste, transicionarWorkItem } from '../server/helpers/workItems.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad } from './helpers/fixtures.js';

// Fase 5 (checkpoint, §8/§9 del master prompt): work_items ya NO tiene
// un UNIQUE(proyectoId, tipo) universal — la idempotencia se resuelve
// por (proyectoId, tipo, businessKey). Estos tests demuestran ambos
// casos reales: tipos SINGLETON (una sola instancia posible) y tipos
// REPEATABLE (varias instancias legítimas del mismo tipo).
describe('work_items — singleton vs. repeatable (Fase 5, checkpoint)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  async function crearProyectoDePrueba() {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    return crearProyecto({ autorId: autor.id, servicioId: servicio.id, unidadId: unidad.id, presupuestoId: presupuesto.id, fechaProgramadaInicio: '2026-01-01' });
  }

  it('tipo SINGLETON: crearWorkItemSiNoExiste dos veces no duplica (misma businessKey implícita "default")', async () => {
    const proyecto = await crearProyectoDePrueba();

    const id1 = await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'intake_rrpp' }));
    const id2 = await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'intake_rrpp' }));

    expect(id1).toBe(id2);
    const filas = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'intake_rrpp')));
    expect(filas).toHaveLength(1);
  });

  it('tipo SINGLETON ignora businessKey explícita: sigue colapsando a una sola instancia', async () => {
    const proyecto = await crearProyectoDePrueba();

    await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'asignacion_especialista', businessKey: 'intento-1' }));
    await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'asignacion_especialista', businessKey: 'intento-2' }));

    const filas = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'asignacion_especialista')));
    expect(filas).toHaveLength(1);
    expect(filas[0]?.businessKey).toBe('default');
  });

  it('tipo REPEATABLE: distintas businessKey crean instancias independientes (ej. rondas de corrección)', async () => {
    const proyecto = await crearProyectoDePrueba();

    const idRonda1 = await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'correccion', businessKey: 'ronda-1' }));
    const idRonda2 = await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'correccion', businessKey: 'ronda-2' }));

    expect(idRonda1).not.toBe(idRonda2);
    const filas = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'correccion')));
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.businessKey).sort()).toEqual(['ronda-1', 'ronda-2']);
  });

  it('tipo REPEATABLE: repetir la MISMA businessKey sigue siendo idempotente (no duplica esa ronda)', async () => {
    const proyecto = await crearProyectoDePrueba();

    const id1 = await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'correccion', businessKey: 'ronda-1' }));
    const id2 = await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'correccion', businessKey: 'ronda-1' }));

    expect(id1).toBe(id2);
    const filas = await db.select().from(workItems).where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'correccion')));
    expect(filas).toHaveLength(1);
  });

  it('transicionarWorkItem con businessKey afecta solo la ronda correcta, no otras rondas del mismo tipo', async () => {
    const proyecto = await crearProyectoDePrueba();
    await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'calidad', businessKey: 'ronda-1' }));
    await db.transaction((tx) => crearWorkItemSiNoExiste(tx, { proyectoId: proyecto.id, tipo: 'calidad', businessKey: 'ronda-2' }));

    await db.transaction((tx) => transicionarWorkItem(tx, { proyectoId: proyecto.id, tipo: 'calidad', businessKey: 'ronda-1', estado: 'completado' }));

    const filas = await db
      .select()
      .from(workItems)
      .where(and(eq(workItems.proyectoId, proyecto.id), eq(workItems.tipo, 'calidad')));
    const ronda1 = filas.find((f) => f.businessKey === 'ronda-1');
    const ronda2 = filas.find((f) => f.businessKey === 'ronda-2');
    expect(ronda1?.estado).toBe('completado');
    expect(ronda2?.estado).toBe('pendiente');
  });
});
