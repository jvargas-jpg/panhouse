import { describe, expect, it } from 'vitest';
import { evaluarPreparacionComercial, type DatosPreparacionComercial } from '../server/helpers/preparacionComercial.js';
const completo: DatosPreparacionComercial = { autores: [{ id: 'autor' }], servicioId: 'CR', unidadId: 'unidad', presupuestoId: 'plata',
  ingresoFechaIngreso: '2026-10-02', ingresoServicioEjecucion: 'Normal', ingresoServicioAlianza: false,
  capitulosPactados: '1 a 5', paginasPactadas: '100' };
describe('preparación comercial derivada', () => {
  it('está listo con los nueve requisitos comerciales, incluyendo alianza false', () => {
    expect(evaluarPreparacionComercial(completo)).toEqual({ listoParaRrpp: true, faltantesComercial: [] });
  });
  it.each(['capitulosPactados', 'paginasPactadas', 'servicioId', 'unidadId', 'presupuestoId', 'ingresoFechaIngreso', 'ingresoServicioEjecucion', 'ingresoServicioAlianza'] as const)('detecta %s ausente', (campo) => {
    expect(evaluarPreparacionComercial({ ...completo, [campo]: null })).toEqual({ listoParaRrpp: false, faltantesComercial: [campo] });
  });
  it('identifica ambos términos contractuales pendientes', () => {
    expect(evaluarPreparacionComercial({ ...completo, capitulosPactados: '', paginasPactadas: '  ' })).toEqual({ listoParaRrpp: false, faltantesComercial: ['capitulosPactados', 'paginasPactadas'] });
  });
  it('exige al menos un autor', () => {
    expect(evaluarPreparacionComercial({ ...completo, autores: [] }).faltantesComercial).toEqual(['autores']);
  });
  it('CR sin subtipo ni cierre ni datos editoriales RRPP está listo', () => {
    const datos = { ...completo, ingresoServicioSubtipoCrudo: null, ingresoFechaCierre: null, temaGeneral: null };
    expect(evaluarPreparacionComercial(datos).listoParaRrpp).toBe(true);
  });
  it.each(['criterioExtra', 'condicionesEspeciales', 'ingresoObservaciones'])('%s vacío no bloquea', (campo) => {
    expect(evaluarPreparacionComercial({ ...completo, [campo]: null }).listoParaRrpp).toBe(true);
  });
});
