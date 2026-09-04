import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import type { PaisRanking } from '../types/api';
import { MapaCalorPaises } from './MapaCalorPaises';
import { fetchMetricasComercial } from './metricasApi';

// AppLayout.tsx envuelve toda la app en <TopBar/> + <main className="mx-auto
// max-w-4xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">. Mismo breakout y
// mismo shell con sidebar oscuro que AutoresPage.tsx/PanelJefaturaPage.tsx
// (antes esta pantalla no lo tenía — navegaba "hacia afuera" del CRM sin
// dejar la barra lateral, que es justo el bug reportado). -my-6 cancela
// la POSICIÓN del padding vertical de ese <main> (empujando hacia arriba).
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';

// Ver AutoresPage.tsx para la explicación completa: h-full solo deja
// una franja de 48px sin cubrir en el fondo (resuelve contra la caja de
// contenido de <main>, ya sin su propio padding py-6). +3rem = ese
// padding total.
const ALTO_LLENO_MAIN = 'h-[calc(100%+3rem)]';

const NAV_ACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 bg-dorado/10 text-dorado rounded-xl font-semibold text-sm border border-dorado/20 transition-all text-left';
const NAV_INACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl font-medium text-sm transition-all text-left';

function TarjetaKpi({ etiqueta, valor, pie }: { etiqueta: string; valor: string; pie?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{etiqueta}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{valor}</p>
      {pie && <div className="mt-2">{pie}</div>}
    </div>
  );
}

// null → "Nuevo" (no hay mes anterior contra qué comparar, mostrar un
// porcentaje inventado sería peor que no mostrar nada). Positivo/cero
// en verde, negativo en rojo — mismo criterio de color que
// BadgeEstatusPago/RiesgoBadge en el resto de la app (verde = bien,
// rojo = atención).
function BadgeCrecimiento({ porcentaje }: { porcentaje: number | null }) {
  if (porcentaje === null) {
    return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">Nuevo</span>;
  }
  const esPositivo = porcentaje >= 0;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${esPositivo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
    >
      {esPositivo ? '+' : ''}
      {porcentaje}% vs. mes anterior
    </span>
  );
}

// server/helpers/metricas.ts ahora agrupa topPaises con lower(pais) en
// SQL (para que 'Venezuela' y 'venezuela' sumen un solo bloque), así que
// pais siempre llega en minúsculas — esto solo lo capitaliza para
// mostrarlo, no cambia el valor que compara MapaCalorPaises.tsx
// (nombreParaMapa ya normaliza por su cuenta).
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Lista lateral del ranking completo (server/helpers/metricas.ts ya no
// lo recorta a 5) — a diferencia del mapa, acá entra CUALQUIER valor de
// autores.pais tal cual está en la BD, incluidos los que no matchean
// ningún país real (texto libre viejo, ej. "sdd"): el objetivo es
// transparencia sobre los datos crudos, no solo lo que el mapa logra
// pintar.
function ListaPaises({ paises }: { paises: PaisRanking[] }) {
  if (paises.length === 0) {
    return <p className="text-sm text-gray-400">Todavía no hay clientes con país registrado.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {paises.map((pais, indice) => (
        <li key={pais.pais} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50">
          <span className="truncate text-gray-700">
            <span className="mr-1.5 text-xs text-gray-400">{indice + 1}.</span>
            {capitalizar(pais.pais)}
          </span>
          <span className="flex-shrink-0 font-semibold text-gray-900">{pais.cantidad}</span>
        </li>
      ))}
    </ul>
  );
}

// Mismo shell con sidebar que AutoresPage.tsx/MisProyectosPage.tsx/
// AuditoriaPagosPage.tsx/PanelJefaturaPage.tsx: "Proyectos"/"Clientes"
// navegan a "/" (el dispatch de HomePage.tsx manda a comercial/dirección
// de vuelta a AutoresPage, que decide sola en cuál de sus dos pestañas
// cae por defecto) — no hay forma de enlazar directo a una pestaña
// puntual de otra página, mismo límite que ya tenía "Registrar Pago".
export function MetricasPage() {
  const { data: usuario } = useMe();
  const esComercial = usuario?.rol === 'comercial';
  const navigate = useNavigate();

  const metricasQuery = useQuery({ queryKey: ['metricas', 'comercial'], queryFn: fetchMetricasComercial });

  return (
    <div className={`${FULL_BLEED} ${ALTO_LLENO_MAIN} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden h-full w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="flex h-20 items-center border-b border-gray-800 px-6">
          <h1 className="text-xl font-light uppercase tracking-widest text-white">
            Pan<span className="font-bold text-dorado">House</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-8">
          {esComercial && (
            <button onClick={() => navigate('/')} className={NAV_INACTIVO}>
              Proyectos
            </button>
          )}
          <button onClick={() => navigate('/')} className={NAV_INACTIVO}>
            Clientes
          </button>

          <div className="my-4 border-t border-gray-800" />

          <button onClick={() => navigate('/comercial/pagos')} className={NAV_INACTIVO}>
            Registrar Pago
          </button>
          <button className={NAV_ACTIVO}>
            <span className="h-1.5 w-1.5 rounded-full bg-dorado" />
            Métricas
          </button>
        </nav>
      </aside>

      {/* AppLayout.tsx ya envuelve el Outlet en un <main> — dos <main> anidados
          no son válidos (landmark duplicado), así que este contenedor de
          scroll independiente es un <div> con las mismas clases. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <h2 className="mb-8 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <span className="h-2 w-2 rounded-full bg-dorado" /> Métricas Comercial
          </h2>

          {metricasQuery.isLoading && <p className="text-sm text-gray-500">Cargando métricas…</p>}
          {metricasQuery.isError && (
            <p role="alert" className="text-sm text-red-600">
              No se pudieron cargar las métricas
              {metricasQuery.error instanceof Error ? `: ${metricasQuery.error.message}` : ''}.
            </p>
          )}

          {metricasQuery.data && (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                <TarjetaKpi
                  etiqueta="Nuevos Clientes (Mes Actual)"
                  valor={String(metricasQuery.data.kpis.clientesMesActual)}
                  pie={<BadgeCrecimiento porcentaje={metricasQuery.data.kpis.crecimientoClientesPorcentaje} />}
                />
                <TarjetaKpi
                  etiqueta="País Principal"
                  valor={metricasQuery.data.topPaises[0] ? capitalizar(metricasQuery.data.topPaises[0].pais) : 'Sin datos'}
                  pie={
                    metricasQuery.data.topPaises[0] && (
                      <span className="text-xs text-gray-500">{metricasQuery.data.topPaises[0].cantidad} clientes</span>
                    )
                  }
                />
                <TarjetaKpi etiqueta="Proyectos Iniciados (Mes)" valor={String(metricasQuery.data.kpis.proyectosMesActual)} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 mb-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-sm font-semibold text-gray-900">Clientes registrados por mes</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metricasQuery.data.clientesPorMes}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip cursor={{ stroke: '#E5E7EB' }} />
                        <Line
                          type="monotone"
                          dataKey="cantidad"
                          name="Clientes"
                          stroke="#EAB308"
                          strokeWidth={3}
                          dot={{ fill: '#EAB308', r: 5 }}
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-sm font-semibold text-gray-900">Proyectos iniciados por mes</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metricasQuery.data.proyectosPorMes}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip cursor={{ stroke: '#E5E7EB' }} />
                        <Line
                          type="monotone"
                          dataKey="cantidad"
                          name="Proyectos"
                          stroke="#1E3A8A"
                          strokeWidth={3}
                          dot={{ fill: '#1E3A8A', r: 5 }}
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Fila propia a ancho completo (no en el grid de 2 columnas de
                  arriba): con la lista lateral a ancho fijo (w-56), un mapa a
                  flex-1 dentro de una tarjeta de la mitad del ancho apenas
                  tenía espacio para crecer — medido con Playwright, quedaba
                  MÁS chico que antes de este cambio (266px vs. ~367px). A
                  ancho completo, flex-1 sí tiene margen real para agrandarse. */}
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">Clientes por país</h3>
                <div className="flex flex-col gap-4 md:flex-row">
                  <div className="flex w-full flex-1 items-center justify-center">
                    <MapaCalorPaises paises={metricasQuery.data.topPaises} />
                  </div>
                  <div className="max-h-[300px] w-56 flex-none overflow-y-auto pr-2">
                    <ListaPaises paises={metricasQuery.data.topPaises} />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-gray-900">Proyectos por Servicio</h3>
                {metricasQuery.data.proyectosPorServicio.length === 0 ? (
                  <p className="text-sm text-gray-400">Todavía no hay proyectos registrados.</p>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricasQuery.data.proyectosPorServicio} layout="vertical" margin={{ left: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                        <YAxis
                          dataKey="servicio"
                          type="category"
                          width={140}
                          tick={{ fontSize: 12, fill: '#6B7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip cursor={{ fill: '#F3F4F6' }} />
                        <Bar dataKey="cantidad" name="Proyectos" fill="#EAB308" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
