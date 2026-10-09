import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ErrorIngreso } from "./RrppIngresosPage";
import { RrppIcon } from "./RrppIcons";
import {
  BadgeLaunch,
  botonLaunch,
  botonLaunchPrincipal,
  CardLaunch,
  DatosLaunch,
  fechaLaunch,
  SkeletonLaunch,
  PaginacionLaunch,
  TabsLaunch,
  TimelineLaunch,
  VacioLaunch,
  type CampoEditorLaunch,
  type EditorLaunchConfig,
} from "./RrppLanzamientoComponents";
import {
  fetchPlan,
  type CatalogosLanzamiento,
  type EventoRrpp,
  type PublicacionRrpp,
} from "./rrppLanzamientosApi";

export const opcionesLaunch = (values: string[]) =>
  values.map((v) => ({ value: v, label: v }));
export const personasLaunch = (c: CatalogosLanzamiento) =>
  c.responsables.map((p) => ({ value: p.id, label: p.nombre }));
export function eventoEditor(
  c: CatalogosLanzamiento,
  proyectoId?: string,
  evento?: EventoRrpp,
): EditorLaunchConfig {
  return {
    titulo: evento ? "Editar evento" : "Registrar evento",
    subtitulo:
      "Coordina la actividad y conserva su relación con el proyecto editorial.",
    endpoint: `/eventos${evento ? `/${evento.id}` : ""}`,
    metodo: evento ? "PATCH" : "POST",
    full: true,
    valores: {
      proyectoId: evento?.proyectoId || proyectoId || "",
      clientKey: evento?.clientKey || crypto.randomUUID(),
      tipo: evento?.tipo || "",
      estado: evento?.estado || "No iniciada",
      fase: evento?.fase || "Antes del evento",
      fecha: evento?.fecha || "",
      hora: evento?.hora?.slice(0, 5) || null,
      lugar: evento?.lugar || null,
      responsableId: evento?.responsableId || null,
      representanteId: evento?.representanteId || null,
      rutaActividad: evento?.rutaActividad || null,
      notasRrss: evento?.notasRrss || null,
      programas: evento?.programas || null,
    },
    campos: [
      ...(!proyectoId && !evento
        ? [
            {
              key: "proyectoId",
              label: "Proyecto",
              type: "project" as const,
              required: true,
            },
          ]
        : []),
      {
        key: "tipo",
        label: "Tipo de evento",
        type: "datalist",
        options: opcionesLaunch(c.tiposEvento),
        required: true,
        hint: "Tipos de la Matriz y de los eventos registrados. Puedes registrar otro tipo real.",
      },
      { key: "fecha", label: "Fecha", type: "date", required: true },
      { key: "hora", label: "Hora local del evento", type: "time" },
      { key: "lugar", label: "Lugar" },
      {
        key: "responsableId",
        label: "Responsable RRPP",
        type: "select",
        options: personasLaunch(c),
      },
      {
        key: "representanteId",
        label: "Representante de PanHouse",
        type: "select",
        options: c.representantes.map((p) => ({
          value: p.id,
          label: p.nombre,
        })),
      },
      {
        key: "estado",
        label: "Estado de trabajo",
        type: "select",
        options: opcionesLaunch(c.estadosEvento),
        required: true,
      },
      {
        key: "fase",
        label: "Fase del evento",
        type: "select",
        options: opcionesLaunch(c.fasesEvento),
      },
      {
        key: "rutaActividad",
        label: "Ruta de actividad / enlace",
        type: "textarea",
      },
      { key: "notasRrss", label: "Notas para RRSS", type: "textarea" },
      { key: "programas", label: "Programas", type: "textarea" },
    ],
  };
}
export function publicacionEditor(
  c: CatalogosLanzamiento,
  proyectoId?: string,
  pieza?: PublicacionRrpp,
): EditorLaunchConfig {
  const tipo = pieza?.tipo || "Futuro Autor";
  // Se edita el estado operativo compartido; los estados particulares de cada
  // pieza se conservan y solo se ofrecen para su tipo real.
  return {
    titulo: pieza ? `Publicación · ${pieza.tipo}` : "Registrar publicación",
    subtitulo: pieza
      ? `${pieza.nombre || "Proyecto seleccionado"}${pieza.codigo ? ` — #${pieza.codigo}` : ""} · Lanzamiento: ${fechaLaunch(pieza.fechaLanzamiento)}`
      : "La fecha de lanzamiento se consulta en la Ficha del proyecto.",
    endpoint: `/publicaciones${pieza ? `/${pieza.id}` : ""}`,
    metodo: pieza ? "PATCH" : "POST",
    full: true,
    valores: {
      proyectoId: pieza?.proyectoId || proyectoId || "",
      clientKey: pieza?.clientKey || crypto.randomUUID(),
      tipo,
      estado: pieza?.estado || "Nuevo",
      estadoPieza: pieza?.estadoPieza || null,
      responsableId: pieza?.responsableId || null,
      detalles: pieza?.detalles || null,
      notas: pieza?.notas || null,
    },
    campos: [
      ...(!proyectoId && !pieza
        ? [
            {
              key: "proyectoId",
              label: "Proyecto",
              type: "project" as const,
              required: true,
            },
          ]
        : []),
      {
        key: "tipo",
        label: "Tipo de pieza",
        type: "select",
        options: opcionesLaunch(c.tiposPublicacion),
        required: true,
      },
      {
        key: "estado",
        label: "Estado de publicación",
        type: "select",
        options: opcionesLaunch(c.estadosPublicacion),
        required: true,
      },
      {
        key: "estadoPieza",
        label: "Estado de la pieza",
        type: "select",
        optionsBy: {
          key: "tipo",
          values: {
            "Futuro Autor": opcionesLaunch(c.estadosPiezaFuturo),
            Novedades: opcionesLaunch(c.estadosPiezaNovedades),
          },
        },
      },
      {
        key: "responsableId",
        label: "Responsable RRPP",
        type: "select",
        options: personasLaunch(c),
      },
      {
        key: "detalles",
        label: "Detalles / recurso de la pieza",
        type: "textarea",
      },
      { key: "notas", label: "Notas", type: "textarea" },
    ],
  };
}
export function EventoLaunchCard({
  evento,
  editar,
}: {
  evento: EventoRrpp;
  editar?: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-900">{evento.tipo}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {fechaLaunch(evento.fecha)}
            {evento.hora ? ` · ${evento.hora.slice(0, 5)}` : ""}
          </p>
        </div>
        <BadgeLaunch>{evento.estado}</BadgeLaunch>
      </div>
      {evento.nombre && (
        <Link
          to={`/rrpp/lanzamientos?proyecto=${evento.proyectoId}&seccion=eventos`}
          className="mt-2 block text-xs font-medium text-blue-600"
        >
          {evento.nombre} — #{evento.codigo}
        </Link>
      )}
      <p className="mt-2 text-xs text-slate-600">
        {evento.lugar || "Lugar por definir"}
      </p>
      {evento.fase && (
        <p className="mt-1 text-[11px] text-slate-500">{evento.fase}</p>
      )}
      {evento.responsable && (
        <p className="mt-1 text-[11px] text-slate-500">{evento.responsable}</p>
      )}
      {editar && (
        <button
          type="button"
          className={`${botonLaunch} mt-3`}
          onClick={editar}
        >
          Ver / editar evento
        </button>
      )}
    </article>
  );
}
export function PublicacionLaunchCard({
  pieza,
  editar,
}: {
  pieza: PublicacionRrpp;
  editar?: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-900">{pieza.tipo}</p>
          <p className="mt-1 text-xs text-slate-500">
            {pieza.nombre
              ? `${pieza.nombre} — #${pieza.codigo}`
              : "Publicación en redes"}
          </p>
        </div>
        <BadgeLaunch>{pieza.estado}</BadgeLaunch>
      </div>
      {pieza.estadoPieza && (
        <p className="mt-2 text-[11px] text-slate-500">{pieza.estadoPieza}</p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Lanzamiento: {fechaLaunch(pieza.fechaLanzamiento)}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Responsable: {pieza.responsable || "Sin asignar"}
      </p>
      {!editar && (
        <p className="mt-3 whitespace-pre-wrap text-xs text-slate-600">
          {[pieza.detalles, pieza.notas].filter(Boolean).join("\n") ||
            "Sin detalles adicionales."}
        </p>
      )}
      {editar && (
        <button
          type="button"
          className={`${botonLaunch} mt-3`}
          onClick={editar}
        >
          Ver / gestionar publicación
        </button>
      )}
    </article>
  );
}
const tabs = [
  { id: "resumen", nombre: "Resumen" },
  { id: "reuniones", nombre: "Reuniones" },
  { id: "ruta", nombre: "Ruta de promoción" },
  { id: "eventos", nombre: "Eventos" },
  { id: "publicaciones", nombre: "Publicaciones" },
  { id: "oportunidades", nombre: "Oportunidades" },
  { id: "historial", nombre: "Historial" },
];
const macro: Record<string, string> = {
  en_proceso: "En proceso",
  retrasado: "Retrasado",
  culminado: "Culminado",
  pausado: "Pausado",
  stand_by: "En espera",
  retirado: "Retirado",
};
export function RrppLanzamientoDetalle({
  id,
  seccion,
  cambiarSeccion,
  volver,
  catalogos,
  editar,
}: {
  id: string;
  seccion: string;
  cambiarSeccion: (s: string) => void;
  volver: () => void;
  catalogos: CatalogosLanzamiento;
  editar: (c: EditorLaunchConfig) => void;
}) {
  const [params, setParams] = useSearchParams();
  const reunionesPagina = Math.max(
    1,
    Number(params.get("reunionesPagina")) || 1,
  );
  const query = useQuery({
    queryKey: ["rrpp", "launch", "detalle", id, reunionesPagina],
    queryFn: () => fetchPlan(id, reunionesPagina),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  const [portadaError, setPortadaError] = useState<string | null>(null);
  const d = query.data;
  if (query.isPending)
    return (
      <div className="rounded-xl border border-slate-200 bg-white">
        <SkeletonLaunch />
      </div>
    );
  if (query.isError)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <button
          className={`${botonLaunch} mb-4 min-[1200px]:hidden`}
          onClick={volver}
        >
          ← Volver a planificación
        </button>
        <ErrorIngreso
          error={query.error}
          reintentar={() => void query.refetch()}
        />
      </div>
    );
  if (!d) return null;
  const f = d.ficha;
  const str = (key: string) =>
    typeof f[key] === "string" ? (f[key] as string) : null;
  const persona = (key: string) =>
    d.participantes.find((p) => p.id === f[key])?.nombre || null;
  function abrir(titulo: string, campos: CampoEditorLaunch[], accion?: string) {
    editar({
      titulo,
      subtitulo: `${d!.nombre} — #${d!.codigo}`,
      campos,
      endpoint: `/planes/${id}`,
      valores: Object.fromEntries(
        campos.map((c) => [
          c.key,
          f[c.key] ??
            (c.type === "checkbox" ? false : c.type === "multi" ? [] : null),
        ]),
      ),
      accion,
    });
  }
  function reunion(n: "Primera" | "Segunda") {
    abrir(`${n === "Primera" ? "1ª" : "2ª"} reunión de lanzamiento`, [
      {
        key: `lanzamientoPromocionFecha${n}Reunion`,
        label: "Fecha de la reunión",
        type: "date",
        required: true,
      },
      {
        key: `lanzamientoPromocion${n}ResponsableId`,
        label: "Responsable RRPP",
        type: "select",
        options: personasLaunch(catalogos),
      },
      {
        key: `lanzamientoPromocion${n}Realizada`,
        label: "Reunión realizada",
        type: "checkbox",
        hint: "Marca únicamente después de sostener la reunión.",
      },
      {
        key:
          n === "Primera"
            ? "lanzamientoPromocionPuntosTratadosPrimera"
            : "lanzamientoPromocionAcuerdosSegunda",
        label: n === "Primera" ? "Puntos tratados" : "Acuerdos",
        type: "textarea",
      },
      {
        key: "asesoriaNivelSatisfaccion",
        label: "Nivel de satisfacción",
        type: "select",
        options: opcionesLaunch(catalogos.satisfaccion),
        hint: "Evaluación cualitativa registrada por RRPP durante la asesoría.",
      },
    ]);
  }
  function plan() {
    abrir("Editar plan de lanzamiento", [
      {
        key: "asesoriaFase",
        label: "Fase de lanzamiento",
        type: "select",
        options: opcionesLaunch(catalogos.fases),
      },
      {
        key: "asesoriaFechaSugeridaGe",
        label: "Fecha sugerida por GE",
        type: "date",
      },
      {
        key: "lanzamientoPromocionFechaTentativa",
        label: "Fecha tentativa",
        type: "date",
      },
      {
        key: "asesoriaFechaPautadaAutor",
        label: "Fecha pautada por el autor",
        type: "date",
      },
      {
        key: "lanzamientoPromocionTipo",
        label: "Tipo de lanzamiento",
        type: "datalist",
        options: opcionesLaunch(["ONLINE", "PRESENCIAL", "HIBRIDO"]),
      },
      {
        key: "lanzamientoPromocionIsbn",
        label: "País de tramitación del ISBN",
      },
      {
        key: "lanzamientoPromocionObjetivoComercial",
        label: "Objetivo comercial del autor",
        type: "textarea",
      },
      {
        key: "lanzamientoPromocionDetallesProyeccion",
        label: "Detalles de la proyección",
        type: "textarea",
      },
      {
        key: "lanzamientoPromocionObservaciones",
        label: "Observaciones del lanzamiento",
        type: "textarea",
      },
      {
        key: "lanzamientoPromocionObservacionesGenerales",
        label: "Observaciones generales",
        type: "textarea",
      },
    ]);
  }
  function ruta() {
    abrir("Ruta de promoción", [
      {
        key: "asesoriaLinkRutaPromocion",
        label: "Enlace de la ruta",
        type: "url",
        hint: "Enlace al documento en Drive u otro almacenamiento del equipo.",
      },
      {
        key: "asesoriaRutaPromocionEnviada",
        label: "Ruta enviada al autor",
        type: "checkbox",
      },
      {
        key: "asesoriaLinkMinutaGerencia",
        label: "Minuta para la Gerencia Editorial",
        type: "url",
      },
      {
        key: "lanzamientoPromocionLinkMinuta",
        label: "Resumen / minuta de reuniones",
        type: "url",
      },
      {
        key: "asesoriaNotas",
        label: "Notas de asesoría y promoción",
        type: "textarea",
      },
    ]);
  }
  function feria() {
    abrir("Participación en ferias", [
      {
        key: "asesoriaFeriaProyectada",
        label: "Feria proyectada",
        type: "select",
        options: opcionesLaunch(catalogos.ferias),
      },
      {
        key: "asesoriaParticipacionFeria",
        label: "Autor confirma participación",
        type: "checkbox",
      },
      {
        key: "asesoriaFeriaAParticipar",
        label: "Feria a participar",
        type: "select",
        options: opcionesLaunch(catalogos.feriasConfirmadas),
      },
      {
        key: "asesoriaInfoFeriaEnviada",
        label: "Información de feria enviada",
        type: "checkbox",
      },
      {
        key: "lanzamientoPromocionParticipacionFerias",
        label: "Proyección del autor sobre ferias",
        type: "select",
        options: opcionesLaunch(["Sí", "No", "Pendiente"]),
      },
    ]);
  }
  const estadoRuta = f.asesoriaRutaPromocionEnviada
    ? "Enviada"
    : f.asesoriaLinkRutaPromocion
      ? "Lista"
      : "En preparación";
  const reunionEstado = (n: "Primera" | "Segunda") =>
    !str(`lanzamientoPromocionFecha${n}Reunion`)
      ? "Pendiente"
      : f[`lanzamientoPromocion${n}Realizada`] === true
        ? "Realizada"
        : f[`lanzamientoPromocion${n}Realizada`] === false
          ? "Programada"
          : "Registrada";
  const hitos = [
    {
      titulo: "1ª reunión de lanzamiento",
      estado: reunionEstado("Primera"),
      fecha: str("lanzamientoPromocionFechaPrimeraReunion"),
      accion: () => reunion("Primera"),
    },
    {
      titulo: "2ª reunión de lanzamiento",
      estado: reunionEstado("Segunda"),
      fecha: str("lanzamientoPromocionFechaSegundaReunion"),
      accion: () => reunion("Segunda"),
    },
    {
      titulo: "Ruta de promoción",
      estado: estadoRuta,
      fecha: null,
      accion: ruta,
    },
    {
      titulo: "Envío de ruta al autor",
      estado: f.asesoriaRutaPromocionEnviada ? "Enviada" : "Pendiente",
      fecha: null,
      accion: ruta,
    },
    {
      titulo: "Fecha de lanzamiento",
      estado: f.asesoriaFechaPautadaAutor
        ? "Confirmada por el autor"
        : "Pendiente",
      fecha: str("asesoriaFechaPautadaAutor"),
      accion: plan,
    },
    {
      titulo: "Feria / evento asociado",
      estado: d.eventos.length
        ? `${d.totalEventos} ${d.totalEventos === 1 ? "evento registrado" : "eventos registrados"}`
        : f.asesoriaParticipacionFeria
          ? "Participación registrada"
          : "Sin evento registrado",
      fecha: d.eventos[0]?.fecha || null,
      accion: () => cambiarSeccion("eventos"),
    },
  ];
  const tab = tabs.some((t) => t.id === seccion) ? seccion : "resumen";
  const feriaCard = (
    <CardLaunch
      titulo="Feria"
      icono="calendario"
      accion={
        d.editable && (
          <button className="text-[11px] text-blue-600" onClick={feria}>
            Gestionar
          </button>
        )
      }
    >
      <DatosLaunch
        filas={[
          ["Feria proyectada", str("asesoriaFeriaProyectada")],
          [
            "Participación",
            f.asesoriaParticipacionFeria ? "Confirmada" : "Sin confirmar",
          ],
          [
            "Información enviada",
            f.asesoriaInfoFeriaEnviada ? "Sí" : "No registrada",
          ],
          ["Feria a participar", str("asesoriaFeriaAParticipar")],
        ]}
      />
      {d.eventos.some((e) => /feria/i.test(e.tipo)) && (
        <Link
          to={`/rrpp/lanzamientos?tab=agenda&proyecto=${id}`}
          className="mt-3 inline-block text-xs text-blue-600"
        >
          Ver eventos en Agenda →
        </Link>
      )}
    </CardLaunch>
  );
  return (
    <article className="launch-scroll min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <button
        className={`${botonLaunch} m-4 min-[1200px]:hidden`}
        type="button"
        onClick={volver}
      >
        ← Volver a planificación
      </button>
      <header className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {d.portadaUrl && portadaError !== d.portadaUrl ? (
              <img
                src={d.portadaUrl}
                alt="Portada del proyecto"
                className="h-16 w-11 rounded object-cover"
                onError={() => setPortadaError(d.portadaUrl)}
              />
            ) : (
              <div
                aria-label="Portada sin registrar"
                className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400"
              >
                <RrppIcon nombre="ingreso" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="break-words text-[20px] font-bold tracking-tight text-slate-950">
                {d.nombre} — #{d.codigo}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {d.servicio.codigo} — {d.servicio.nombre}
              </p>
              {d.titulo && (
                <p className="mt-1 text-xs text-slate-600">{d.titulo}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              className={botonLaunch}
              to={`/proyectos/${id}/ficha-trazabilidad#lanzamiento`}
            >
              <RrppIcon nombre="externo" className="h-3.5 w-3.5" />
              Ver ficha completa
            </Link>
            <details className="relative">
              <summary
                aria-label="Opciones del lanzamiento"
                className="cursor-pointer list-none rounded p-2 text-slate-500"
              >
                ⋮
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  disabled={!d.editable}
                  className="w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-50"
                  onClick={plan}
                >
                  Editar planificación
                </button>
                <button
                  disabled={!d.editable}
                  className="w-full rounded px-3 py-2 text-left text-xs hover:bg-slate-50"
                  onClick={() =>
                    editar({
                      titulo: "Asignar responsable RRPP",
                      campos: [
                        {
                          key: "responsableId",
                          label: "Responsable RRPP",
                          type: "select",
                          options: personasLaunch(catalogos),
                          required: true,
                        },
                      ],
                      valores: { responsableId: d.responsableId },
                      endpoint: `/planes/${id}/responsable`,
                      full: true,
                    })
                  }
                >
                  Asignar responsable
                </button>
                <Link
                  to={`/rrpp/proyectos?proyecto=${id}`}
                  className="block rounded px-3 py-2 text-xs hover:bg-slate-50"
                >
                  Ver proyecto 360°
                </Link>
              </div>
            </details>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <BadgeLaunch>{d.fase || "Sin fase definida"}</BadgeLaunch>
          <BadgeLaunch>{macro[d.estado] || d.estado}</BadgeLaunch>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4">
          {[
            ["Fecha de ingreso", fechaLaunch(str("ingresoFechaIngreso"))],
            [
              "Lanzamiento tentativo",
              fechaLaunch(str("lanzamientoPromocionFechaTentativa")),
            ],
            ["Responsable RRPP", d.responsable || "Sin asignar"],
            ["Feria proyectada", d.feria || "—"],
          ].map(([label, v]) => (
            <div key={label}>
              <dt className="text-slate-500">{label}</dt>
              <dd className="mt-1 break-words font-medium text-slate-900">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </header>
      {!d.editable && (
        <p className="m-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          Planificación disponible solo para consulta.
        </p>
      )}
      <TabsLaunch
        tabs={tabs}
        valor={tab}
        cambiar={cambiarSeccion}
        prefix="launch-detail"
      />
      <div
        id="launch-detail-panel"
        role="tabpanel"
        aria-labelledby={`launch-detail-tab-${tab}`}
        className="p-4 sm:p-4"
      >
        {tab === "resumen" && (
          <div className="grid gap-3 min-[1450px]:grid-cols-[1fr_1fr] min-[1200px]:grid-cols-[1fr_0.95fr] sm:grid-cols-2">
            <div className="space-y-3">
              <CardLaunch titulo="Plan de lanzamiento" icono="lanzamiento">
                <ol className="ml-1 border-l border-slate-200 pl-5">
                  {hitos.map((h, i) => (
                    <li key={h.titulo} className="relative pb-4 last:pb-0">
                      <span
                        className={`absolute -left-[26px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white ${/Realizada|Enviada|Confirmada/.test(h.estado) ? "bg-emerald-500" : "bg-slate-300"}`}
                      />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            disabled={!d.editable}
                            className="text-left text-[12px] font-medium text-slate-900 hover:text-blue-600"
                            onClick={h.accion}
                          >
                            {h.titulo}
                          </button>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {h.estado}
                            {h.fecha ? ` · ${fechaLaunch(h.fecha)}` : ""}
                          </p>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {i + 1}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardLaunch>
              <CardLaunch
                titulo="Últimas actualizaciones"
                accion={
                  <button
                    className="text-[11px] text-blue-600"
                    onClick={() => cambiarSeccion("historial")}
                  >
                    Ver todo
                  </button>
                }
              >
                <TimelineLaunch
                  historial={{
                    ...d.historial,
                    eventos: d.historial.eventos.slice(0, 4),
                  }}
                />
              </CardLaunch>
            </div>
            <div className="space-y-3">
              <CardLaunch titulo="Estado del lanzamiento" icono="proceso">
                <BadgeLaunch>{d.fase || "Sin fase definida"}</BadgeLaunch>
                <div className="mt-3 space-y-2.5">
                  {hitos.slice(0, 5).map((h) => (
                    <div key={h.titulo}>
                      <div className="flex justify-between gap-2 text-[11px]">
                        <span className="text-slate-500">{h.titulo}</span>
                        <span className="text-right font-medium text-slate-900">
                          {h.estado}
                        </span>
                      </div>
                      <div
                        aria-hidden="true"
                        className="mt-1 h-1.5 rounded bg-slate-100"
                      >
                        <div
                          className={`h-full rounded ${/Realizada|Enviada|Confirmada/.test(h.estado) ? "w-full bg-emerald-500" : /Programada|Lista/.test(h.estado) ? "w-1/2 bg-blue-500" : "w-0"}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
                  Hitos registrados; las barras distinguen pendiente, preparado
                  y realizado.
                </p>
              </CardLaunch>
              <CardLaunch titulo="Fechas clave" icono="calendario">
                <DatosLaunch
                  filas={[
                    [
                      "Sugerida por GE",
                      fechaLaunch(str("asesoriaFechaSugeridaGe")),
                    ],
                    [
                      "Tentativa de lanzamiento",
                      fechaLaunch(str("lanzamientoPromocionFechaTentativa")),
                    ],
                    [
                      "Pautada por el autor",
                      fechaLaunch(str("asesoriaFechaPautadaAutor")),
                    ],
                    ["Próxima acción", d.proximaAccion],
                    ["Fecha próxima", fechaLaunch(d.proximaFecha)],
                    [
                      "Última actividad",
                      fechaLaunch(d.historial.eventos[0]?.fecha, true),
                    ],
                  ]}
                />
              </CardLaunch>
              {feriaCard}
              <CardLaunch titulo="Acciones rápidas" icono="rapido">
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!d.editable}
                    className={botonLaunch}
                    onClick={() =>
                      !f.lanzamientoPromocionFechaPrimeraReunion
                        ? reunion("Primera")
                        : !f.lanzamientoPromocionFechaSegundaReunion
                          ? reunion("Segunda")
                          : ruta()
                    }
                  >
                    {!f.lanzamientoPromocionFechaPrimeraReunion
                      ? "Programar 1ª reunión"
                      : !f.lanzamientoPromocionFechaSegundaReunion
                        ? "Programar 2ª reunión"
                        : "Gestionar ruta"}
                  </button>
                  <button
                    disabled={!d.editable}
                    className={botonLaunch}
                    onClick={plan}
                  >
                    Editar plan
                  </button>
                  <button
                    disabled={!d.editable}
                    className={botonLaunchPrincipal}
                    onClick={() => editar(eventoEditor(catalogos, id))}
                  >
                    Registrar evento
                  </button>
                </div>
              </CardLaunch>
            </div>
          </div>
        )}
        {tab === "reuniones" && (
          <div className="space-y-4">
            {(["Primera", "Segunda"] as const).map((n) => (
              <CardLaunch
                key={n}
                titulo={`${n === "Primera" ? "1ª" : "2ª"} reunión de lanzamiento`}
                accion={<BadgeLaunch>{reunionEstado(n)}</BadgeLaunch>}
              >
                <DatosLaunch
                  filas={[
                    [
                      "Fecha",
                      fechaLaunch(str(`lanzamientoPromocionFecha${n}Reunion`)),
                    ],
                    [
                      "Responsable",
                      persona(`lanzamientoPromocion${n}ResponsableId`) ||
                        str(`lanzamientoPromocionEncargado${n}Reunion`),
                    ],
                    ["Satisfacción", str("asesoriaNivelSatisfaccion")],
                  ]}
                />
                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                  {str(
                    n === "Primera"
                      ? "lanzamientoPromocionPuntosTratadosPrimera"
                      : "lanzamientoPromocionAcuerdosSegunda",
                  ) || "Puntos y acuerdos sin registrar."}
                </p>
                <button
                  disabled={!d.editable}
                  className={`${botonLaunch} mt-3`}
                  onClick={() => reunion(n)}
                >
                  {f[`lanzamientoPromocionFecha${n}Reunion`]
                    ? "Revisar reunión"
                    : "Programar reunión"}
                </button>
              </CardLaunch>
            ))}
            <CardLaunch
              titulo="Reuniones adicionales"
              accion={
                <button
                  disabled={!d.editable}
                  className={botonLaunch}
                  onClick={() =>
                    editar({
                      titulo: "Registrar reunión adicional",
                      campos: [
                        {
                          key: "fecha",
                          label: "Fecha de reunión",
                          type: "date",
                          required: true,
                        },
                        {
                          key: "responsableId",
                          label: "Responsable RRPP",
                          type: "select",
                          options: personasLaunch(catalogos),
                        },
                        {
                          key: "realizada",
                          label: "Reunión realizada",
                          type: "checkbox",
                        },
                        {
                          key: "puntosTratados",
                          label: "Puntos tratados",
                          type: "textarea",
                        },
                        {
                          key: "acuerdos",
                          label: "Acuerdos",
                          type: "textarea",
                        },
                      ],
                      endpoint: `/planes/${id}/reuniones`,
                      metodo: "POST",
                      full: true,
                      valores: {
                        clientKey: crypto.randomUUID(),
                        fecha: "",
                        responsableId: null,
                        realizada: false,
                        puntosTratados: null,
                        acuerdos: null,
                      },
                    })
                  }
                >
                  Registrar reunión
                </button>
              }
            >
              {str("asesoriaFechaAdicional") && (
                <p className="mb-3 text-xs text-slate-500">
                  Asesoría adicional histórica:{" "}
                  {fechaLaunch(str("asesoriaFechaAdicional"))}
                </p>
              )}
              {!d.reuniones.length ? (
                <p className="text-xs text-slate-500">
                  No hay reuniones adicionales registradas.
                </p>
              ) : (
                <ol className="space-y-3">
                  {d.reuniones.map((r) => (
                    <li key={r.id} className="rounded-lg bg-slate-50 p-3">
                      <div className="flex justify-between gap-2">
                        <p className="text-xs font-medium">
                          {fechaLaunch(r.fecha)} ·{" "}
                          {r.responsable || "Responsable sin registrar"}
                        </p>
                        <BadgeLaunch>
                          {r.realizada === true
                            ? "Realizada"
                            : r.realizada === false
                              ? "Programada"
                              : "Registrada"}
                        </BadgeLaunch>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                        {r.puntosTratados || "Sin puntos registrados"}
                      </p>
                      {r.acuerdos && (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                          Acuerdos: {r.acuerdos}
                        </p>
                      )}
                      <button
                        disabled={!d.editable}
                        className={`${botonLaunch} mt-2`}
                        onClick={() =>
                          editar({
                            titulo: "Revisar reunión adicional",
                            campos: [
                              {
                                key: "fecha",
                                label: "Fecha",
                                type: "date",
                                required: true,
                              },
                              {
                                key: "realizada",
                                label: "Reunión realizada",
                                type: "checkbox",
                              },
                              {
                                key: "responsableId",
                                label: "Responsable RRPP",
                                type: "select",
                                options: personasLaunch(catalogos),
                              },
                              {
                                key: "puntosTratados",
                                label: "Puntos tratados",
                                type: "textarea",
                              },
                              {
                                key: "acuerdos",
                                label: "Acuerdos",
                                type: "textarea",
                              },
                            ],
                            endpoint: `/planes/${id}/reuniones/${r.id}`,
                            full: true,
                            valores: {
                              clientKey: r.clientKey || crypto.randomUUID(),
                              fecha: r.fecha,
                              realizada: r.realizada ?? false,
                              responsableId: r.responsableId,
                              puntosTratados: r.puntosTratados,
                              acuerdos: r.acuerdos,
                            },
                          })
                        }
                      >
                        Revisar
                      </button>
                    </li>
                  ))}
                </ol>
              )}
              <PaginacionLaunch
                pagina={d.reunionesPaginacion.pagina}
                paginas={d.reunionesPaginacion.paginas}
                cambiar={(pagina) => {
                  const next = new URLSearchParams(params);
                  if (pagina === 1) next.delete("reunionesPagina");
                  else next.set("reunionesPagina", String(pagina));
                  setParams(next);
                }}
              />
            </CardLaunch>
            <CardLaunch titulo="Historial de responsables">
              <ol className="space-y-2 text-xs text-slate-600">
                {d.asignaciones.length ? (
                  d.asignaciones.map((a) => (
                    <li key={a.id}>
                      {a.nombre} · {fechaLaunch(a.desde)}
                      {a.hasta
                        ? ` hasta ${fechaLaunch(a.hasta)}`
                        : " · Asignación actual"}
                    </li>
                  ))
                ) : (
                  <li>Sin asignaciones registradas.</li>
                )}
              </ol>
            </CardLaunch>
          </div>
        )}
        {tab === "ruta" && (
          <div className="space-y-3">
            <CardLaunch
              titulo="Ruta de promoción"
              icono="lanzamiento"
              accion={<BadgeLaunch>{estadoRuta}</BadgeLaunch>}
            >
              <DatosLaunch
                filas={[
                  ["Responsable RRPP", d.responsable],
                  [
                    "Última modificación",
                    fechaLaunch(
                      d.historial.eventos.find((e) =>
                        /Ruta de promoción/.test(e.titulo),
                      )?.fecha,
                      true,
                    ),
                  ],
                ]}
              />
              {str("asesoriaLinkRutaPromocion") ? (
                <a
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-xs text-blue-600"
                  href={str("asesoriaLinkRutaPromocion")!}
                >
                  <RrppIcon nombre="externo" className="h-3.5 w-3.5" />
                  Abrir ruta de promoción
                </a>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Enlace de ruta sin registrar.
                </p>
              )}
              <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                {str("asesoriaNotas") || "Sin notas de promoción."}
              </p>
              <button
                disabled={!d.editable}
                onClick={ruta}
                className={`${botonLaunchPrincipal} mt-4`}
              >
                Gestionar ruta
              </button>
            </CardLaunch>
            <CardLaunch titulo="Minutas y documentos">
              {[
                "asesoriaLinkMinutaGerencia",
                "lanzamientoPromocionLinkMinuta",
              ].map((k, i) =>
                str(k) ? (
                  <a
                    key={k}
                    className="mb-2 block text-xs text-blue-600"
                    href={str(k)!}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {i
                      ? "Minuta de reuniones"
                      : "Minuta para Gerencia Editorial"}{" "}
                    ↗
                  </a>
                ) : (
                  <p key={k} className="mb-2 text-xs text-slate-500">
                    {i
                      ? "Minuta de reuniones"
                      : "Minuta para Gerencia Editorial"}
                    : —
                  </p>
                ),
              )}
            </CardLaunch>
          </div>
        )}
        {tab === "eventos" && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <Link
                className={botonLaunch}
                to={`/rrpp/lanzamientos?tab=agenda&proyecto=${id}`}
              >
                Ver en Agenda
              </Link>
              <button
                disabled={!d.editable}
                className={botonLaunchPrincipal}
                onClick={() => editar(eventoEditor(catalogos, id))}
              >
                Registrar evento
              </button>
            </div>
            {d.eventos.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.eventos.map((e) => (
                  <EventoLaunchCard
                    key={e.id}
                    evento={e}
                    editar={
                      d.editable
                        ? () => editar(eventoEditor(catalogos, id, e))
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <VacioLaunch>
                No hay eventos registrados para este proyecto.
              </VacioLaunch>
            )}
            {d.totalEventos > d.eventos.length && (
              <p className="text-xs text-slate-500">
                Mostrando {d.eventos.length} de {d.totalEventos} eventos.
                Consulta Agenda por período para ver las demás actividades.
              </p>
            )}
            {feriaCard}
          </div>
        )}
        {tab === "publicaciones" && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between gap-2">
              <Link
                className={botonLaunch}
                to={`/rrpp/lanzamientos?tab=publicaciones&proyecto=${id}`}
              >
                Ver bandeja
              </Link>
              <button
                disabled={!d.editable}
                className={botonLaunchPrincipal}
                onClick={() => editar(publicacionEditor(catalogos, id))}
              >
                Registrar publicación
              </button>
            </div>
            {d.publicaciones.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {d.publicaciones.map((p) => (
                  <PublicacionLaunchCard
                    key={p.id}
                    pieza={{
                      ...p,
                      fechaLanzamiento:
                        str("asesoriaFechaPautadaAutor") ||
                        str("lanzamientoPromocionFechaTentativa"),
                    }}
                    editar={
                      d.editable
                        ? () =>
                            editar(
                              publicacionEditor(catalogos, id, {
                                ...p,
                                nombre: d.nombre,
                                codigo: d.codigo,
                                fechaLanzamiento:
                                  str("asesoriaFechaPautadaAutor") ||
                                  str("lanzamientoPromocionFechaTentativa"),
                              }),
                            )
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <VacioLaunch>No hay publicaciones en esta vista.</VacioLaunch>
            )}
            {d.totalPublicaciones > d.publicaciones.length && (
              <p className="text-xs text-slate-500">
                Mostrando {d.publicaciones.length} de {d.totalPublicaciones}{" "}
                publicaciones. Abre la bandeja para consultar todas las páginas.
              </p>
            )}
          </div>
        )}
        {tab === "oportunidades" && (
          <div className="space-y-3">
            <CardLaunch titulo="Oportunidades de postventa" icono="rapido">
              <p className="mb-4 text-xs leading-relaxed text-slate-500">
                Registra intereses y deriva al área responsable para su
                atención.
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(f.asesoriaVentaCruzada) &&
                f.asesoriaVentaCruzada.length ? (
                  f.asesoriaVentaCruzada.map((v) => (
                    <BadgeLaunch key={v}>{v}</BadgeLaunch>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    Intereses sin registrar.
                  </p>
                )}
              </div>
              <DatosLaunch
                filas={[
                  ["Futuro autor", str("asesoriaFuturoAutor")],
                  [
                    "Solicita cotización de impresión",
                    f.asesoriaCotizacionImpresion ? "Sí" : "Sin solicitar",
                  ],
                  [
                    "Solicitud de cotización",
                    fechaLaunch(str("asesoriaFechaCotizacionSolicitada")),
                  ],
                  [
                    "Cotización enviada",
                    fechaLaunch(str("asesoriaFechaCotizacionEnviada")),
                  ],
                  [
                    "Cotización aceptada",
                    f.asesoriaCotizacionAceptada ? "Sí" : "Sin registrar",
                  ],
                  [
                    "Distribución aceptada",
                    f.asesoriaDistribucionAceptada ? "Sí" : "Sin registrar",
                  ],
                ]}
              />
              <p className="mt-3 whitespace-pre-wrap text-xs text-slate-600">
                {str("asesoriaNotaDistribucion") ||
                  "Sin notas de derivación a Distribución."}
              </p>
              <button
                disabled={!d.editable}
                className={`${botonLaunchPrincipal} mt-4`}
                onClick={() =>
                  abrir("Registrar interés / derivación", [
                    {
                      key: "asesoriaVentaCruzada",
                      label: "Productos o servicios de interés",
                      type: "multi",
                      options: opcionesLaunch(catalogos.ventaCruzada),
                    },
                    {
                      key: "asesoriaFuturoAutor",
                      label: "Publicación como Futuro Autor",
                      type: "select",
                      options: opcionesLaunch(catalogos.futuroAutor),
                    },
                    {
                      key: "asesoriaCotizacionImpresion",
                      label: "Autor solicita cotización de impresión",
                      type: "checkbox",
                    },
                    {
                      key: "asesoriaFechaCotizacionSolicitada",
                      label: "Fecha de solicitud de cotización",
                      type: "date",
                    },
                    {
                      key: "asesoriaNotaDistribucion",
                      label: "Notas para Distribución",
                      type: "textarea",
                    },
                  ])
                }
              >
                Registrar / derivar
              </button>
            </CardLaunch>
            {feriaCard}
            <CardLaunch titulo="Nivel de satisfacción">
              <BadgeLaunch>
                {str("asesoriaNivelSatisfaccion") || "Sin registrar"}
              </BadgeLaunch>
              <p className="mt-3 text-xs text-slate-500">
                Evaluación cualitativa de la asesoría, registrada por RRPP.
              </p>
              <button
                disabled={!d.editable}
                className={`${botonLaunch} mt-3`}
                onClick={() =>
                  abrir("Registrar satisfacción", [
                    {
                      key: "asesoriaNivelSatisfaccion",
                      label: "Nivel de satisfacción",
                      type: "select",
                      options: opcionesLaunch(catalogos.satisfaccion),
                    },
                  ])
                }
              >
                Registrar evaluación
              </button>
            </CardLaunch>
          </div>
        )}
        {tab === "historial" && (
          <CardLaunch titulo="Historial del lanzamiento">
            <TimelineLaunch historial={d.historial} />
            {d.historial.paginas > 1 && (
              <Link
                className="mt-3 inline-block text-xs text-blue-600"
                to={`/rrpp/lanzamientos?tab=historial&proyecto=${id}`}
              >
                Ver historial completo →
              </Link>
            )}
          </CardLaunch>
        )}
      </div>
    </article>
  );
}
