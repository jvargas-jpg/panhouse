import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { buildApp } from '../server/app.js';
import { db } from '../server/db/client.js';
import { projectAssignments, users } from '../server/db/schema/index.js';
import { createSession } from '../server/helpers/session.js';
import { crearCapitulo, actualizarCapituloAutor, actualizarCapituloEditor } from '../server/helpers/capitulos.js';
import { asignarEditor, solicitarEditor } from '../server/helpers/proyectos.js';
import { plazoCapituloEditor } from '../server/helpers/edicionSla.js';
import { obtenerIndicadoresEdicion, csvIndicadoresEdicion } from '../server/helpers/editorialIndicadores.js';
import { crearProyectoDePrueba, crearUsuario } from './helpers/fixtures.js';
import { limpiarBaseDeDatos } from './helpers/db.js';
const app = buildApp(), cookies = new Map<string, string>();
const now = new Date('2026-10-23T16:00:00Z');
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

async function person(rol: typeof users.$inferInsert.rol) {
  const u = await crearUsuario(rol);
  cookies.set(u.id, 'panhouse_sid=' + await createSession(u.id));
  return u;
}
const api = (path: string, user: string) => app.inject({ method: 'GET', url: '/api/editores' + path, headers: { cookie: cookies.get(user) ?? '' } });

// Historia necesita que la ventana de atribución de Editor (asignado_en <=
// completed_at) quede ANTES de las fechas históricas que el test inserta --
// asignarEditor() usa el reloj real (defaultNow()), así que esto retrasa la
// fila de asignación a una fecha anterior a todo lo demás, sin tocar
// proyectos.editorId (sigue intacto para las validaciones de ownership).
async function asignarEditorHistorico(proyectoId: string, editorId: string, chiefId: string) {
  await asignarEditor(proyectoId, editorId, chiefId);
  await db.update(projectAssignments).set({ asignadoEn: new Date('2026-09-01T00:00:00Z') })
    .where(and(eq(projectAssignments.proyectoId, proyectoId), eq(projectAssignments.tipo, 'editor'), isNull(projectAssignments.finalizadoEn)));
}

async function proyectoConEditor() {
  const [chief, specialist, editor] = await Promise.all([crearUsuario('jefe_edicion'), crearUsuario('especialista'), crearUsuario('editor')]);
  const p = await crearProyectoDePrueba({ especialistaId: specialist.id });
  await solicitarEditor(p.id, specialist.id);
  await asignarEditorHistorico(p.id, editor.id, chief.id);
  return { chief, specialist, editor, p };
}

beforeAll(() => app.ready());
afterAll(() => app.close());
beforeEach(async () => { await limpiarBaseDeDatos(); cookies.clear(); });

describe('Indicadores de Edición', () => {
  it('RBAC: exige sesión y rol jefe_edicion', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/editores/indicadores' })).statusCode).toBe(401);
    const editor = await person('editor');
    expect((await api('/indicadores', editor.id)).statusCode).toBe(403);
    const chief = await person('jefe_edicion');
    expect((await api('/indicadores', chief.id)).statusCode).toBe(200);
  });

  it('valida: rango personalizado exige from y to; service/editor deben ser UUID', async () => {
    const chief = await person('jefe_edicion');
    expect((await api('/indicadores?preset=personalizado', chief.id)).statusCode).toBe(400);
    expect((await api('/indicadores?preset=personalizado&from=2026-10-01&to=2026-09-01', chief.id)).statusCode).toBe(400);
    expect((await api('/indicadores?service=no-es-uuid', chief.id)).statusCode).toBe(400);
    expect((await api('/indicadores?editor=no-es-uuid', chief.id)).statusCode).toBe(400);
  });

  it('proyectosEnEdicion cuenta proyectos distintos, no intervenciones', async () => {
    const a = await proyectoConEditor();
    await crearCapitulo(a.p.id, 1, a.editor.id);
    await crearCapitulo(a.p.id, 2, a.editor.id);
    const b = await proyectoConEditor();
    await crearCapitulo(b.p.id, 1, b.editor.id);

    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    expect(data.kpis.projectsInEditing.value).toBe(2);
    expect(data.kpis.projectsInEditing.snapshot).toBe(true);
    expect(data.stateDistribution.reduce((n, d) => n + d.cantidad, 0)).toBe(3);
  });

  it('entregasCompletadas respeta los límites del período: fuera del período no cuenta', async () => {
    const a = await proyectoConEditor();
    await crearCapitulo(a.p.id, 1, a.editor.id);
    await actualizarCapituloEditor(a.p.id, 1, { fechaInicioEditor: '2026-10-10', fechaEntregaEditor: '2026-10-15' }, a.editor.id);
    await crearCapitulo(a.p.id, 2, a.editor.id);
    await actualizarCapituloEditor(a.p.id, 2, { fechaInicioEditor: '2026-08-01', fechaEntregaEditor: '2026-08-15' }, a.editor.id);

    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    expect(data.kpis.completedDeliveries.value).toBe(1);
    expect(data.kpis.completedDeliveries.snapshot).toBe(false);
  });

  it('comparación con el período anterior: null sin base, nunca porcentaje infinito', async () => {
    const a = await proyectoConEditor();
    await crearCapitulo(a.p.id, 1, a.editor.id);
    await actualizarCapituloEditor(a.p.id, 1, { fechaInicioEditor: '2026-10-10', fechaEntregaEditor: '2026-10-15' }, a.editor.id);

    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    expect(data.kpis.completedDeliveries.value).toBe(1);
    expect(data.kpis.completedDeliveries.deltaPct).toBeNull();
  });

  it('espera de autor nunca cuenta como vencida de Editor, pero sí como en espera de autor', async () => {
    const a = await proyectoConEditor();
    await crearCapitulo(a.p.id, 1, a.editor.id);
    await actualizarCapituloEditor(a.p.id, 1, { fechaInicioEditor: '2026-09-20', fechaEntregaEditor: '2026-09-22' }, a.editor.id);
    await actualizarCapituloAutor(a.p.id, 1, { fechaEnvioAutor: '2026-10-01' }, a.specialist.id);

    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    expect(data.kpis.waitingAuthor.value).toBe(1);
    expect(data.kpis.overdueInterventions.value).toBe(0);
  });

  it('SLA honesto: a tiempo vs tarde, excluye ciclos sin plazo aplicable (aplicación de feedback) del denominador', async () => {
    const a = await proyectoConEditor();
    const due = plazoCapituloEditor('2026-10-01');

    await crearCapitulo(a.p.id, 1, a.editor.id); // a tiempo
    await actualizarCapituloEditor(a.p.id, 1, { fechaInicioEditor: '2026-10-01', fechaEntregaEditor: due }, a.editor.id);

    await crearCapitulo(a.p.id, 2, a.editor.id); // tarde
    await actualizarCapituloEditor(a.p.id, 2, { fechaInicioEditor: '2026-10-01', fechaEntregaEditor: addDays(due, 6) }, a.editor.id);

    await crearCapitulo(a.p.id, 3, a.editor.id); // ciclo de feedback: sin SLA definido para aplicar feedback
    await actualizarCapituloEditor(a.p.id, 3, { fechaInicioEditor: '2026-10-01', fechaEntregaEditor: due }, a.editor.id);
    await actualizarCapituloAutor(a.p.id, 3, { fechaEnvioAutor: due, fechaRespuestaReal: addDays(due, 3) }, a.specialist.id);
    await actualizarCapituloEditor(a.p.id, 3, { fechaEntregaEditor: addDays(due, 7) }, a.editor.id);

    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    const editor = data.editors.find(e => e.id === a.editor.id)!;
    expect(editor.entregasCompletadas).toBe(3);
    expect(editor.slaMuestras).toBe(2);
    expect(editor.slaPct).toBe(50);

    const cycle = data.cycleTimes.find(c => c.tipo === 'chapter')!;
    expect(cycle.muestras).toBe(3);
    expect(cycle.promedioDias).not.toBeNull();
  });

  it('sin muestras de ciclo: "Datos insuficientes", nunca cero engañoso', async () => {
    await proyectoConEditor();
    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    expect(data.cycleTimes).toHaveLength(0);
    expect(data.insufficientData).toContain('cycleTimes');
  });

  it('sin Editores con actividad: SLA es "Sin datos" (null), no 0%', async () => {
    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    expect(data.editors).toHaveLength(0);
  });

  it('riesgo: una fila por proyecto, no por intervención', async () => {
    const a = await proyectoConEditor();
    await crearCapitulo(a.p.id, 1, a.editor.id);
    await actualizarCapituloEditor(a.p.id, 1, { fechaInicioEditor: '2026-10-01' }, a.editor.id); // vencido, sin entregar
    await crearCapitulo(a.p.id, 2, a.editor.id);
    await actualizarCapituloEditor(a.p.id, 2, { fechaInicioEditor: '2026-10-01' }, a.editor.id); // también vencido

    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    expect(data.riskProjects).toHaveLength(1);
    expect(data.riskProjects[0]!.projectId).toBe(a.p.id);
    expect(data.riskProjects[0]!.interventionsAtRisk).toBe(2);
  });

  it('filtros: service limita el corte actual Y el histórico de forma consistente', async () => {
    const a = await proyectoConEditor();
    await crearCapitulo(a.p.id, 1, a.editor.id);
    await actualizarCapituloEditor(a.p.id, 1, { fechaInicioEditor: '2026-10-10', fechaEntregaEditor: '2026-10-15' }, a.editor.id);
    const b = await proyectoConEditor();
    await crearCapitulo(b.p.id, 1, b.editor.id);
    await actualizarCapituloEditor(b.p.id, 1, { fechaInicioEditor: '2026-10-10', fechaEntregaEditor: '2026-10-15' }, b.editor.id);

    const sinFiltro = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    expect(sinFiltro.kpis.projectsInEditing.value).toBe(2);
    expect(sinFiltro.kpis.completedDeliveries.value).toBe(2);
    expect(sinFiltro.filters.services.length).toBe(2);

    const conFiltro = await obtenerIndicadoresEdicion({ preset: 'este-mes', service: a.p.servicioId! }, now);
    expect(conFiltro.kpis.projectsInEditing.value).toBe(1);
    expect(conFiltro.kpis.completedDeliveries.value).toBe(1);
    expect(conFiltro.filters.services.length).toBe(2);
  });

  it('IDOR/alcance: un editor inexistente como filtro no amplía el alcance, solo devuelve vacío', async () => {
    await proyectoConEditor();
    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes', editor: randomUUID() }, now);
    expect(data.kpis.projectsInEditing.value).toBe(0);
    expect(data.kpis.completedDeliveries.value).toBe(0);
  });

  it('CSV de exportación refleja los mismos valores que el JSON, con BOM y celdas sin inyección', async () => {
    const a = await proyectoConEditor();
    await crearCapitulo(a.p.id, 1, a.editor.id);
    await actualizarCapituloEditor(a.p.id, 1, { fechaInicioEditor: '2026-10-10', fechaEntregaEditor: '2026-10-15' }, a.editor.id);
    const data = await obtenerIndicadoresEdicion({ preset: 'este-mes' }, now);
    const csv = csvIndicadoresEdicion(data);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Entregas completadas en el período');
    expect(csv).toContain(String(data.kpis.completedDeliveries.value));
  });

  it('HTTP: GET /indicadores y /indicadores/export.csv responden consistentes con la función directa', async () => {
    const chief = await person('jefe_edicion');
    const response = await api('/indicadores?preset=este-mes', chief.id);
    expect(response.statusCode).toBe(200);
    expect(response.json().kpis.projectsInEditing.value).toBe(0);

    const csvResponse = await api('/indicadores/export.csv?preset=este-mes', chief.id);
    expect(csvResponse.statusCode).toBe(200);
    expect(csvResponse.headers['content-type']).toContain('text/csv');
    expect(csvResponse.headers['content-disposition']).toContain('attachment');
  });
});
