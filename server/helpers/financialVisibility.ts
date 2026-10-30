import type { FastifyRequest } from 'fastify';
import { ROLES_LECTURA_PAGOS } from '../../shared/pagos.js';

const privateFields = new Set(['montoContractual','monedaContractual','solvenciaMotivo','solvenciaPorId','solvenciaEn',
  'monto_contractual','moneda_contractual','solvencia_motivo','solvencia_por_id','solvencia_en']);
// Legacy project endpoints return full project rows. Apply the same field
// capability there, including nested mutation responses, before serialization.
export function financialResponseForRole(request: FastifyRequest, payload: unknown): unknown {
  if ((ROLES_LECTURA_PAGOS as readonly string[]).includes(request.user?.rol ?? '')) return payload;
  function redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(redact);
    if (!value || typeof value !== 'object' || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !privateFields.has(key)).map(([key,v]) => [key,redact(v)]));
  }
  return redact(payload);
}
