import { describe, expect, it } from 'vitest';
import { filtrarIngresos } from '../frontend/src/rrpp/ingresosView.js';
const filas = [
  {
    id: 'a',
    nombre: 'Ana, Pedro',
    codigo: 'ABC123',
    servicio: { codigo: 'CR', nombre: 'Crudo' },
    estado: 'nuevo',
    titulo: null,
    posibleTitulo: 'Memorias',
    actualizadoAt: '2026-10-09T10:00:00Z',
  },
  {
    id: 'b',
    nombre: 'Beatriz',
    codigo: 'DEF456',
    servicio: { codigo: 'EF', nombre: 'Escritura fantasma' },
    estado: 'listo',
    titulo: null,
    posibleTitulo: null,
    actualizadoAt: '2026-10-09T12:00:00Z',
  },
  {
    id: 'c',
    nombre: 'Carlos',
    codigo: 'GHI789',
    servicio: { codigo: 'CR', nombre: 'Crudo' },
    estado: 'enviado',
    titulo: 'Título anterior',
    posibleTitulo: null,
    actualizadoAt: null,
  },
];
const base = {
  estado: 'todos',
  busqueda: '',
  servicio: '',
  orden: 'recientes',
};
describe('Filtros del workspace RRPP', () => {
  it.each([' Pedro ', 'memorias', 'abc123'])(
    'busca coautor, título tentativo y código: %s',
    (busqueda) => {
      expect(
        filtrarIngresos(filas, { ...base, busqueda }).map((f) => f.id),
      ).toEqual(['a']);
    },
  );
  it('no mezcla enviados con nuevos o listos y combina servicio con estado', () => {
    expect(
      filtrarIngresos(filas, {
        ...base,
        estado: 'enviado',
        servicio: 'CR',
      }).map((f) => f.id),
    ).toEqual(['c']);
    expect(
      filtrarIngresos(filas, { ...base, estado: 'listo', servicio: 'CR' }),
    ).toEqual([]);
  });
  it('ordena fechas reales, legacy sin fecha y autor sin mutar la lista original', () => {
    expect(filtrarIngresos(filas, base).map((f) => f.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(
      filtrarIngresos(filas, { ...base, orden: 'antiguos' }).map((f) => f.id),
    ).toEqual(['c', 'a', 'b']);
    expect(
      filtrarIngresos(filas, { ...base, orden: 'autor' }).map((f) => f.id),
    ).toEqual(['a', 'b', 'c']);
    expect(filas.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });
  it('búsqueda sin coincidencias produce el empty state y incluye título histórico', () => {
    expect(
      filtrarIngresos(filas, { ...base, busqueda: 'inexistente' }),
    ).toEqual([]);
    expect(
      filtrarIngresos(filas, { ...base, busqueda: 'Título anterior' }).map(
        (f) => f.id,
      ),
    ).toEqual(['c']);
  });
});
