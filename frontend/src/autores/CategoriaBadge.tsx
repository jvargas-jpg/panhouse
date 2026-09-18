import type { CategoriaCliente } from '../types/api';

// VIP en dorado (mismo tono de acento que el resto de la app —
// bg-dorado/text-dorado, ver EtiquetasPersonalidad.tsx, botones
// primarios, etc.), Estándar en gris neutro — mismo criterio visual que
// EstadoBadge.tsx: una sola pastilla, sin icono.
const CATEGORIA_CLASE: Record<CategoriaCliente, string> = {
  VIP: 'bg-dorado/15 text-dorado border border-dorado/30',
  Estándar: 'bg-gray-100 text-gray-600 border border-gray-200',
};

export function CategoriaBadge({ categoria }: { categoria: CategoriaCliente }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORIA_CLASE[categoria]}`}>
      {categoria}
    </span>
  );
}
