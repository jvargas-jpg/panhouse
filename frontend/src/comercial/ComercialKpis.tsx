const ICONO_AUTORES = 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
const ICONO_PROYECTOS = 'M9 3h6l2 3h3a1 1 0 011 1v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7a1 1 0 011-1h3l2-3z';
const ICONO_PENDIENTE = 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z';
const ICONO_ACTIVOS = 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6';

export function IconoKpi({ path }: { path: string }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-dorado/10 text-dorado">
      <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={path} />
      </svg>
    </span>
  );
}

function KpiCard({
  icono,
  etiqueta,
  valor,
  microtexto,
  cargando,
  huboError,
}: {
  icono: string;
  etiqueta: string;
  valor: number | undefined;
  microtexto?: string;
  cargando: boolean;
  huboError: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
      <IconoKpi path={icono} />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{etiqueta}</p>
      {cargando ? (
        <div className="mt-1.5 h-8 w-14 animate-pulse rounded bg-gray-100" />
      ) : huboError ? (
        <p className="mt-0.5 text-2xl font-bold text-gray-300">—</p>
      ) : (
        <p className="mt-0.5 text-[28px] font-bold leading-none text-gray-900">{valor ?? 0}</p>
      )}
      {!cargando && (
        <p className="mt-1.5 h-4 text-xs text-gray-400">{huboError ? 'No se pudo cargar' : microtexto}</p>
      )}
    </div>
  );
}

// Los 4 KPI aprobados — cada uno sale de un dato real ya calculado por
// el backend, sin inventar ninguno nuevo (ver el comentario completo de
// cada fuente en ComercialDashboardPage.tsx, que arma estos props). El
// grid (grid-cols-2 lg:grid-cols-4) ya estira todas las cards a la
// misma altura por default de CSS Grid — no hace falta h-full ni
// min-height a mano.
export function ComercialKpis({
  autoresMes,
  crecimientoAutoresPorcentaje,
  autoresMesError,
  proyectosIniciadosMes,
  proyectosIniciadosMesError,
  datosContractualesPendientes,
  datosContractualesPendientesError,
  listosParaRrpp,
  listosParaRrppError,
  cargando,
}: {
  autoresMes: number | undefined;
  crecimientoAutoresPorcentaje: number | null | undefined;
  autoresMesError: boolean;
  proyectosIniciadosMes: number | undefined;
  proyectosIniciadosMesError: boolean;
  datosContractualesPendientes: number | undefined;
  datosContractualesPendientesError: boolean;
  listosParaRrpp: number | undefined;
  listosParaRrppError: boolean;
  cargando: boolean;
}) {
  const microtextoAutores =
    crecimientoAutoresPorcentaje === null || crecimientoAutoresPorcentaje === undefined
      ? undefined
      : crecimientoAutoresPorcentaje >= 0
        ? `+${crecimientoAutoresPorcentaje}% vs. mes anterior`
        : `${crecimientoAutoresPorcentaje}% vs. mes anterior`;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        icono={ICONO_AUTORES}
        etiqueta="Autores ingresados este mes"
        valor={autoresMes}
        microtexto={microtextoAutores}
        cargando={cargando}
        huboError={autoresMesError}
      />
      <KpiCard
        icono={ICONO_PROYECTOS}
        etiqueta="Proyectos iniciados este mes"
        valor={proyectosIniciadosMes}
        cargando={cargando}
        huboError={proyectosIniciadosMesError}
      />
      <KpiCard
        icono={ICONO_PENDIENTE}
        etiqueta="Datos contractuales pendientes"
        valor={datosContractualesPendientes}
        microtexto={datosContractualesPendientes ? 'Requieren tu atención' : 'Al día'}
        cargando={cargando}
        huboError={datosContractualesPendientesError}
      />
      <KpiCard
        icono={ICONO_ACTIVOS}
        etiqueta="Listos para RRPP"
        valor={listosParaRrpp}
        microtexto="Completos por Comercial"
        cargando={cargando}
        huboError={listosParaRrppError}
      />
    </div>
  );
}
