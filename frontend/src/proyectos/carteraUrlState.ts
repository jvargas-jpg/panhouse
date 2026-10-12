// Cambiar una vista/filtro conserva el contexto de cartera y normaliza los
// enlaces antiguos de Inicio, que todavía usan q como nombre de búsqueda.
export function actualizarUrlCartera(current: URLSearchParams, values: Record<string, string>, resetPage = true): URLSearchParams {
  const next = new URLSearchParams(current);
  next.set('vista', 'mis-proyectos');
  if (next.has('q') && !next.has('search')) next.set('search', next.get('q') ?? '');
  next.delete('q');
  for (const [key, value] of Object.entries(values)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  if (resetPage) next.delete('page');
  return next;
}
