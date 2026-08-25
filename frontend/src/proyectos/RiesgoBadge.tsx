import type { RiesgoProyecto } from '../types/api';

export function RiesgoBadge({ riesgo }: { riesgo: RiesgoProyecto }) {
  if (riesgo.vencido) {
    return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">Vencido</span>;
  }

  if (riesgo.enRiesgo) {
    return (
      <span className="rounded-full bg-dorado/30 px-2.5 py-1 text-xs font-medium text-tinta">
        En riesgo · {riesgo.diasRestantes}d restantes
      </span>
    );
  }

  return <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">En plazo</span>;
}
