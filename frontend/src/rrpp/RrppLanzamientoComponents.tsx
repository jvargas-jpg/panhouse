import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Modal } from "../autores/Modal";
import { apiFetch } from "../lib/api";
import { ErrorIngreso } from "./RrppIngresosPage";
import { RrppIcon } from "./RrppIcons";
import {
  fetchPlanes,
  LANZAMIENTOS_API,
  type CampoLanzamiento,
  type HistorialLanzamiento,
} from "./rrppLanzamientosApi";

export const botonLaunch =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-50";
export const botonLaunchPrincipal = `${botonLaunch} !border-amber-400 !bg-dorado !text-slate-950 hover:!bg-amber-400`;
export function fechaLaunch(fecha: string | null | undefined, hora = false) {
  if (!fecha) return "—";
  const d = new Date(fecha.length === 10 ? `${fecha}T12:00:00` : fecha);
  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("es", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(hora ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(d);
}
export function BadgeLaunch({ children }: { children: ReactNode }) {
  const valor = String(children).toLowerCase();
  const clase =
    /culminado|completada|publicado|realizada|enviada|confirmada/.test(valor)
      ? "bg-emerald-50 text-emerald-700"
      : /revisión|asesor|curso|programada/.test(valor)
        ? "bg-blue-50 text-blue-700"
        : /suspend|pausa|bloqueada|vencida/.test(valor)
          ? "bg-rose-50 text-rose-700"
          : "bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium ${clase}`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children || "Sin definir"}
    </span>
  );
}
export function CardLaunch({
  titulo,
  icono = "actividad",
  accion,
  children,
}: {
  titulo: string;
  icono?: Parameters<typeof RrppIcon>[0]["nombre"];
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200/80 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-950">
          <RrppIcon nombre={icono} className="h-[18px] w-[18px] shrink-0" />
          {titulo}
        </h3>
        {accion}
      </div>
      {children}
    </section>
  );
}
export function DatosLaunch({ filas }: { filas: [string, ReactNode][] }) {
  return (
    <dl className="space-y-2">
      {filas.map(([label, valor]) => (
        <div
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3 text-[12px]"
          key={label}
        >
          <dt className="text-slate-500">{label}</dt>
          <dd className="break-words text-slate-900">{valor || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function SkeletonLaunch() {
  return (
    <div
      role="status"
      aria-label="Cargando lanzamientos"
      className="animate-pulse space-y-4 p-5"
    >
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="h-20 rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}
export function VacioLaunch({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 px-5 py-12 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}
export function TabsLaunch({
  tabs,
  valor,
  cambiar,
  prefix,
}: {
  tabs: { id: string; nombre: string }[];
  valor: string;
  cambiar: (v: string) => void;
  prefix: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={
        prefix === "launch"
          ? "Vistas de lanzamientos"
          : "Detalle del lanzamiento"
      }
      className="flex overflow-x-auto border-b border-slate-200"
      onKeyDown={(e) => {
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        const i = tabs.findIndex((t) => t.id === valor);
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                tabs.length;
        cambiar(tabs[next].id);
        e.currentTarget
          .querySelectorAll<HTMLButtonElement>('[role="tab"]')
          [next]?.focus();
      }}
    >
      {tabs.map((t) => (
        <button
          type="button"
          key={t.id}
          role="tab"
          id={`${prefix}-tab-${t.id}`}
          aria-controls={`${prefix}-panel`}
          aria-selected={valor === t.id}
          tabIndex={valor === t.id ? 0 : -1}
          onClick={() => cambiar(t.id)}
          className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-xs ${valor === t.id ? "border-dorado font-semibold text-slate-950" : "border-transparent text-slate-500 hover:text-slate-950"}`}
        >
          {t.nombre}
        </button>
      ))}
    </div>
  );
}
export function PaginacionLaunch({
  pagina,
  paginas,
  cambiar,
}: {
  pagina: number;
  paginas: number;
  cambiar: (n: number) => void;
}) {
  if (paginas < 2) return null;
  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-center gap-3 border-t border-slate-100 p-3 text-xs text-slate-500"
    >
      <button
        type="button"
        className={botonLaunch}
        disabled={pagina <= 1}
        onClick={() => cambiar(pagina - 1)}
        aria-label="Página anterior"
      >
        ‹
      </button>
      <span>
        {pagina} / {paginas}
      </span>
      <button
        type="button"
        className={botonLaunch}
        disabled={pagina >= paginas}
        onClick={() => cambiar(pagina + 1)}
        aria-label="Página siguiente"
      >
        ›
      </button>
    </nav>
  );
}
export function TimelineLaunch({
  historial,
}: {
  historial: HistorialLanzamiento;
}) {
  if (!historial.eventos.length)
    return <VacioLaunch>No hay actividad registrada.</VacioLaunch>;
  return (
    <ol className="ml-1 border-l border-slate-200 pl-5">
      {historial.eventos.map((e) => (
        <li key={e.id} className="relative pb-5 last:pb-0">
          <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-blue-500 ring-4 ring-white" />
          <p className="text-[12px] font-medium text-slate-900">{e.titulo}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {e.actor || "Sistema"} · {fechaLaunch(e.fecha, true)}
          </p>
          <Link
            to={`/rrpp/lanzamientos?proyecto=${e.proyectoId}&seccion=historial`}
            className="mt-1 inline-block text-[11px] text-blue-600"
          >
            Proyecto #{e.codigo}
          </Link>
        </li>
      ))}
    </ol>
  );
}
export interface CampoEditorLaunch {
  key: string;
  label: string;
  type?:
    | "date"
    | "time"
    | "url"
    | "textarea"
    | "checkbox"
    | "select"
    | "multi"
    | "project"
    | "datalist";
  options?: { value: string; label: string }[];
  optionsBy?: {
    key: string;
    values: Record<string, { value: string; label: string }[]>;
  };
  required?: boolean;
  hint?: string;
}
export interface EditorLaunchConfig {
  titulo: string;
  subtitulo?: string;
  campos: CampoEditorLaunch[];
  valores: Record<string, CampoLanzamiento>;
  endpoint: string;
  metodo?: "POST" | "PATCH";
  full?: boolean;
  accion?: string;
}
function ProyectoSelector({
  value,
  cambiar,
}: {
  value: string;
  cambiar: (v: string) => void;
}) {
  const [q, setQ] = useState("");
  const [debounce, setDebounce] = useState("");
  const [pagina, setPagina] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounce(q.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const query = useQuery({
    queryKey: ["rrpp", "launch", "selector", debounce, pagina],
    queryFn: () =>
      fetchPlanes(
        new URLSearchParams({
          ...(debounce ? { q: debounce } : {}),
          pagina: String(pagina),
        }).toString(),
      ),
  });
  return (
    <div className="space-y-2">
      <input
        aria-label="Buscar proyecto para el registro"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar autor, título o código…"
        className="launch-input"
      />
      {query.isError ? (
        <ErrorIngreso
          error={query.error}
          reintentar={() => void query.refetch()}
        />
      ) : (
        <>
          <select
            aria-label="Proyecto"
            required
            className="launch-input"
            value={value}
            onChange={(e) => cambiar(e.target.value)}
          >
            <option value="">Selecciona un proyecto</option>
            {value && !query.data?.proyectos.some((p) => p.id === value) && (
              <option value={value}>Proyecto seleccionado</option>
            )}
            {query.data?.proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — #{p.codigo}
              </option>
            ))}
          </select>
          <PaginacionLaunch
            pagina={query.data?.pagina ?? 1}
            paginas={query.data?.paginas ?? 1}
            cambiar={setPagina}
          />
        </>
      )}
    </div>
  );
}
export function EditorLaunch({
  config,
  cerrar,
}: {
  config: EditorLaunchConfig;
  cerrar: () => void;
}) {
  const [valores, setValores] = useState(config.valores);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: Record<string, CampoLanzamiento>) =>
      apiFetch(`${LANZAMIENTOS_API}${config.endpoint}`, {
        method: config.metodo ?? "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await Promise.all(
        [["rrpp"], ["ficha"], ["proyecto"], ["notificaciones"]].map(
          (queryKey) => queryClient.invalidateQueries({ queryKey }),
        ),
      );
      cerrar();
    },
  });
  function valor(key: string, v: CampoLanzamiento) {
    setValores((prev) => {
      const next = { ...prev, [key]: v };
      for (const campo of config.campos) {
        if (
          campo.optionsBy?.key === key &&
          !campo.optionsBy.values[String(v)]?.some(
            (o) => o.value === next[campo.key],
          )
        )
          next[campo.key] = null;
      }
      return next;
    });
  }
  return (
    <Modal
      titulo={config.titulo}
      subtitulo={config.subtitulo}
      onClose={() => {
        if (!mutation.isPending) cerrar();
      }}
      ancho="proyecto"
    >
      <form
        className="rrpp-launches flex min-h-0 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          const body = config.full
            ? { ...valores }
            : Object.fromEntries(
                Object.entries(valores).filter(
                  ([key, value]) =>
                    JSON.stringify(config.valores[key]) !==
                    JSON.stringify(value),
                ),
              );
          if (!Object.keys(body).length) {
            cerrar();
            return;
          }
          mutation.mutate(body);
        }}
      >
        <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          {config.campos.map((c) => (
            <div
              className={
                c.type === "textarea" ||
                c.type === "multi" ||
                c.type === "project"
                  ? "sm:col-span-2"
                  : ""
              }
              key={c.key}
            >
              {c.type === "checkbox" ? (
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={valores[c.key] === true}
                    onChange={(e) => valor(c.key, e.target.checked)}
                  />
                  {c.label}
                </label>
              ) : (
                <>
                  <label
                    className="mb-1.5 block text-xs font-medium text-slate-700"
                    htmlFor={`launch-field-${c.key}`}
                  >
                    {c.label}
                  </label>
                  {c.type === "project" ? (
                    <ProyectoSelector
                      value={String(valores[c.key] ?? "")}
                      cambiar={(v) => valor(c.key, v)}
                    />
                  ) : c.type === "multi" ? (
                    <fieldset
                      id={`launch-field-${c.key}`}
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      <legend className="sr-only">{c.label}</legend>
                      {(c.optionsBy
                        ? c.optionsBy.values[String(valores[c.optionsBy.key])]
                        : c.options
                      )?.map((o) => (
                        <label
                          key={o.value}
                          className="flex items-center gap-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={
                              Array.isArray(valores[c.key]) &&
                              (valores[c.key] as string[]).includes(o.value)
                            }
                            onChange={(e) => {
                              const anterior = Array.isArray(valores[c.key])
                                ? (valores[c.key] as string[])
                                : [];
                              valor(
                                c.key,
                                e.target.checked
                                  ? [...anterior, o.value]
                                  : anterior.filter((v) => v !== o.value),
                              );
                            }}
                          />
                          {o.label}
                        </label>
                      ))}
                    </fieldset>
                  ) : c.type === "select" ? (
                    <select
                      id={`launch-field-${c.key}`}
                      required={c.required}
                      className="launch-input"
                      value={String(valores[c.key] ?? "")}
                      onChange={(e) => valor(c.key, e.target.value || null)}
                    >
                      <option value="">Sin definir</option>
                      {(c.optionsBy
                        ? c.optionsBy.values[String(valores[c.optionsBy.key])]
                        : c.options
                      )?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : c.type === "textarea" ? (
                    <textarea
                      id={`launch-field-${c.key}`}
                      className="launch-input min-h-[90px]"
                      maxLength={5000}
                      value={String(valores[c.key] ?? "")}
                      onChange={(e) => valor(c.key, e.target.value || null)}
                    />
                  ) : (
                    <>
                      <input
                        id={`launch-field-${c.key}`}
                        required={c.required}
                        type={
                          c.type === "datalist" ? "text" : (c.type ?? "text")
                        }
                        list={
                          c.type === "datalist"
                            ? `launch-options-${c.key}`
                            : undefined
                        }
                        className="launch-input"
                        value={String(valores[c.key] ?? "")}
                        maxLength={c.type === "url" ? 2000 : 5000}
                        onChange={(e) => valor(c.key, e.target.value || null)}
                      />
                      {c.type === "datalist" && (
                        <datalist id={`launch-options-${c.key}`}>
                          {c.options?.map((o) => (
                            <option key={o.value} value={o.value} />
                          ))}
                        </datalist>
                      )}
                    </>
                  )}
                </>
              )}
              {c.hint && (
                <p className="mt-1 text-[11px] text-slate-500">{c.hint}</p>
              )}
            </div>
          ))}
        </div>
        {mutation.isError && (
          <p role="alert" className="mx-5 mb-3 text-sm text-red-700">
            {mutation.error.message}
          </p>
        )}
        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={cerrar}
            disabled={mutation.isPending}
            className={botonLaunch}
          >
            Cancelar
          </button>
          <button
            className={botonLaunchPrincipal}
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? "Guardando…"
              : config.accion || "Guardar cambios"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
