import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generarTokenAccesoPagos, verificarTokenAccesoPagos } from '../server/helpers/pagos.js';

describe('generarTokenAccesoPagos', () => {
  it('genera un JWT con el formato esperado (header.payload.firma)', () => {
    const token = generarTokenAccesoPagos({ email: 'autor@panhouse.test' });

    expect(token.split('.')).toHaveLength(3);
  });

  it('incluye el correo del autor, fecha de emisión y una expiración de 2 minutos', () => {
    const token = generarTokenAccesoPagos({ email: 'autor@panhouse.test' });

    const payload = verificarTokenAccesoPagos(token);

    expect(payload.email).toBe('autor@panhouse.test');
    expect(payload.iat).toBeTypeOf('number');
    expect(payload.exp).toBeTypeOf('number');
    expect(payload.exp - payload.iat).toBe(120);
  });
});

describe('verificarTokenAccesoPagos', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('acepta un token recién emitido', () => {
    const token = generarTokenAccesoPagos({ email: 'autor@panhouse.test' });

    expect(() => verificarTokenAccesoPagos(token)).not.toThrow();
  });

  it('rechaza un token expirado, pasados los 2 minutos', () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const token = generarTokenAccesoPagos({ email: 'autor@panhouse.test' });

    vi.advanceTimersByTime(2 * 60 * 1000 + 1000); // 2:01

    expect(() => verificarTokenAccesoPagos(token)).toThrow();
  });

  it('acepta un token justo antes de expirar, y lo rechaza un segundo después', () => {
    vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    const token = generarTokenAccesoPagos({ email: 'autor@panhouse.test' });

    vi.advanceTimersByTime(119 * 1000); // 1:59
    expect(() => verificarTokenAccesoPagos(token)).not.toThrow();

    vi.advanceTimersByTime(2 * 1000); // 2:01
    expect(() => verificarTokenAccesoPagos(token)).toThrow();
  });

  it('rechaza un token firmado con una clave distinta', () => {
    const tokenAjeno = jwt.sign({ email: 'autor@panhouse.test' }, 'una-clave-que-no-es-la-nuestra', {
      algorithm: 'HS256',
      expiresIn: '2m',
    });

    expect(() => verificarTokenAccesoPagos(tokenAjeno)).toThrow();
  });

  it('rechaza un token con la firma manipulada', () => {
    const token = generarTokenAccesoPagos({ email: 'autor@panhouse.test' });
    const ultimoCaracter = token.at(-1);
    const manipulado = `${token.slice(0, -1)}${ultimoCaracter === 'a' ? 'b' : 'a'}`;

    expect(() => verificarTokenAccesoPagos(manipulado)).toThrow();
  });
});
