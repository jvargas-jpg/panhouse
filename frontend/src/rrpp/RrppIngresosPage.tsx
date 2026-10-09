import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { RRPP_FOOTER, RRPP_LOGO, RrppSidebarNav } from './RrppSidebarNav';
import { fechaActividad } from './RrppDashboardCards';
import { RrppIcon } from './RrppIcons';
import {
  ESTADOS_INGRESO,
  fetchIngresos,
  type DatosIngreso,
  type ResumenIngreso,
} from './rrppIngresosApi';
import { RrppIngresoDetalle } from './RrppIngresoDetalle';
import { filtrarIngresos } from './ingresosView';

export type BorradoresIngreso = Map<
  string,
  { datos: DatosIngreso; base: string }
>;
export function ErrorIngreso({
  error,
  reintentar,
}: {
  error: unknown;
  reintentar: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
    >
      <p>
        {error instanceof Error
          ? error.message
          : 'No se pudo cargar esta información.'}
      </p>
      <button onClick={reintentar} className="mt-3 font-semibold underline">
        Reintentar
      </button>
    </div>
  );
}
export function IngresoSkeleton({ detalle = false }: { detalle?: boolean }) {
  return (
    <div
      aria-label={detalle ? 'Cargando diagnóstico' : 'Cargando ingresos'}
      role="status"
      className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div className="h-5 w-2/3 rounded bg-slate-100" />
      <div className="mt-4 h-3 w-1/2 rounded bg-slate-100" />
      <div
        className={`mt-6 rounded bg-slate-100 ${detalle ? 'h-64' : 'h-24'}`}
      />
    </div>
  );
}
function CardIngreso({
  ingreso: i,
  seleccionado,
  seleccionar,
}: {
  ingreso: ResumenIngreso;
  seleccionado: boolean;
  seleccionar: () => void;
}) {
  const estado = ESTADOS_INGRESO[i.estado];
  return (
    <article
      className={`rounded-2xl border p-5 shadow-sm transition-colors ${seleccionado ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-400' : 'border-slate-200 bg-white hover:border-slate-300'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          aria-pressed={seleccionado}
          onClick={seleccionar}
          className="min-w-0 text-left text-base font-bold tracking-tight text-slate-900 hover:underline"
        >
          <span className="break-words">{i.nombre}</span>{' '}
          <span className="whitespace-nowrap">— #{i.codigo}</span>
        </button>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${estado.color}`}
        >
          {estado.nombre}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {i.servicio.codigo} — {i.servicio.nombre}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label={`Progreso de ${i.nombre}`}
          aria-valuenow={i.preparacion.progreso}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className={`h-full rounded-full ${estado.barra}`}
            style={{ width: `${i.preparacion.progreso}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-500">
          {i.preparacion.progreso}%
        </span>
      </div>
      <p
        className={`mt-3 text-xs font-semibold ${i.preparacion.faltantes.length ? 'text-slate-900' : 'text-green-700'}`}
      >
        {i.estado === 'enviado'
          ? 'Envío registrado'
          : i.preparacion.faltantes.length
            ? `⚠ ${i.preparacion.faltantes.length} pendientes`
            : '✓ Pendientes resueltos'}
      </p>
      {i.estado !== 'enviado' && i.preparacion.faltantes.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs leading-5 text-slate-500">
          {i.preparacion.faltantes.slice(0, 3).map((p) => (
            <li key={p.campo}>{p.etiqueta}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <p className="flex max-w-full items-start gap-2 text-[11px] leading-4 text-slate-500">
          <RrppIcon nombre="actividad" className="h-4 w-4 shrink-0" />
          <span>
            {i.actualizadoPor}
            {i.actualizadoAt && ` · ${fechaActividad(i.actualizadoAt)}`}
          </span>
        </p>
        <button
          onClick={seleccionar}
          className={`rounded-lg border px-4 py-2 text-xs font-semibold ${i.estado === 'nuevo' ? 'border-amber-400 bg-amber-400 text-slate-900 hover:bg-amber-500' : seleccionado ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}`}
        >
          {estado.accion}
        </button>
      </div>
    </article>
  );
}
const FILTROS = [
  ['todos', 'Todos'],
  ['nuevo', 'Nuevos'],
  ['diagnostico', 'En diagnóstico'],
  ['listo', 'Listos para Jefatura'],
  ['enviado', 'Enviados'],
] as const;
export function RrppIngresosPage() {
  const { data: usuario } = useMe();
  const [params, setParams] = useSearchParams();
  const id = params.get('proyecto');
  const estado = FILTROS.some(([v]) => v === params.get('estado'))
    ? params.get('estado')!
    : 'todos';
  const busqueda = params.get('q') ?? '';
  const servicio = params.get('servicio') ?? '';
  const orden = params.get('orden') ?? 'recientes';
  const borradores = useRef<BorradoresIngreso>(new Map());
  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (
        [...borradores.current.values()].some(
          (d) => JSON.stringify(d.datos) !== d.base,
        )
      ) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, []);
  const query = useQuery({
    queryKey: ['rrpp', 'ingresos'],
    queryFn: fetchIngresos,
    enabled: usuario?.rol === 'rrpp',
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  function cambiar(clave: string, valor: string) {
    const siguiente = new URLSearchParams(params);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    setParams(siguiente, {
      replace: ['q', 'servicio', 'orden'].includes(clave),
    });
  }
  const ingresos = query.data?.ingresos ?? [];
  const visibles = filtrarIngresos(ingresos, {
    estado,
    busqueda,
    servicio,
    orden,
  });
  const conteos = Object.fromEntries(
    FILTROS.map(([v]) => [
      v,
      v === 'todos'
        ? ingresos.length
        : ingresos.filter((i) => i.estado === v).length,
    ]),
  );
  if (usuario && usuario.rol !== 'rrpp')
    return (
      <p role="alert" className="p-6">
        No tienes acceso a Ingresos RRPP.
      </p>
    );
  return (
    <CrmSidebarLayout
      nav={<RrppSidebarNav vista="ingresos" />}
      logo={RRPP_LOGO}
      footer={RRPP_FOOTER}
      contentMaxWidth="max-w-[1800px]"
      contentClassName="px-4 py-6 sm:px-7 sm:py-7"
    >
      <div className={`mb-5 ${id ? 'hidden md:block' : ''}`}>
        <Link
          to="/"
          className="mb-4 inline-block text-xs text-slate-500 md:hidden"
        >
          ← Inicio RRPP
        </Link>
        <h1 className="flex items-center gap-3 text-[28px] font-bold tracking-tight text-slate-950">
          <span className="h-1 w-8 rounded-full bg-amber-400" />
          Ingresos
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Gestiona los proyectos recibidos de Comercial y completa el
          diagnóstico inicial antes de enviarlos a Jefatura.
        </p>
      </div>
      <div
        className={`mb-5 flex flex-wrap items-center justify-between gap-3 ${id ? 'hidden md:flex' : ''}`}
      >
        <div className="flex flex-wrap gap-2" aria-label="Estado del ingreso">
          {FILTROS.map(([v, nombre]) => (
            <button
              key={v}
              onClick={() => cambiar('estado', v)}
              aria-pressed={estado === v}
              className={`rounded-2xl border px-3 py-2.5 text-xs transition-colors ${estado === v ? 'border-amber-400 bg-amber-50 font-semibold text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {nombre}{' '}
              {query.data && (
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">
                  {conteos[v]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap gap-2 min-[1600px]:w-auto">
          <input
            aria-label="Buscar ingresos"
            placeholder="Buscar por autor, título o código..."
            value={busqueda}
            onChange={(e) => cambiar('q', e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-blue-400 min-[1600px]:w-72"
          />
          <select
            aria-label="Servicio"
            value={servicio}
            onChange={(e) => cambiar('servicio', e.target.value)}
            className="max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs"
          >
            <option value="">Servicio</option>
            {[
              ...new Map(
                ingresos.map((i) => [i.servicio.codigo, i.servicio]),
              ).values(),
            ].map((s) => (
              <option key={s.codigo} value={s.codigo}>
                {s.codigo} — {s.nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Ordenar ingresos"
            value={orden}
            onChange={(e) => cambiar('orden', e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs"
          >
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="autor">Autor A–Z</option>
          </select>
        </div>
      </div>
      <div className="grid items-start gap-4 min-[1200px]:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)]">
        <section
          aria-label="Lista de ingresos"
          className={`min-w-0 ${id ? 'hidden md:block' : ''}`}
        >
          <p className="mb-3 text-xs font-medium text-slate-500">
            {visibles.length} {visibles.length === 1 ? 'proyecto' : 'proyectos'}
          </p>
          {query.isPending ? (
            <div className="space-y-3">
              <IngresoSkeleton />
              <IngresoSkeleton />
              <IngresoSkeleton />
            </div>
          ) : query.isError ? (
            <ErrorIngreso
              error={query.error}
              reintentar={() => {
                void query.refetch();
              }}
            />
          ) : visibles.length ? (
            <div className="space-y-3">
              {visibles.map((i) => (
                <CardIngreso
                  key={i.id}
                  ingreso={i}
                  seleccionado={id === i.id}
                  seleccionar={() => cambiar('proyecto', i.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-7 text-sm text-slate-500">
              {busqueda || servicio
                ? 'No hay ingresos que coincidan con los filtros.'
                : estado === 'nuevo'
                  ? 'No hay nuevos proyectos pendientes de diagnóstico.'
                  : estado === 'listo'
                    ? 'No hay ingresos listos para Jefatura.'
                    : 'No hay ingresos disponibles.'}
            </div>
          )}
        </section>
        <section
          aria-label="Detalle del ingreso"
          className={`min-w-0 ${!id ? 'hidden md:block' : ''}`}
        >
          {id ? (
            <>
              <button
                onClick={() => cambiar('proyecto', '')}
                className="mb-3 text-sm font-medium text-slate-600 md:hidden"
              >
                ← Volver a ingresos
              </button>
              <RrppIngresoDetalle
                key={id}
                id={id}
                catalogos={query.data?.catalogos}
                borradores={borradores.current}
              />
            </>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <RrppIcon
                nombre="ingreso"
                className="mb-3 h-9 w-9 text-amber-500"
              />
              <p className="font-semibold text-slate-800">
                Selecciona un ingreso
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Consulta el contexto Comercial y completa el diagnóstico.
              </p>
            </div>
          )}
        </section>
      </div>
    </CrmSidebarLayout>
  );
}
