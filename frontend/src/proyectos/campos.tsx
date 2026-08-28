// Piezas compartidas de solo-lectura para las secciones de la ficha.
// Antes se repetía este mismo dl/filter en cada componente de sección
// (ver SeccionProyectoPerfil/Contrato); a partir de la tercera sección
// que lo necesita se extrae en vez de seguir copiando.
export function SinCompletar() {
  return <p className="text-sm italic text-tinta/50">Sin completar</p>;
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatearFecha(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es');
}

// Para CamposReadOnly: a diferencia de formatearFecha, null se queda
// null (no "—") para que el campo se trate como vacío y desaparezca de
// la lista en vez de mostrar un guion suelto.
export function formatearFechaONull(fecha: string | null): string | null {
  return fecha ? formatearFecha(fecha) : null;
}

// Clases Clean SaaS compartidas por los paneles de estatus agregado
// (SeccionEdicion.tsx, SeccionCorreccionControl.tsx — misma forma de
// input/label desde el primer panel del pedido, extraídas ahora que hay
// un segundo idéntico en vez de copiarlas de nuevo).
export const LABEL_CLASS = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500';
export const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-all focus:ring-2 focus:ring-tinta/20';

export function BadgeEstatus({ estatus }: { estatus: string | null }) {
  if (!estatus) {
    return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">Sin estatus</span>;
  }
  if (estatus === 'Aprobado' || estatus === 'Entregado') {
    return <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">{estatus}</span>;
  }
  if (estatus.startsWith('En revisión') || estatus === 'En proceso') {
    return <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">{estatus}</span>;
  }
  return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{estatus}</span>;
}

// Bloque de resumen de solo lectura de un panel de estatus agregado:
// mismo ancho de columna (span) que el input equivalente en el
// formulario, para que el grid no "salte" al cambiar entre editar y ver.
export function CampoResumen({ etiqueta, valor, span }: { etiqueta: string; valor: string | null; span: string }) {
  return (
    <div className={span}>
      <span className={LABEL_CLASS}>{etiqueta}</span>
      <p className="font-medium text-gray-900">{valor ?? <span className="font-normal text-gray-400">Sin completar</span>}</p>
    </div>
  );
}

export function CamposReadOnly({ campos }: { campos: Array<{ etiqueta: string; valor: string | number | null }> }) {
  const conValor = campos.filter((c) => c.valor !== null && c.valor !== '');
  if (conValor.length === 0) return <SinCompletar />;

  return (
    <dl className="space-y-1 text-sm">
      {conValor.map((c) => (
        <div key={c.etiqueta}>
          <dt className="inline font-medium text-tinta/70">{c.etiqueta}: </dt>
          <dd className="inline text-tinta">{c.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
