import { calcularEstadoTraspaso, ESTADO_TRASPASO_CLASE } from './estadoTraspaso';

export function EstadoTraspasoBadge({ notificadoRrpp, notificadoJefatura }: { notificadoRrpp: boolean; notificadoJefatura: boolean }) {
  const estado = calcularEstadoTraspaso(notificadoRrpp, notificadoJefatura);
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_TRASPASO_CLASE[estado]}`}>{estado}</span>;
}
