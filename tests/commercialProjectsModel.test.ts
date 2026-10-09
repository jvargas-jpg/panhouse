import { describe, expect, it } from 'vitest';
import { buildProjects, commercialProjectStatus } from '../frontend/src/comercial/proyectos/projectsModel.js';
import type { ProyectoResumen } from '../frontend/src/types/api.js';

const proyecto = (id: string, listoParaRrpp: boolean, notificadoRrpp: boolean): ProyectoResumen => ({
  id, listoParaRrpp, notificadoRrpp, rrppEnviadoAt: null, faltantesComercial: listoParaRrpp ? [] : ['paginasPactadas'],
  titulo: null, codigo: id, estado: 'en_proceso', unidadId: 'unidad', presupuestoId: 'presupuesto', fechaProgramadaInicio: '2026-10-09',
  autor: { id: 'autor', nombre: 'Autor' }, autores: [{ id: 'autor', nombre: 'Autor', nombreArtistico: null }],
  servicio: { id: 'servicio', codigo: 'CR', nombre: 'Crudo' },
});

describe('estados y filtros comerciales con handoff real', () => {
  const activos = [proyecto('pendiente', false, false), proyecto('listo', true, false), proyecto('enviado', true, true), proyecto('corregido', false, true)];
  it.each([
    ['todos', ['pendiente', 'listo', 'enviado', 'corregido']], ['pendientes', ['pendiente']],
    ['listos', ['listo']], ['enviados', ['enviado', 'corregido']],
  ] as const)('filtro %s es exclusivo y basado en readiness/flag persistido', (filtro, ids) => {
    const filas = buildProjects(activos, filtro);
    expect(filas.map((p) => p.id)).toEqual(ids);
    expect(filas.every((p) => p.estado === 'en_proceso')).toBe(true);
  });
  it('un envío previo tiene prioridad aunque la ficha cambie y pierda readiness', () => {
    expect(commercialProjectStatus(activos[3]!)).toBe('enviados');
    expect(commercialProjectStatus(activos[1]!)).toBe('listos');
    expect(activos.filter((p) => p.listoParaRrpp)).toHaveLength(2);
    expect(buildProjects(activos, 'listos')).toHaveLength(1);
  });
});
