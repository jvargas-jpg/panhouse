import type { EstadoProyecto } from '../types/api';
import { ESTADO_CLASE, ESTADO_LABEL } from './estado';

export function EstadoBadge({ estado }: { estado: EstadoProyecto }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_CLASE[estado]}`}>{ESTADO_LABEL[estado]}</span>
  );
}
