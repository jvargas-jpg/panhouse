import { and, eq, isNull } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../server/db/client.js';
import { auditLogs, projectAssignments } from '../server/db/schema/index.js';
import { asignarConHistorial, historialAsignacionesDeProyecto, historialAsignacionesDeUsuario } from '../server/helpers/assignments.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
import { crearAutor, crearPresupuesto, crearProyecto, crearServicio, crearUnidad, crearUsuario } from './helpers/fixtures.js';

// §25 del master prompt de rearquitectura ("Tests obligatorios —
// ASSIGNMENTS"): asignación inicial, reasignación, historial anterior
// cerrado, nuevo actual, auditoría, doble request no duplica.
describe('asignarConHistorial — historial de project_assignments (Fase 2, Opción B)', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  async function crearProyectoDePrueba() {
    const [autor, unidad, presupuesto] = await Promise.all([crearAutor(), crearUnidad(), crearPresupuesto()]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    return crearProyecto({ autorId: autor.id, servicioId: servicio.id, unidadId: unidad.id, presupuestoId: presupuesto.id, fechaProgramadaInicio: '2026-01-01' });
  }

  it('asignación inicial: crea una fila activa, sin anterior', async () => {
    const proyecto = await crearProyectoDePrueba();
    const especialista = await crearUsuario('especialista');
    const jefeArea = await crearUsuario('jefe_area');

    const resultado = await db.transaction((tx) =>
      asignarConHistorial(tx, { proyectoId: proyecto.id, tipo: 'especialista', usuarioId: especialista.id, asignadoPorId: jefeArea.id }),
    );

    expect(resultado.cambio).toBe(true);
    expect(resultado.anteriorUsuarioId).toBeNull();

    const [fila] = await db.select().from(projectAssignments).where(eq(projectAssignments.id, resultado.asignacionId));
    expect(fila?.usuarioId).toBe(especialista.id);
    expect(fila?.finalizadoEn).toBeNull();
    expect(fila?.asignadoPorId).toBe(jefeArea.id);
  });

  it('reasignación: cierra la fila anterior (finalizadoEn) y abre una nueva activa', async () => {
    const proyecto = await crearProyectoDePrueba();
    const [especialistaA, especialistaB, jefeArea] = await Promise.all([
      crearUsuario('especialista'),
      crearUsuario('especialista'),
      crearUsuario('jefe_area'),
    ]);

    const primera = await db.transaction((tx) =>
      asignarConHistorial(tx, { proyectoId: proyecto.id, tipo: 'especialista', usuarioId: especialistaA.id, asignadoPorId: jefeArea.id }),
    );
    const segunda = await db.transaction((tx) =>
      asignarConHistorial(tx, { proyectoId: proyecto.id, tipo: 'especialista', usuarioId: especialistaB.id, asignadoPorId: jefeArea.id }),
    );

    expect(segunda.cambio).toBe(true);
    expect(segunda.anteriorUsuarioId).toBe(especialistaA.id);

    const [filaAnterior] = await db.select().from(projectAssignments).where(eq(projectAssignments.id, primera.asignacionId));
    expect(filaAnterior?.finalizadoEn).not.toBeNull();
    expect(filaAnterior?.motivoFin).toBeTruthy();

    const [filaActual] = await db.select().from(projectAssignments).where(eq(projectAssignments.id, segunda.asignacionId));
    expect(filaActual?.usuarioId).toBe(especialistaB.id);
    expect(filaActual?.finalizadoEn).toBeNull();

    // Exactamente UNA fila activa para este (proyecto, tipo) — el
    // índice único parcial lo garantiza a nivel de esquema, esto lo
    // confirma a nivel de comportamiento.
    const activas = await db
      .select()
      .from(projectAssignments)
      .where(and(eq(projectAssignments.proyectoId, proyecto.id), eq(projectAssignments.tipo, 'especialista'), isNull(projectAssignments.finalizadoEn)));
    expect(activas).toHaveLength(1);
  });

  it('historial completo recuperable: por proyecto y por usuario, anterior y nuevo', async () => {
    const proyecto = await crearProyectoDePrueba();
    const [especialistaA, especialistaB, jefeArea] = await Promise.all([
      crearUsuario('especialista'),
      crearUsuario('especialista'),
      crearUsuario('jefe_area'),
    ]);

    await db.transaction((tx) => asignarConHistorial(tx, { proyectoId: proyecto.id, tipo: 'especialista', usuarioId: especialistaA.id, asignadoPorId: jefeArea.id }));
    await db.transaction((tx) => asignarConHistorial(tx, { proyectoId: proyecto.id, tipo: 'especialista', usuarioId: especialistaB.id, asignadoPorId: jefeArea.id }));

    const historialProyecto = await historialAsignacionesDeProyecto(proyecto.id, 'especialista');
    expect(historialProyecto).toHaveLength(2);
    expect(historialProyecto.map((h) => h.usuarioId).sort()).toEqual([especialistaA.id, especialistaB.id].sort());

    const historialA = await historialAsignacionesDeUsuario(especialistaA.id);
    expect(historialA).toHaveLength(1);
    expect(historialA[0]?.finalizadoEn).not.toBeNull();

    const historialB = await historialAsignacionesDeUsuario(especialistaB.id);
    expect(historialB).toHaveLength(1);
    expect(historialB[0]?.finalizadoEn).toBeNull();
  });

  it('idempotencia: reasignar al MISMO usuario no crea una fila nueva', async () => {
    const proyecto = await crearProyectoDePrueba();
    const especialista = await crearUsuario('especialista');
    const jefeArea = await crearUsuario('jefe_area');

    const primera = await db.transaction((tx) =>
      asignarConHistorial(tx, { proyectoId: proyecto.id, tipo: 'especialista', usuarioId: especialista.id, asignadoPorId: jefeArea.id }),
    );
    const segunda = await db.transaction((tx) =>
      asignarConHistorial(tx, { proyectoId: proyecto.id, tipo: 'especialista', usuarioId: especialista.id, asignadoPorId: jefeArea.id }),
    );

    expect(segunda.cambio).toBe(false);
    expect(segunda.asignacionId).toBe(primera.asignacionId);

    const todas = await db.select().from(projectAssignments).where(eq(projectAssignments.proyectoId, proyecto.id));
    expect(todas).toHaveLength(1);
  });

  it('scope por work_item: una asignación ligada a un work item no bloquea ni se confunde con la asignación de proyecto del mismo tipo', async () => {
    const proyecto = await crearProyectoDePrueba();
    const [correctorA, correctorB, jefeArea] = await Promise.all([crearUsuario('especialista'), crearUsuario('especialista'), crearUsuario('jefe_area')]);

    const { workItems } = await import('../server/db/schema/index.js');
    const [workItem1] = await db.insert(workItems).values({ proyectoId: proyecto.id, tipo: 'correccion' }).returning();
    const [workItem2] = await db.insert(workItems).values({ proyectoId: proyecto.id, tipo: 'calidad' }).returning();

    const asignacion1 = await db.transaction((tx) =>
      asignarConHistorial(tx, { proyectoId: proyecto.id, workItemId: workItem1!.id, tipo: 'corrector', usuarioId: correctorA.id, asignadoPorId: jefeArea.id }),
    );
    const asignacion2 = await db.transaction((tx) =>
      asignarConHistorial(tx, { proyectoId: proyecto.id, workItemId: workItem2!.id, tipo: 'corrector', usuarioId: correctorB.id, asignadoPorId: jefeArea.id }),
    );

    // Ambas quedan activas simultáneamente — distinto work_item, mismo
    // tipo 'corrector', sin pisarse (a diferencia del scope de proyecto).
    expect(asignacion1.cambio).toBe(true);
    expect(asignacion2.cambio).toBe(true);

    const activas = await db
      .select()
      .from(projectAssignments)
      .where(and(eq(projectAssignments.proyectoId, proyecto.id), eq(projectAssignments.tipo, 'corrector'), isNull(projectAssignments.finalizadoEn)));
    expect(activas).toHaveLength(2);
  });
});

describe('asignarEspecialista (ruta completa) — auditoría y notificación', () => {
  beforeEach(async () => {
    await limpiarBaseDeDatos();
  });

  it('asignar especialista registra un evento en audit_logs', async () => {
    const [autor, unidad, presupuesto, especialista, jefeArea] = await Promise.all([
      crearAutor(),
      crearUnidad(),
      crearPresupuesto(),
      crearUsuario('especialista'),
      crearUsuario('jefe_area'),
    ]);
    const servicio = await crearServicio({ codigo: 'EF', nombre: 'Escritura fantasma', pesoComplejidad: 4, plazoDias: 180 });
    const proyecto = await crearProyecto({ autorId: autor.id, servicioId: servicio.id, unidadId: unidad.id, presupuestoId: presupuesto.id, fechaProgramadaInicio: '2026-01-01' });

    const { asignarEspecialista } = await import('../server/helpers/proyectos.js');
    await asignarEspecialista(proyecto.id, especialista.id, jefeArea.id);

    const eventos = await db.select().from(auditLogs).where(eq(auditLogs.proyectoId, proyecto.id));
    expect(eventos).toHaveLength(1);
    expect(eventos[0]?.accion).toBe('ESPECIALISTA_ASIGNADO');
    expect(eventos[0]?.actorId).toBe(jefeArea.id);
  });
});
