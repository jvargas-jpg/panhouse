import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ALGORITMO = 'HS256';
const EXPIRACION = '2m';

export interface AutorParaTokenPagos {
  email: string;
}

export interface TokenAccesoPagosPayload {
  email: string;
  iat: number;
  exp: number;
}

// SSO con el portal de pago — diseño asumido, pendiente de confirmar
// con el equipo de pagos (ver .env.example). Nuestro sistema emite
// este token cuando el autor hace clic en "Pagos" desde su portal; el
// sistema de pago lo verificaría con la misma clave compartida
// (PAYMENT_SSO_SECRET). Es un pase de un solo uso para entrar, no una
// sesión larga — por eso expira en 2 minutos, no en horas.
export function generarTokenAccesoPagos(autor: AutorParaTokenPagos): string {
  return jwt.sign({ email: autor.email }, env.PAYMENT_SSO_SECRET, {
    algorithm: ALGORITMO,
    expiresIn: EXPIRACION,
  });
}

// El sistema de pago sería quien la use en la práctica, no nosotros —
// vive aquí como referencia exacta de cómo debe verificarse del otro
// lado, y nos deja probar en nuestros tests que lo que emitimos es
// válido. Lanza (errores nativos de jsonwebtoken) si la firma no
// coincide o si el token ya expiró.
export function verificarTokenAccesoPagos(token: string): TokenAccesoPagosPayload {
  return jwt.verify(token, env.PAYMENT_SSO_SECRET, { algorithms: [ALGORITMO] }) as TokenAccesoPagosPayload;
}
