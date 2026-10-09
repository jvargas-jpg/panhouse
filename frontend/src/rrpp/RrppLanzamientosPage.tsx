import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useMe } from "../auth/useAuth";
import { CrmSidebarLayout } from "../layout/CrmSidebarLayout";
import { RRPP_FOOTER, RRPP_LOGO, RrppSidebarNav } from "./RrppSidebarNav";
import { ErrorIngreso } from "./RrppIngresosPage";
import {
  BadgeLaunch,
  botonLaunch,
  botonLaunchPrincipal,
  EditorLaunch,
  fechaLaunch,
  PaginacionLaunch,
  SkeletonLaunch,
  TabsLaunch,
  TimelineLaunch,
  VacioLaunch,
  type EditorLaunchConfig,
} from "./RrppLanzamientoComponents";
import {
  eventoEditor,
  EventoLaunchCard,
  publicacionEditor,
  PublicacionLaunchCard,
  RrppLanzamientoDetalle,
} from "./RrppLanzamientoDetalle";
import {
  fetchAgenda,
  fetchCatalogosLanzamiento,
  fetchHistorialLanzamiento,
  fetchPlanes,
  fetchPublicaciones,
  type CatalogosLanzamiento,
} from "./rrppLanzamientosApi";
import { RrppIcon } from "./RrppIcons";
import "./rrppLanzamientos.css";

const tabs = [
  { id: "planificacion", nombre: "Planificación" },
  { id: "agenda", nombre: "Agenda" },
  { id: "publicaciones", nombre: "Publicaciones" },
  { id: "historial", nombre: "Historial" },
];
function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
export function RrppLanzamientosPage() {
  const { data: usuario } = useMe();
  const [params, setParams] = useSearchParams();
  const [editor, setEditor] = useState<EditorLaunchConfig | null>(null);
  const catalogos = useQuery({
    queryKey: ["rrpp", "launch", "catalogos"],
    queryFn: fetchCatalogosLanzamiento,
    enabled: usuario?.rol === "rrpp",
    staleTime: 60000,
  });
  const tab = tabs.some((t) => t.id === params.get("tab"))
    ? params.get("tab")!
    : "planificacion";
  function cambiar(key: string, value: string) {
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      if (value) n.set(key, value);
      else n.delete(key);
      if (key !== "pagina") n.delete("pagina");
      return n;
    });
  }
  function cambiarVista(v: string) {
    setParams((prev) => {
      const n = new URLSearchParams();
      if (v !== "planificacion") n.set("tab", v);
      if (prev.get("proyecto")) n.set("proyecto", prev.get("proyecto")!);
      return n;
    });
  }
  if (usuario && usuario.rol !== "rrpp")
    return (
      <p role="alert" className="p-6">
        No tienes acceso a Lanzamientos y eventos RRPP.
      </p>
    );
  return (
    <CrmSidebarLayout
      nav={<RrppSidebarNav vista="lanzamientos" />}
      logo={RRPP_LOGO}
      footer={RRPP_FOOTER}
      contentMaxWidth="max-w-[1800px]"
      contentClassName="px-4 py-7 sm:px-6 min-[1200px]:px-7"
      overlays={
        editor && (
          <EditorLaunch
            key={`${editor.endpoint}-${editor.titulo}`}
            config={editor}
            cerrar={() => setEditor(null)}
          />
        )
      }
    >
      <div className="rrpp-launches min-w-0">
        <header className="mb-4">
          <div className="flex items-center gap-3">
            <span className="h-1 w-8 shrink-0 rounded bg-dorado" />
            <h1 className="text-[27px] font-bold tracking-tight text-slate-950">
              Lanzamientos y eventos
            </h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500 sm:ml-11">
            Planifica, coordina y da seguimiento a las acciones de lanzamiento y
            promoción de los proyectos editoriales.
          </p>
          <nav
            aria-label="Navegación RRPP"
            className="mt-4 flex flex-wrap gap-3 text-xs text-slate-600 md:hidden"
          >
            <Link to="/">Inicio</Link>
            <Link to="/rrpp/ingresos">Ingresos</Link>
            <Link to="/rrpp/proyectos">Proyectos</Link>
            <Link to="/rrpp/lanzamientos" aria-current="page">
              Lanzamientos y eventos
            </Link>
            <Link to="/rrpp/metricas">Indicadores</Link>
          </nav>
        </header>
        <div className="mb-4">
          <TabsLaunch
            tabs={tabs}
            valor={tab}
            cambiar={cambiarVista}
            prefix="launch"
          />
        </div>
        <section
          id="launch-panel"
          role="tabpanel"
          aria-labelledby={`launch-tab-${tab}`}
        >
          {catalogos.isPending ? (
            <SkeletonLaunch />
          ) : catalogos.isError ? (
            <ErrorIngreso
              error={catalogos.error}
              reintentar={() => void catalogos.refetch()}
            />
          ) : (
            <>
              {tab === "planificacion" && (
                <PlanificacionLaunch
                  catalogos={catalogos.data}
                  params={params}
                  setParams={setParams}
                  editar={setEditor}
                />
              )}
              {tab === "agenda" && (
                <AgendaLaunch
                  catalogos={catalogos.data}
                  params={params}
                  cambiar={cambiar}
                  editar={setEditor}
                />
              )}
              {tab === "publicaciones" && (
                <PublicacionesLaunch
                  catalogos={catalogos.data}
                  params={params}
                  cambiar={cambiar}
                  editar={setEditor}
                />
              )}
              {tab === "historial" && (
                <HistorialLaunch params={params} cambiar={cambiar} />
              )}
            </>
          )}
        </section>
      </div>
    </CrmSidebarLayout>
  );
}
function PlanificacionLaunch({
  catalogos,
  params,
  setParams,
  editar,
}: {
  catalogos: CatalogosLanzamiento;
  params: URLSearchParams;
  setParams: ReturnType<typeof useSearchParams>[1];
  editar: (c: EditorLaunchConfig) => void;
}) {
  const q = params.get("q") ?? "";
  const [busqueda, setBusqueda] = useState(q);
  const id = params.get("proyecto");
  useEffect(() => setBusqueda(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (busqueda.trim() === q) return;
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.delete("proyecto");
          n.delete("pagina");
          n.delete("seccion");
          if (busqueda.trim()) n.set("q", busqueda.trim());
          else n.delete("q");
          return n;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, q, setParams]);
  const filtros = new URLSearchParams();
  for (const k of ["q", "fase", "feria", "responsable", "pagina"])
    if (params.get(k)) filtros.set(k, params.get(k)!);
  const query = useQuery({
    queryKey: ["rrpp", "launch", "planes", filtros.toString()],
    queryFn: () => fetchPlanes(filtros.toString()),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  useEffect(() => {
    if (
      !id &&
      !query.isPlaceholderData &&
      query.data?.proyectos[0] &&
      window.matchMedia("(min-width:1200px)").matches
    )
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev);
          n.set("proyecto", query.data.proyectos[0].id);
          return n;
        },
        { replace: true },
      );
  }, [id, query.data, query.isPlaceholderData, setParams]);
  function cambiar(key: string, value: string) {
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      if (value) n.set(key, value);
      else n.delete(key);
      n.delete("proyecto");
      n.delete("seccion");
      if (key !== "pagina") n.delete("pagina");
      return n;
    });
  }
  const seleccionado = query.data?.proyectos.find((p) => p.id === id);
  return (
    <>
      <div
        className={`${id ? "launch-mobile-hidden" : ""} mb-4 flex flex-wrap items-center gap-2`}
        aria-label="Fases de planificación"
      >
        <button
          className={params.get("fase") ? botonLaunch : botonLaunchPrincipal}
          onClick={() => cambiar("fase", "")}
        >
          Todos
        </button>
        {catalogos.fases.map((f) => (
          <button
            key={f}
            aria-pressed={params.get("fase") === f}
            className={
              params.get("fase") === f ? botonLaunchPrincipal : botonLaunch
            }
            onClick={() => cambiar("fase", f)}
          >
            {f === "En asesoramiento"
              ? "En asesoría"
              : f === "En espera de lanzamiento"
                ? "Próximos"
                : f === "Culminado"
                  ? "Culminados"
                  : f}
          </button>
        ))}
      </div>
      <div
        className={`${id ? "launch-mobile-hidden" : ""} mb-4 grid gap-3 sm:grid-cols-[minmax(180px,2fr)_1fr_1fr]`}
      >
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
          <RrppIcon nombre="buscar" className="h-4 w-4 text-slate-500" />
          <span className="sr-only">Buscar en planificación</span>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por proyecto, autor, título o código…"
            className="w-full min-w-0 bg-transparent py-3 text-xs outline-none"
          />
        </label>
        <label className="rounded-lg border border-slate-200 bg-white p-2">
          <span className="block text-[11px] text-slate-500">Feria</span>
          <select
            className="mt-1 w-full bg-white text-xs"
            value={params.get("feria") ?? ""}
            onChange={(e) => cambiar("feria", e.target.value)}
          >
            <option value="">Todas</option>
            {catalogos.ferias.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="rounded-lg border border-slate-200 bg-white p-2">
          <span className="block text-[11px] text-slate-500">
            Responsable RRPP
          </span>
          <select
            className="mt-1 w-full bg-white text-xs"
            value={params.get("responsable") ?? ""}
            onChange={(e) => cambiar("responsable", e.target.value)}
          >
            <option value="">Todos</option>
            {catalogos.responsables.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="launch-workspace">
        <section
          aria-label="Proyectos para planificación"
          className={`${id ? "launch-mobile-hidden" : ""} launch-scroll min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-sm`}
        >
          <div className="border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-900">
            {query.data
              ? `${query.data.total} ${query.data.total === 1 ? "proyecto" : "proyectos"}`
              : "Planificación"}
            {query.isFetching && !query.isPending && (
              <span className="ml-2 text-[10px] text-slate-400">
                Actualizando…
              </span>
            )}
          </div>
          {query.isPending ? (
            <SkeletonLaunch />
          ) : query.isError ? (
            <div className="p-4">
              <ErrorIngreso
                error={query.error}
                reintentar={() => void query.refetch()}
              />
            </div>
          ) : !query.data.proyectos.length ? (
            <div className="p-4">
              <VacioLaunch>
                No hay proyectos pendientes de planificación.
              </VacioLaunch>
            </div>
          ) : (
            <div className="p-1.5">
              {query.data.proyectos.map((p) => {
                const vencida =
                  p.proximaFecha &&
                  p.proximaFecha < new Date().toISOString().slice(0, 10) &&
                  p.fase !== "Culminado";
                return (
                  <button
                    type="button"
                    aria-pressed={p.id === id}
                    key={p.id}
                    onClick={() =>
                      setParams((prev) => {
                        const n = new URLSearchParams(prev);
                        n.set("proyecto", p.id);
                        n.delete("seccion");
                        return n;
                      })
                    }
                    className={`flex w-full items-start gap-3 rounded-lg border px-3 py-4 text-left transition ${p.id === id ? "border-blue-400 bg-blue-50" : "border-transparent border-b-slate-100 hover:bg-slate-50"}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-semibold text-amber-800">
                      {iniciales(p.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-slate-950">
                        {p.nombre}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        #{p.codigo} · {p.servicio.codigo}
                      </span>
                      <span className="mt-2 block">
                        <BadgeLaunch>
                          {p.fase || "Sin fase definida"}
                        </BadgeLaunch>
                      </span>
                      <span className="mt-2 block text-[11px] text-slate-500">
                        Próxima acción:{" "}
                        <span className="font-medium text-slate-700">
                          {p.proximaAccion}
                        </span>
                      </span>
                      <span
                        className={`mt-1 block text-[11px] ${vencida ? "font-medium text-rose-600" : "text-slate-500"}`}
                      >
                        {p.proximaFecha
                          ? `${fechaLaunch(p.proximaFecha)}${vencida ? " · Vencida" : ""}`
                          : "Fecha por definir"}
                      </span>
                    </span>
                    <RrppIcon
                      nombre="flecha"
                      className="mt-3 h-4 w-4 shrink-0 text-slate-400"
                    />
                  </button>
                );
              })}
            </div>
          )}
          {query.data && (
            <PaginacionLaunch
              pagina={query.data.pagina}
              paginas={query.data.paginas}
              cambiar={(n) => cambiar("pagina", String(n))}
            />
          )}
        </section>
        {id ? (
          <RrppLanzamientoDetalle
            key={id}
            id={id}
            seccion={params.get("seccion") ?? "resumen"}
            cambiarSeccion={(s) =>
              setParams((prev) => {
                const n = new URLSearchParams(prev);
                if (s === "resumen") n.delete("seccion");
                else n.set("seccion", s);
                return n;
              })
            }
            volver={() => cambiar("proyecto", "")}
            catalogos={catalogos}
            editar={editar}
          />
        ) : (
          <div className="hidden min-[1200px]:block">
            <VacioLaunch>
              {seleccionado
                ? "Cargando planificación…"
                : "Selecciona un proyecto para consultar su plan de lanzamiento."}
            </VacioLaunch>
          </div>
        )}
      </div>
    </>
  );
}
function AgendaLaunch({
  catalogos,
  params,
  cambiar,
  editar,
}: {
  catalogos: CatalogosLanzamiento;
  params: URLSearchParams;
  cambiar: (k: string, v: string) => void;
  editar: (c: EditorLaunchConfig) => void;
}) {
  const hoy = new Date();
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get("mes") ?? "")
    ? params.get("mes")!
    : `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = mes.split("-").map(Number);
  const primer = new Date(year, month - 1, 1, 12);
  const ultimo = new Date(year, month, 0, 12);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fechaSeleccionada = params.get("dia")?.startsWith(mes)
    ? params.get("dia")!
    : iso(primer);
  const proyecto = params.get("proyecto");
  const f = new URLSearchParams({
    desde: iso(primer),
    hasta: iso(ultimo),
    ...(params.get("tipo") ? { tipo: params.get("tipo")! } : {}),
    ...(proyecto ? { proyecto } : {}),
  });
  const query = useQuery({
    queryKey: ["rrpp", "launch", "agenda", f.toString()],
    queryFn: () => fetchAgenda(f.toString()),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  const offset = (primer.getDay() + 6) % 7;
  const dias = Array.from(
    { length: Math.ceil((offset + ultimo.getDate()) / 7) * 7 },
    (_, i) => i - offset + 1,
  );
  function moverMes(delta: number) {
    const d = new Date(year, month - 1 + delta, 1, 12);
    cambiar("mes", iso(d).slice(0, 7));
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Agenda</h2>
          <p className="mt-1 text-xs text-slate-500">
            Eventos de lanzamiento, promoción y participación editorial.
          </p>
        </div>
        <button
          className={botonLaunchPrincipal}
          onClick={() => editar(eventoEditor(catalogos, proyecto || undefined))}
        >
          + Registrar evento
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            className={botonLaunch}
            onClick={() => moverMes(-1)}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <h3 className="min-w-32 text-center text-sm font-semibold capitalize">
            {new Intl.DateTimeFormat("es", {
              month: "long",
              year: "numeric",
            }).format(primer)}
          </h3>
          <button
            className={botonLaunch}
            onClick={() => moverMes(1)}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          Tipo
          <select
            className="launch-input !w-auto"
            value={params.get("tipo") ?? ""}
            onChange={(e) => cambiar("tipo", e.target.value)}
          >
            <option value="">Todos</option>
            {catalogos.tiposEvento.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        {proyecto && (
          <button
            className={botonLaunch}
            onClick={() => cambiar("proyecto", "")}
          >
            Todos los proyectos ×
          </button>
        )}
      </div>
      {query.isPending ? (
        <SkeletonLaunch />
      ) : query.isError ? (
        <ErrorIngreso
          error={query.error}
          reintentar={() => void query.refetch()}
        />
      ) : (
        <>
          {query.data.limiteAlcanzado && (
            <p className="mb-3 text-xs text-amber-700">
              Hay más de 500 eventos. Filtra por tipo o proyecto para consultar
              el período.
            </p>
          )}
          <div className="hidden gap-4 md:grid min-[1350px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                  <div
                    className="py-3 text-center text-xs text-slate-500"
                    key={d}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {dias.map((dia, i) => {
                  const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
                  const eventos = query.data.eventos.filter(
                    (e) => e.fecha === fecha,
                  );
                  return dia < 1 || dia > ultimo.getDate() ? (
                    <div
                      key={i}
                      className="min-h-[112px] border-b border-r border-slate-100 bg-slate-50/50"
                    />
                  ) : (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${fechaLaunch(fecha)}, ${eventos.length} ${eventos.length === 1 ? "evento" : "eventos"}`}
                      aria-pressed={fecha === fechaSeleccionada}
                      onClick={() => cambiar("dia", fecha)}
                      className={`min-h-[112px] min-w-0 border-b border-r border-slate-100 p-2 text-left align-top ${fecha === fechaSeleccionada ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : "hover:bg-slate-50"}`}
                    >
                      <span
                        className={`mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${fecha === iso(hoy) ? "bg-dorado font-bold text-slate-950" : "text-slate-600"}`}
                      >
                        {dia}
                      </span>
                      {eventos.slice(0, 2).map((e) => (
                        <span
                          key={e.id}
                          className="mb-1 block truncate rounded bg-amber-50 px-1.5 py-1 text-[10px] text-amber-900"
                        >
                          {e.hora ? `${e.hora.slice(0, 5)} · ` : ""}
                          {e.tipo}
                        </span>
                      ))}
                      {eventos.length > 2 && (
                        <span className="text-[10px] text-blue-600">
                          +{eventos.length - 2} eventos
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                {fechaLaunch(fechaSeleccionada)}
              </h3>
              {query.data.eventos.filter((e) => e.fecha === fechaSeleccionada)
                .length ? (
                query.data.eventos
                  .filter((e) => e.fecha === fechaSeleccionada)
                  .map((e) => (
                    <EventoLaunchCard
                      key={e.id}
                      evento={e}
                      editar={() =>
                        editar(eventoEditor(catalogos, undefined, e))
                      }
                    />
                  ))
              ) : (
                <VacioLaunch>
                  No hay eventos programados para este día.
                </VacioLaunch>
              )}
            </div>
          </div>
          <div className="space-y-3 md:hidden">
            {query.data.eventos.length ? (
              query.data.eventos.map((e) => (
                <EventoLaunchCard
                  key={e.id}
                  evento={e}
                  editar={() => editar(eventoEditor(catalogos, undefined, e))}
                />
              ))
            ) : (
              <VacioLaunch>
                No hay eventos programados para este período.
              </VacioLaunch>
            )}
          </div>
          {!query.data.eventos.length && (
            <div className="mt-4 hidden md:block">
              <VacioLaunch>
                No hay eventos programados para este período.
              </VacioLaunch>
            </div>
          )}
        </>
      )}
    </div>
  );
}
function PublicacionesLaunch({
  catalogos,
  params,
  cambiar,
  editar,
}: {
  catalogos: CatalogosLanzamiento;
  params: URLSearchParams;
  cambiar: (k: string, v: string) => void;
  editar: (c: EditorLaunchConfig) => void;
}) {
  const proyecto = params.get("proyecto");
  const f = new URLSearchParams();
  for (const k of ["estado", "proyecto", "q", "pagina"])
    if (params.get(k)) f.set(k, params.get(k)!);
  const query = useQuery({
    queryKey: ["rrpp", "launch", "publicaciones", f.toString()],
    queryFn: () => fetchPublicaciones(f.toString()),
    placeholderData: keepPreviousData,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  return (
    <div>
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Publicaciones en redes
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Seguimiento de piezas de Futuro Autor y Novedades.
          </p>
        </div>
        <button
          className={botonLaunchPrincipal}
          onClick={() =>
            editar(publicacionEditor(catalogos, proyecto || undefined))
          }
        >
          + Registrar publicación
        </button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          className={params.get("estado") ? botonLaunch : botonLaunchPrincipal}
          onClick={() => cambiar("estado", "")}
        >
          Todas
        </button>
        {catalogos.estadosPublicacion.map((e) => (
          <button
            key={e}
            aria-pressed={params.get("estado") === e}
            className={
              params.get("estado") === e ? botonLaunchPrincipal : botonLaunch
            }
            onClick={() => cambiar("estado", e)}
          >
            {e}
          </button>
        ))}
        {proyecto && (
          <button
            className={botonLaunch}
            onClick={() => cambiar("proyecto", "")}
          >
            Todos los proyectos ×
          </button>
        )}
      </div>
      <label className="mb-4 block max-w-lg">
        <span className="sr-only">Buscar publicaciones por proyecto</span>
        <input
          type="search"
          value={params.get("q") ?? ""}
          onChange={(e) => cambiar("q", e.target.value)}
          className="launch-input"
          placeholder="Buscar por autor, título o código…"
        />
      </label>
      {query.isPending ? (
        <SkeletonLaunch />
      ) : query.isError ? (
        <ErrorIngreso
          error={query.error}
          reintentar={() => void query.refetch()}
        />
      ) : !query.data.publicaciones.length ? (
        <VacioLaunch>No hay publicaciones en esta vista.</VacioLaunch>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-medium uppercase text-slate-500">
                <tr>
                  {[
                    "Proyecto / Autor",
                    "Tipo de pieza",
                    "Lanzamiento",
                    "Estado",
                    "Responsable",
                    "Acción",
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.publicaciones.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-4">
                      <Link
                        className="font-semibold text-slate-950 hover:text-blue-600"
                        to={`/rrpp/lanzamientos?proyecto=${p.proyectoId}&seccion=publicaciones`}
                      >
                        {p.nombre}
                      </Link>
                      <p className="mt-1 text-[11px] text-slate-500">
                        #{p.codigo}
                      </p>
                    </td>
                    <td className="px-4 py-4">{p.tipo}</td>
                    <td className="px-4 py-4 text-slate-500">
                      {fechaLaunch(p.fechaLanzamiento)}
                    </td>
                    <td className="px-4 py-4">
                      <BadgeLaunch>{p.estado}</BadgeLaunch>
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {p.responsable || "Sin asignar"}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        className={botonLaunch}
                        onClick={() =>
                          editar(publicacionEditor(catalogos, undefined, p))
                        }
                      >
                        Gestionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">
            {query.data.publicaciones.map((p) => (
              <PublicacionLaunchCard
                key={p.id}
                pieza={p}
                editar={() =>
                  editar(publicacionEditor(catalogos, undefined, p))
                }
              />
            ))}
          </div>
        </>
      )}
      {query.data && (
        <PaginacionLaunch
          pagina={query.data.pagina}
          paginas={query.data.paginas}
          cambiar={(n) => cambiar("pagina", String(n))}
        />
      )}
    </div>
  );
}
function HistorialLaunch({
  params,
  cambiar,
}: {
  params: URLSearchParams;
  cambiar: (k: string, v: string) => void;
}) {
  const f = new URLSearchParams();
  for (const k of ["proyecto", "pagina"])
    if (params.get(k)) f.set(k, params.get(k)!);
  const query = useQuery({
    queryKey: ["rrpp", "launch", "historial", f.toString()],
    queryFn: () => fetchHistorialLanzamiento(f.toString()),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Historial RRPP
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Reuniones, planificación y acciones de lanzamiento registradas.
          </p>
        </div>
        {params.get("proyecto") && (
          <button
            className={botonLaunch}
            onClick={() => cambiar("proyecto", "")}
          >
            Todos los proyectos ×
          </button>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        {query.isPending ? (
          <SkeletonLaunch />
        ) : query.isError ? (
          <ErrorIngreso
            error={query.error}
            reintentar={() => void query.refetch()}
          />
        ) : (
          <>
            <TimelineLaunch historial={query.data} />
            <PaginacionLaunch
              pagina={query.data.pagina}
              paginas={query.data.paginas}
              cambiar={(n) => cambiar("pagina", String(n))}
            />
          </>
        )}
      </div>
    </div>
  );
}
