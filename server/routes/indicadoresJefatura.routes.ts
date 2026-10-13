import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { parseOrReply } from '../helpers/validate.js';
import {
  obtenerIndicadoresJefatura,
  csvIndicadoresJefatura,
} from '../helpers/indicadoresJefatura.js';
import { ESTADOS_INDICADOR } from '../../shared/indicadoresJefatura.js';
import type {
  EstadoIndicador,
  FiltrosIndicadoresJefatura,
} from '../../shared/indicadoresJefatura.js';

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      Number.isFinite(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    'Fecha inválida',
  );
const filtros = z
  .object({
    from: fecha.optional(),
    to: fecha.optional(),
    servicioId: z.string().uuid().optional(),
    especialistaId: z
      .union([z.string().uuid(), z.literal('sin_asignar')])
      .optional(),
    prioridad: z.enum(['confirmado', 'posible', 'normal']).optional(),
    estado: z
      .enum(
        Object.keys(ESTADOS_INDICADOR) as [
          EstadoIndicador,
          ...EstadoIndicador[],
        ],
      )
      .optional(),
  })
  .strict()
  .superRefine((f, c) => {
    if (!!f.from !== !!f.to)
      c.addIssue({ code: 'custom', message: 'Indica ambas fechas' });
    if (
      f.from &&
      f.to &&
      (f.from > f.to ||
        (Date.parse(f.to) - Date.parse(f.from)) / 86400000 > 365)
    )
      c.addIssue({
        code: 'custom',
        message: 'El rango debe estar ordenado y abarcar como máximo 366 días',
      });
  });
export async function indicadoresJefaturaRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireRole('jefe_area')];
  for (const exportar of [false, true])
    app.get(
      exportar ? '/indicadores/export.csv' : '/indicadores',
      { preHandler },
      async (req, reply) => {
        const f = parseOrReply(filtros, req.query, reply);
        if (!f) return;
        const hoy = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Caracas',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
        const data = await obtenerIndicadoresJefatura({
          ...f,
          from: f.from ?? `${hoy.slice(0, 7)}-01`,
          to: f.to ?? hoy,
        } as FiltrosIndicadoresJefatura);
        reply.header('Cache-Control', 'private, no-store');
        if (!exportar) return data;
        return reply
          .type('text/csv; charset=utf-8')
          .header(
            'Content-Disposition',
            `attachment; filename="indicadores-jefatura-${data.periodo.from}-${data.periodo.to}.csv"`,
          )
          .send(csvIndicadoresJefatura(data));
      },
    );
}
