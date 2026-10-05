import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { fases, pasos, servicioFases, servicios } from '../server/db/schema/index.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearServicio } from './helpers/fixtures.js';

// Fase 2 (Foundation), instrucción explícita: "antes de conectar estas
// tablas a runtime: crear tests que demuestren" capacidad de
// representar el workflow. Ningún código de producción lee todavía de
// fases/pasos/servicio_fases (confirmado por auditoría, ver
// docs/arquitectura/11-fase2-modelo-canonico.md §L.3) — estas pruebas
// verifican la CAPACIDAD del esquema con datos representativos de
// prueba, no fijan un catálogo real de producción (eso requeriría
// confirmación de negocio que todavía no existe; no se siembra en
// server/db/seed.ts a propósito, para no inventar el catálogo real).
describe('fases/pasos/servicio_fases — capacidad del esquema para representar el workflow', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  async function sembrarFasesDeEjemplo() {
    const [edicion, correccion, creativa, diseno] = await Promise.all([
      db.insert(fases).values({ codigo: 'edicion', nombre: 'Edición' }).returning().then(([f]) => f!),
      db.insert(fases).values({ codigo: 'correccion', nombre: 'Corrección' }).returning().then(([f]) => f!),
      db.insert(fases).values({ codigo: 'creativa', nombre: 'Dirección Creativa' }).returning().then(([f]) => f!),
      db.insert(fases).values({ codigo: 'diseno', nombre: 'Diseño' }).returning().then(([f]) => f!),
    ]);
    return { edicion, correccion, creativa, diseno };
  }

  it('representa el orden secuencial de fases para un servicio (distinto `orden` = secuencial)', async () => {
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const { edicion, correccion } = await sembrarFasesDeEjemplo();

    // Edición (orden 1) debe completarse antes de que Corrección (orden 2)
    // tenga sentido iniciar — mismo criterio documentado en
    // docs/arquitectura/06-workflow-model.md §1.
    await db.insert(servicioFases).values([
      { servicioId: servicio.id, faseId: edicion.id, orden: 1 },
      { servicioId: servicio.id, faseId: correccion.id, orden: 2 },
    ]);

    const filas = await db
      .select({ faseCodigo: fases.codigo, orden: servicioFases.orden })
      .from(servicioFases)
      .innerJoin(fases, eq(servicioFases.faseId, fases.id))
      .where(eq(servicioFases.servicioId, servicio.id))
      .orderBy(servicioFases.orden);

    expect(filas).toEqual([
      { faseCodigo: 'edicion', orden: 1 },
      { faseCodigo: 'correccion', orden: 2 },
    ]);
    // Órdenes distintos -> secuencial: la fase de orden 2 nunca aparece
    // en el mismo "paquete" de paralelismo que la de orden 1.
    expect(filas[0]!.orden).not.toBe(filas[1]!.orden);
  });

  it('representa paralelismo real entre fases (mismo `orden` = paralelo)', async () => {
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const { edicion, creativa } = await sembrarFasesDeEjemplo();

    // Tras el Gate de Título, Creativa corre en paralelo con el resto de
    // Edición (02-business-flow.md §3.2) — mismo `orden` representa esa
    // simultaneidad real, no una coincidencia de numeración.
    await db.insert(servicioFases).values([
      { servicioId: servicio.id, faseId: edicion.id, orden: 1 },
      { servicioId: servicio.id, faseId: creativa.id, orden: 1 },
    ]);

    const filas = await db
      .select({ faseCodigo: fases.codigo, orden: servicioFases.orden })
      .from(servicioFases)
      .innerJoin(fases, eq(servicioFases.faseId, fases.id))
      .where(and(eq(servicioFases.servicioId, servicio.id), eq(servicioFases.orden, 1)));

    const codigosEnParalelo = filas.map((f) => f.faseCodigo).sort();
    expect(codigosEnParalelo).toEqual(['creativa', 'edicion']);
  });

  it('un servicio retirado (activo=false) conserva su configuración de fases intacta — no se borra', async () => {
    const servicioRetirado = await crearServicio({
      codigo: 'EEC',
      nombre: 'Edición de estilo por capítulo',
      pesoComplejidad: 3,
      plazoDias: 150,
    });
    const { edicion } = await sembrarFasesDeEjemplo();
    await db.insert(servicioFases).values({ servicioId: servicioRetirado.id, faseId: edicion.id, orden: 1 });

    // Retirar el servicio (activo=false, mismo criterio que
    // server/db/seed.ts ya aplica a EEC/EET reales) no debe arrastrar
    // DELETE sobre servicio_fases — un proyecto histórico con este
    // servicio sigue pudiendo resolver su configuración de fases.
    await db.update(servicios).set({ activo: false }).where(eq(servicios.id, servicioRetirado.id));

    const filasTrasRetiro = await db.select().from(servicioFases).where(eq(servicioFases.servicioId, servicioRetirado.id));
    expect(filasTrasRetiro).toHaveLength(1);
  });

  it('pasos quedan agrupados bajo su fase y ordenados — un proyecto histórico de esa fase sigue siendo interpretable', async () => {
    const { edicion } = await sembrarFasesDeEjemplo();
    await db.insert(pasos).values([
      { faseId: edicion.id, codigo: 'envio_editor', nombre: 'Envío a editor', orden: 1 },
      { faseId: edicion.id, codigo: 'feedback_autor', nombre: 'Feedback del autor', orden: 2 },
    ]);

    const filas = await db.select({ codigo: pasos.codigo, orden: pasos.orden }).from(pasos).where(eq(pasos.faseId, edicion.id)).orderBy(pasos.orden);

    expect(filas).toEqual([
      { codigo: 'envio_editor', orden: 1 },
      { codigo: 'feedback_autor', orden: 2 },
    ]);
  });
});
