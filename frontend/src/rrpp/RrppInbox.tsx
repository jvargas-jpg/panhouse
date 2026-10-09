import { useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ConceptosRrpp,
  DashboardRrpp,
  IngresoRrpp,
  LanzamientoRrpp,
  ProyectoRrpp,
} from './rrppDashboardApi';
import { ErrorRrpp, fechaActividad } from './RrppDashboardCards';

export type TabRrpp = 'ingresos' | 'conceptos' | 'lanzamientos' | 'todos';
type Tarea = {
  id: string;
  proyecto: ProyectoRrpp;
  estado: string;
  ayuda: string;
  fecha: string | null;
  origen: string;
  accion: string;
  color: string;
  ingreso?: IngresoRrpp;
  conceptos?: ConceptosRrpp;
  lanzamiento?: LanzamientoRrpp;
};
const GRID =
  'xl:grid xl:grid-cols-[minmax(130px,1.3fr)_minmax(110px,1.1fr)_minmax(120px,1.1fr)_minmax(110px,1fr)_160px] xl:items-center xl:gap-4';

function MenuFila({ proyecto }: { proyecto: ProyectoRrpp }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAbierto(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setAbierto(false);
      }}
    >
      <button
        type="button"
        aria-label={`Más opciones de ${proyecto.nombre} #${proyecto.codigo}`}
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className="rounded px-2 py-1 text-lg text-slate-500 hover:bg-gray-100"
      >
        ⋮
      </button>
      {abierto && (
        <div className="absolute right-0 top-8 z-10 w-40 rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-lg">
          <Link
            to={`/proyectos/${proyecto.id}/ficha-trazabilidad`}
            className="block px-3 py-2 hover:bg-gray-50"
          >
            Ver ficha
          </Link>
          <Link
            to={`/proyectos/${proyecto.id}`}
            className="block px-3 py-2 hover:bg-gray-50"
          >
            Ver proyecto
          </Link>
        </div>
      )}
    </div>
  );
}
function Fila({
  tarea,
  iniciar,
  iniciando,
  error,
  revisar,
}: {
  tarea: Tarea;
  iniciar: (id: string) => void;
  iniciando: boolean;
  error?: string;
  revisar: (c: ConceptosRrpp) => void;
}) {
  const p = tarea.proyecto;
  const destino =
    tarea.lanzamiento?.href ?? `/proyectos/${p.id}/ficha-trazabilidad`;
  const boton =
    'whitespace-nowrap rounded-lg border border-amber-400/70 px-2.5 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-60';
  return (
    <div
      className={`${GRID} grid grid-cols-1 gap-3 border-t border-gray-100 px-5 py-4 text-xs sm:grid-cols-2`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 font-semibold text-amber-600">
          {p.autores
            .map((a) => a.nombre.trim().charAt(0))
            .slice(0, 2)
            .join('')
            .toUpperCase()}
        </span>
        <div className="min-w-0">
          <Link
            to={destino}
            className="break-words text-[13px] font-semibold leading-5 text-gray-900 hover:underline"
          >
            {p.nombre}
          </Link>
          <p className="mt-0.5 text-[11px] text-slate-500">#{p.codigo}</p>
        </div>
      </div>
      <div className="min-w-0">
        <span className="inline-block rounded-md border border-gray-200 bg-gray-50/50 px-2 py-1.5 leading-4 text-slate-700">
          {p.servicio.codigo} — {p.servicio.nombre}
        </span>
        {p.servicio.codigo === 'CR' && p.subtipoCrudo && (
          <p className="mt-1 text-[11px] text-slate-500">
            Crudo {p.subtipoCrudo}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <span
          className={`inline-block rounded-lg px-2 py-1 text-[11px] font-medium leading-4 ${tarea.color}`}
        >
          {tarea.estado}
        </span>
        <p className="mt-1.5 break-words text-[11px] leading-4 text-slate-500">
          {tarea.ayuda}
        </p>
      </div>
      <div className="min-w-0">
        <p className="leading-5 text-slate-700">
          {tarea.lanzamiento
            ? new Date(
                tarea.lanzamiento.fecha + 'T12:00:00Z',
              ).toLocaleDateString('es', {
                dateStyle: 'medium',
                timeZone: 'UTC',
              })
            : fechaActividad(tarea.fecha)}
        </p>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
          {tarea.origen}
        </p>
      </div>
      <div className="sm:col-span-2 xl:col-span-1">
        <div className="flex items-center justify-end gap-1">
          {tarea.ingreso?.estado === 'nuevo' ? (
            <button
              type="button"
              className={`${boton} border-transparent bg-dorado text-gray-900 hover:bg-amber-400`}
              disabled={iniciando}
              onClick={() => iniciar(p.id)}
            >
              {iniciando ? 'Iniciando…' : tarea.accion}
            </button>
          ) : tarea.conceptos ? (
            <button
              type="button"
              className={boton}
              onClick={() => revisar(tarea.conceptos!)}
            >
              {tarea.accion}
            </button>
          ) : (
            <Link
              to={destino}
              className={`${boton} ${tarea.ingreso?.estado === 'completo' ? 'border-gray-200' : ''}`}
            >
              {tarea.accion}
            </Link>
          )}
          <MenuFila proyecto={p} />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
export function RrppInbox({
  datos,
  tab,
  estado,
  proyectos,
  loading,
  error,
  onRetry,
  onTab,
  onQuitarFiltro,
  iniciar,
  iniciandoId,
  errorInicio,
  revisar,
}: {
  datos?: DashboardRrpp;
  tab: TabRrpp;
  estado?: 'nuevo' | 'diagnostico';
  proyectos: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onTab: (tab: TabRrpp) => void;
  onQuitarFiltro: () => void;
  iniciar: (id: string) => void;
  iniciandoId?: string;
  errorInicio?: { id: string; mensaje: string };
  revisar: (c: ConceptosRrpp) => void;
}) {
  const ingresos: Tarea[] = (datos?.ingresos ?? [])
    .filter((i) => proyectos || !i.enviadoJefatura)
    .map((i) => ({
      id: `ingreso-${i.id}`,
      proyecto: i,
      ingreso: i,
      estado:
        i.estado === 'nuevo'
          ? 'Nuevo ingreso'
          : i.estado === 'diagnostico'
            ? 'En diagnóstico'
            : 'Intake completo',
      ayuda: i.pendiente,
      fecha: i.actualizadoAt,
      origen: i.actualizadoPor,
      accion:
        i.estado === 'nuevo'
          ? 'Iniciar diagnóstico'
          : i.estado === 'diagnostico'
            ? 'Continuar'
            : 'Ver detalle',
      color:
        i.estado === 'nuevo'
          ? 'bg-blue-50 text-blue-700'
          : i.estado === 'diagnostico'
            ? 'bg-amber-50 text-amber-700'
            : 'bg-emerald-50 text-emerald-700',
    }));
  const conceptos: Tarea[] = (datos?.conceptos ?? []).map((c) => ({
    id: `conceptos-${c.direccionId}`,
    proyecto: c.proyecto,
    conceptos: c,
    estado: 'Conceptos en revisión',
    ayuda: `${c.propuestas.length} propuesta${c.propuestas.length === 1 ? '' : 's'} recibida${c.propuestas.length === 1 ? '' : 's'}`,
    fecha: c.actualizadoAt,
    origen: 'Recibidas del Líder Creativo',
    accion: 'Revisar conceptos',
    color: 'bg-violet-50 text-violet-700',
  }));
  const lanzamientos: Tarea[] = (datos?.lanzamientos ?? []).map((l) => ({
    id: `lanzamiento-${l.id}`,
    proyecto: l.proyecto,
    lanzamiento: l,
    estado: 'Lanzamiento próximo',
    ayuda: l.tipo,
    fecha: null,
    origen: 'Fecha registrada en la ficha',
    accion: 'Ver lanzamiento',
    color: 'bg-amber-50 text-amber-700',
  }));
  const categorias = {
    ingresos,
    conceptos,
    lanzamientos,
    todos: [...ingresos, ...conceptos, ...lanzamientos],
  };
  const filas = (proyectos ? ingresos : categorias[tab]).filter(
    (t) => !estado || t.ingreso?.estado === estado,
  );
  const tabs = [
    { id: 'ingresos', nombre: 'Nuevos ingresos' },
    { id: 'conceptos', nombre: 'Conceptos de portada' },
    { id: 'lanzamientos', nombre: 'Lanzamientos' },
    { id: 'todos', nombre: 'Todos' },
  ] as const;
  const vacio =
    tab === 'conceptos'
      ? 'No hay conceptos esperando aprobación.'
      : tab === 'lanzamientos'
        ? 'No hay lanzamientos próximos registrados.'
        : estado === 'diagnostico'
          ? 'No hay ingresos en proceso.'
          : proyectos
            ? 'Todavía no hay proyectos enviados a RRPP.'
            : 'No hay nuevos ingresos pendientes.';
  return (
    <section className="min-w-0 rounded-xl border border-gray-200/70 bg-white shadow-sm">
      <div className="px-5 pb-4 pt-5">
        <div className="relative pl-5">
          <span
            aria-hidden="true"
            className="absolute left-0 top-0.5 h-7 w-1 rounded bg-dorado"
          />
          <h2 className="text-base font-bold text-gray-900">
            {proyectos ? 'Proyectos de RRPP' : 'Requieren tu atención'}
          </h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            {proyectos
              ? 'Proyectos recibidos por el área y su avance hacia Jefatura.'
              : 'Proyectos que necesitan tu gestión en RRPP.'}
          </p>
        </div>
        {!proyectos && (
          <div
            role="group"
            aria-label="Filtrar tareas de RRPP"
            className="mt-4 flex flex-wrap gap-2"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                onClick={() => onTab(t.id)}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-xs font-medium ${tab === t.id ? 'border-amber-100 bg-amber-50 text-gray-900' : 'border-gray-200 bg-gray-50/70 text-slate-600 hover:bg-gray-100'}`}
              >
                {t.nombre}
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  {loading || error ? '—' : categorias[t.id].length}
                </span>
              </button>
            ))}
          </div>
        )}
        {estado && (
          <p className="mt-3 text-xs text-slate-500">
            {estado === 'nuevo'
              ? 'Solo ingresos sin iniciar'
              : 'Solo ingresos en proceso'}{' '}
            <button
              type="button"
              onClick={onQuitarFiltro}
              className="ml-2 text-blue-600 hover:underline"
            >
              Quitar filtro
            </button>
          </p>
        )}
      </div>
      <div
        className={`${GRID} hidden border-t border-gray-100 bg-slate-50/70 px-5 py-3 text-[11px] font-semibold uppercase text-slate-500`}
      >
        <span>Proyecto / Autor</span>
        <span>Servicio</span>
        <span>Estado RRPP</span>
        <span>{!proyectos && tab === 'lanzamientos' ? 'Fecha del hito' : !proyectos && tab === 'todos' ? 'Fecha / Actualización' : 'Última actualización'}</span>
        <span className="text-center">Acción</span>
      </div>
      {loading ? (
        <div aria-label="Cargando bandeja RRPP" className="space-y-4 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-50" />
          ))}
        </div>
      ) : error ? (
        <ErrorRrpp onRetry={onRetry} />
      ) : filas.length === 0 ? (
        <p className="border-t border-gray-100 px-5 py-12 text-center text-sm text-slate-500">
          {vacio}
        </p>
      ) : (
        filas.map((t) => (
          <Fila
            key={t.id}
            tarea={t}
            iniciar={iniciar}
            iniciando={iniciandoId === t.proyecto.id}
            error={
              errorInicio?.id === t.proyecto.id
                ? errorInicio.mensaje
                : undefined
            }
            revisar={revisar}
          />
        ))
      )}
    </section>
  );
}
