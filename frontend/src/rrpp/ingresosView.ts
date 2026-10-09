type IngresoFiltrable = {
  nombre: string;
  codigo: string;
  titulo: string | null;
  posibleTitulo: string | null;
  estado: string;
  servicio: { codigo: string };
  actualizadoAt: string | null;
};
export function filtrarIngresos<T extends IngresoFiltrable>(
  ingresos: T[],
  filtros: {
    estado: string;
    busqueda: string;
    servicio: string;
    orden: string;
  },
) {
  const texto = filtros.busqueda.trim().toLocaleLowerCase();
  return ingresos
    .filter(
      (i) =>
        (filtros.estado === 'todos' || i.estado === filtros.estado) &&
        (!filtros.servicio || i.servicio.codigo === filtros.servicio) &&
        (!texto ||
          [i.nombre, i.codigo, i.titulo, i.posibleTitulo].some((v) =>
            v?.toLocaleLowerCase().includes(texto),
          )),
    )
    .sort((a, b) =>
      filtros.orden === 'autor'
        ? a.nombre.localeCompare(b.nombre, 'es')
        : filtros.orden === 'antiguos'
          ? (a.actualizadoAt ?? '').localeCompare(b.actualizadoAt ?? '')
          : (b.actualizadoAt ?? '').localeCompare(a.actualizadoAt ?? ''),
    );
}
