import { describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { financialResponseForRole } from '../server/helpers/financialVisibility.js';
describe('DTO financiero en respuestas heredadas', () => {
  const request = (rol: string) => ({ user:{ rol } }) as FastifyRequest;
  it('elimina campos contractuales privados de proyectos anidados para otras áreas', () => {
    expect(financialResponseForRole(request('especialista'),{ proyecto:{ id:'p',montoContractual:'10.00',monedaContractual:'USD',solvenciaMotivo:'Privado',solvenciaEstado:'Pendiente' } })).toEqual({ proyecto:{ id:'p',solvenciaEstado:'Pendiente' } });
  });
  it('conserva intactos errores y objetos de infraestructura para el serializer de Fastify', () => {
    const error = Object.assign(new Error('Datos inválidos'),{ statusCode:400 });
    expect(financialResponseForRole(request('rrpp'),error)).toBe(error);
    expect(financialResponseForRole(request('especialista'),error)).toBe(error);
    const date = new Date(); expect(financialResponseForRole(request('especialista'),{ date })).toEqual({ date });
  });
  it('conserva lectura autorizada y deja Cobranzas fuera de la etapa actual', () => {
    const payload = { proyecto:{ montoContractual:'10.00' } };
    for (const rol of ['comercial','admin']) expect(financialResponseForRole(request(rol),payload)).toBe(payload);
    expect(financialResponseForRole(request('cobranzas'),payload)).toEqual({ proyecto:{} });
  });
});
