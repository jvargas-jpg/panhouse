import { Link } from 'react-router-dom';
import type {
  ActividadRrpp,
  DashboardRrpp,
  LanzamientoRrpp,
} from './rrppDashboardApi';
import { RrppIcon } from './RrppIcons';

export function fechaActividad(fecha: string | null) {
  if (!fecha) return 'Sin fecha registrada';
  const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return 'Ahora';
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} día${dias === 1 ? '' : 's'}`;
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeZone: 'America/Caracas',
  }).format(new Date(fecha));
}
export function ErrorRrpp({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-3 p-6 text-center">
      <p role="alert" className="text-sm text-gray-600">
        No se pudieron cargar los datos.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
      >
        Reintentar
      </button>
    </div>
  );
}
export function RrppKpis({
  kpis,
  loading,
  error,
  onSelect,
  onRetry,
}: {
  kpis?: DashboardRrpp['kpis'];
  loading: boolean;
  error: boolean;
  onSelect: (
    tab: 'ingresos' | 'conceptos' | 'lanzamientos',
    proceso?: boolean,
  ) => void;
  onRetry: () => void;
}) {
  const items = [
    {
      nombre: 'Nuevos ingresos',
      ayuda: 'Pendientes de diagnóstico',
      valor: kpis?.nuevos,
      icono: 'ingreso',
      tab: 'ingresos',
    },
    {
      nombre: 'Ingresos en proceso',
      ayuda: 'Completando diagnóstico',
      valor: kpis?.enProceso,
      icono: 'proceso',
      tab: 'ingresos',
      proceso: true,
    },
    {
      nombre: 'Conceptos de portada',
      ayuda: 'Pendientes de aprobación',
      valor: kpis?.conceptos,
      icono: 'conceptos',
      tab: 'conceptos',
    },
    {
      nombre: 'Lanzamientos próximos',
      ayuda: 'En planificación · próximos 30 días',
      valor: kpis?.lanzamientos,
      icono: 'lanzamiento',
      tab: 'lanzamientos',
    },
  ] as const;
  return (
    <div className="mb-5 grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <button
          type="button"
          key={item.nombre}
          disabled={loading}
          onClick={() =>
            error
              ? onRetry()
              : onSelect(item.tab, 'proceso' in item && item.proceso)
          }
          className="relative min-w-0 rounded-xl border border-gray-200/70 bg-white p-5 text-left shadow-sm transition-colors hover:border-dorado/40 focus-visible:ring-2 focus-visible:ring-dorado/50 disabled:cursor-wait"
        >
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <RrppIcon nombre={item.icono} />
          </span>
          <p className="text-[11px] font-semibold uppercase leading-4 text-slate-500">
            {item.nombre}
          </p>
          {loading ? (
            <span
              aria-label="Cargando indicador"
              className="my-2 block h-8 w-12 animate-pulse rounded bg-gray-100"
            />
          ) : (
            <p className="mt-1 text-[32px] font-bold leading-9 tracking-tight text-gray-900">
              {error ? '—' : (item.valor ?? '—')}
            </p>
          )}
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {error ? 'Reintentar carga' : item.ayuda}
          </p>
          <RrppIcon
            nombre="flecha"
            className="absolute right-5 top-[94px] h-4 w-4 text-amber-600"
          />
        </button>
      ))}
    </div>
  );
}
function FechaAgenda({ fecha }: { fecha: string }) {
  const date = new Date(fecha + 'T12:00:00Z');
  return (
    <span className="flex h-11 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-600">
      <span className="text-base font-bold leading-5 text-gray-900">
        {Number(fecha.slice(8))}
      </span>
      <span className="text-[10px] uppercase">
        {new Intl.DateTimeFormat('es', { month: 'short', timeZone: 'UTC' })
          .format(date)
          .replace('.', '')}
      </span>
    </span>
  );
}
export function LaunchPanel({
  datos,
  loading,
  error,
  onRetry,
}: {
  datos: LanzamientoRrpp[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <RrppIcon nombre="calendario" className="h-5 w-5 text-amber-600" />
          Lanzamientos próximos
        </h2>
        <Link
          to="/?vista=lanzamientos"
          className="shrink-0 text-xs text-blue-600 hover:underline"
        >
          Ver todos
        </Link>
      </div>
      {loading ? (
        <div aria-label="Cargando lanzamientos" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      ) : error ? (
        <ErrorRrpp onRetry={onRetry} />
      ) : datos.length === 0 ? (
        <p className="py-6 text-xs leading-5 text-slate-500">
          No hay lanzamientos próximos registrados.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {datos.slice(0, 4).map((item) => (
            <li key={item.id}>
              <Link
                to={item.href}
                className="flex items-center gap-3 py-3 hover:bg-gray-50"
              >
                <FechaAgenda fecha={item.fecha} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-xs font-semibold text-gray-900">
                    {item.proyecto.nombre}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                    {item.tipo}
                  </span>
                </span>
                <RrppIcon
                  nombre="flecha"
                  className="h-4 w-4 shrink-0 text-slate-400"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function ActivityPanel({
  datos,
  loading,
  error,
  onRetry,
}: {
  datos: ActividadRrpp[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <RrppIcon nombre="actividad" className="h-5 w-5 text-amber-600" />
          Actividad reciente
        </h2>
        <Link
          to="/?vista=actividad"
          className="shrink-0 text-xs text-blue-600 hover:underline"
        >
          Ver toda
        </Link>
      </div>
      {loading ? (
        <div aria-label="Cargando actividad" className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      ) : error ? (
        <ErrorRrpp onRetry={onRetry} />
      ) : datos.length === 0 ? (
        <p className="py-5 text-xs text-slate-500">
          No hay actividad reciente registrada.
        </p>
      ) : (
        <ol className="ml-1 border-l border-gray-200">
          {datos.slice(0, 5).map((item) => (
            <li key={item.id} className="relative pb-4 pl-5 last:pb-0">
              <span
                aria-hidden="true"
                className={`absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full ${item.contexto === 'conceptos' ? 'bg-violet-400' : item.titulo.includes('Comercial') ? 'bg-slate-500' : 'bg-blue-500'}`}
              />
              <Link
                to={`/proyectos/${item.proyecto.id}/ficha-trazabilidad`}
                className="block text-xs font-semibold leading-5 text-gray-900 hover:underline"
              >
                {item.titulo}
              </Link>
              <p className="break-words text-[11px] leading-4 text-slate-500">
                {item.proyecto.nombre} — #{item.proyecto.codigo}
              </p>
              <time
                dateTime={item.fecha}
                title={new Date(item.fecha).toLocaleString('es')}
                className="text-[11px] text-slate-500"
              >
                {fechaActividad(item.fecha)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
