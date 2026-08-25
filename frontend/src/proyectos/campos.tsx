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
