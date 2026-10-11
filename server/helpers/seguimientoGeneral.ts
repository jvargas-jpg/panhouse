import type {
  FiltrosSeguimientoGeneral,
  SeguimientoGeneral,
} from '../../shared/seguimientoOperativo.js';
import { obtenerDashboardJefatura } from './jefatura.js';
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export async function obtenerSeguimientoGeneral(
  f: FiltrosSeguimientoGeneral,
  ahora = new Date(),
): Promise<SeguimientoGeneral> {
  const snapshot = await obtenerDashboardJefatura(ahora);
  const proximos = (p: (typeof snapshot.proyectos)[number]) =>
    p.procesos.some(
      (r) =>
        r.vence &&
        !r.vencido &&
        new Date(r.vence).getTime() - ahora.getTime() <= 86400000,
    );
  const bloqueados = (p: (typeof snapshot.proyectos)[number]) =>
    p.procesos.some((r) => r.estado === 'bloqueado');
  const todos = snapshot.proyectos;
  const items = todos.filter(
    (p) =>
      (!f.proyectoId || p.id === f.proyectoId) &&
      (!f.proceso || p.procesos.some((r) => r.tipo === f.proceso)) &&
      (!f.especialistaId ||
        (f.especialistaId === 'sin_asignar'
          ? !p.especialista
          : p.especialista?.id === f.especialistaId)) &&
      (!f.estado || p.estado === f.estado) &&
      (!f.q ||
        normalizar(`${p.codigo} ${p.autores} ${p.titulo ?? ''}`).includes(
          normalizar(f.q),
        )) &&
      (!f.riesgo ||
        (f.riesgo === 'riesgo'
          ? p.riesgo.atencion
          : f.riesgo === 'bloqueados'
            ? bloqueados(p)
            : f.riesgo === 'express'
              ? p.express.estado === 'confirmado'
              : proximos(p))),
  );
  const vencimiento = (p: (typeof todos)[number]) =>
    p.procesos
      .map((r) => r.vence)
      .filter((v): v is string => !!v)
      .sort()[0] ?? '9999';
  items.sort(
    (a, b) =>
      (f.orden === 'recientes'
        ? b.creadoEn.localeCompare(a.creadoEn)
        : f.orden === 'vencimiento'
          ? vencimiento(a).localeCompare(vencimiento(b))
          : Number(b.riesgo.vencido) - Number(a.riesgo.vencido) ||
            Number(bloqueados(b)) - Number(bloqueados(a)) ||
            Number(b.riesgo.atencion) - Number(a.riesgo.atencion) ||
            vencimiento(a).localeCompare(vencimiento(b))) ||
      a.codigo.localeCompare(b.codigo) ||
      a.id.localeCompare(b.id),
  );
  const pages = Math.max(1, Math.ceil(items.length / f.pageSize)),
    page = Math.min(f.page, pages);
  return {
    items: items.slice((page - 1) * f.pageSize, page * f.pageSize),
    pagination: { page, pageSize: f.pageSize, pages, total: items.length },
    counts: {
      seguimiento: todos.length,
      riesgo: todos.filter((p) => p.riesgo.atencion).length,
      bloqueados: todos.filter(bloqueados).length,
      proximos: todos.filter(proximos).length,
      express: todos.filter((p) => p.express.estado === 'confirmado').length,
    },
    filters: {
      especialistas: snapshot.teamCapacity.map(({ id, nombre }) => ({
        id,
        nombre,
      })),
      procesos: [
        ...new Map(
          todos.flatMap((p) =>
            p.procesos.map(
              (r) => [r.tipo, { id: r.tipo, nombre: r.nombre }] as const,
            ),
          ),
        ).values(),
      ],
    },
  };
}
