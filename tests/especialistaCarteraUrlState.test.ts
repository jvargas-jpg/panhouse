import { describe, expect, it } from 'vitest';
import { actualizarUrlCartera } from '../frontend/src/proyectos/carteraUrlState.js';

describe('Navegación y filtros de cartera', () => {
  it('buscar desde Inicio y ordenar conserva búsqueda y filtros, reiniciando página', () => {
    const before = new URLSearchParams('vista=mis-proyectos&q=DEMO&servicio=uuid&riesgo=si&page=2');
    const next = actualizarUrlCartera(before, { orden: 'autor' });
    expect(Object.fromEntries(next)).toEqual({ vista:'mis-proyectos', search:'DEMO', servicio:'uuid', riesgo:'si', orden:'autor' });
    expect(before.get('q')).toBe('DEMO'); // El estado de origen no se muta.
  });
  it('una búsqueda canónica conserva prioridad sobre un q antiguo al cambiar tab', () => {
    const next = actualizarUrlCartera(new URLSearchParams('search=Nuevo&q=Anterior&estado=en_proceso&page=4'), { tab:'cerrados', estado:'' });
    expect(Object.fromEntries(next)).toEqual({ vista:'mis-proyectos', search:'Nuevo', tab:'cerrados' });
  });
  it('paginar mantiene búsqueda, subtipo y orden para el retorno desde Command Center', () => {
    const next = actualizarUrlCartera(new URLSearchParams('search=Lucía&subtipo=Tripa&orden=fecha&pageSize=10&page=1'), { page:'2' }, false);
    expect(Object.fromEntries(next)).toEqual({ vista:'mis-proyectos', search:'Lucía', subtipo:'Tripa', orden:'fecha', pageSize:'10', page:'2' });
  });
  it('limpiar búsqueda antigua elimina ambos nombres sin borrar otros filtros', () => {
    const next = actualizarUrlCartera(new URLSearchParams('q=DEMO&riesgo=si'), { search:'' });
    expect(Object.fromEntries(next)).toEqual({ vista:'mis-proyectos', riesgo:'si' });
  });
});
