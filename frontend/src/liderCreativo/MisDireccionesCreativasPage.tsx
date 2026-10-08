import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { hoyISO } from '../proyectos/campos';
import {
  agregarConceptoPortada,
  fetchMisDireccionesCreativas,
  fetchPropuestasDeDireccionCreativa,
  registrarBrief,
  registrarRecursosCreativos,
  registrarReunionCreativa,
} from '../proyectos/direccionCreativaApi';
import type { TrabajoLiderCreativo } from '../types/api';

const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';
const ALTO_LLENO_MAIN = 'h-[calc(100%+3rem)]';

function formatearFechaCorta(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es');
}

type Etapa = 'reunion_pendiente' | 'brief_pendiente' | 'conceptos_pendientes' | 'esperando_terceros' | 'cerrado';

// Sin SLA proyectado confiable para Dirección Creativa (checkpoint 5B
// §0.1 aplicado por extensión — ver PENDIENTE_CONFIRMACION_NEGOCIO_DIRECCION_CREATIVA_SLA
// en server/helpers/direccionCreativaSla.ts): la prioridad se deriva de
// en qué paso REAL está cada intervención, no de un vencimiento
// inventado.
function calcularEtapa(trabajo: TrabajoLiderCreativo): Etapa {
  if (trabajo.estado === 'completado') return 'cerrado';
  if (!trabajo.reunionRealizada) return 'reunion_pendiente';
  if (!trabajo.briefEnlace) return 'brief_pendiente';
  if (!trabajo.fechaBriefAprobadoAutor) return 'esperando_terceros';
  return 'conceptos_pendientes';
}

const ETAPA_INFO: Record<Etapa, { etiqueta: string; dot: string; badge: string }> = {
  reunion_pendiente: { etiqueta: 'Reunión pendiente', dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
  brief_pendiente: { etiqueta: 'Brief pendiente', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800' },
  esperando_terceros: { etiqueta: 'Esperando aprobación del autor', dot: 'bg-blue-400', badge: 'bg-blue-100 text-blue-800' },
  conceptos_pendientes: { etiqueta: 'Conceptos por entregar', dot: 'bg-dorado', badge: 'bg-dorado/20 text-tinta' },
  cerrado: { etiqueta: 'Cerrado', dot: 'bg-green-500', badge: 'bg-green-100 text-green-800' },
};

const ORDEN_ETAPA: Record<Etapa, number> = {
  reunion_pendiente: 0,
  brief_pendiente: 1,
  conceptos_pendientes: 2,
  esperando_terceros: 3,
  cerrado: 4,
};

function FormularioReunion({ trabajo }: { trabajo: TrabajoLiderCreativo }) {
  const [fecha, setFecha] = useState(trabajo.fechaReunion ?? hoyISO());
  const [enlaceGrabacion, setEnlaceGrabacion] = useState(trabajo.enlaceGrabacion ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => registrarReunionCreativa(trabajo.id, { fecha, realizada: true, enlaceGrabacion: enlaceGrabacion || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones-creativas', 'mias'] }),
  });

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
      <div className="flex gap-2">
        <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm" />
        <input
          type="text"
          placeholder="Enlace de grabación/transcripción"
          value={enlaceGrabacion}
          onChange={(event) => setEnlaceGrabacion(event.target.value)}
          className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={() => mutacion.mutate()}
        disabled={mutacion.isPending}
        className="self-start rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-tinta hover:brightness-95 disabled:opacity-60"
      >
        {mutacion.isPending ? 'Guardando…' : 'Marcar reunión realizada'}
      </button>
    </div>
  );
}

function FormularioBrief({ trabajo }: { trabajo: TrabajoLiderCreativo }) {
  const [briefEnlace, setBriefEnlace] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => registrarBrief(trabajo.id, { briefEnlace, fechaBriefEnviadoEspecialista: hoyISO() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones-creativas', 'mias'] }),
  });

  return (
    <div className="mt-3 flex items-end gap-2 rounded-lg bg-gray-50 p-3">
      <input
        type="text"
        placeholder="Enlace del brief creativo (Drive)"
        value={briefEnlace}
        onChange={(event) => setBriefEnlace(event.target.value)}
        className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={() => mutacion.mutate()}
        disabled={mutacion.isPending || !briefEnlace}
        className="rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-tinta hover:brightness-95 disabled:opacity-60"
      >
        {mutacion.isPending ? 'Enviando…' : 'Enviar brief al especialista'}
      </button>
    </div>
  );
}

function SeccionConceptos({ trabajo }: { trabajo: TrabajoLiderCreativo }) {
  const propuestasQuery = useQuery({
    queryKey: ['direccion-creativa', trabajo.id, 'propuestas'],
    queryFn: () => fetchPropuestasDeDireccionCreativa(trabajo.id),
  });
  const [descripcion, setDescripcion] = useState('');
  const [enlace, setEnlace] = useState('');
  const [recursoImagenUrl, setRecursoImagenUrl] = useState('');
  const [recursoConceptoPdfUrl, setRecursoConceptoPdfUrl] = useState('');
  const queryClient = useQueryClient();

  const mutacionConcepto = useMutation({
    mutationFn: () => agregarConceptoPortada(trabajo.id, { descripcion: descripcion || null, enlace: enlace || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['direccion-creativa', trabajo.id, 'propuestas'] });
      setDescripcion('');
      setEnlace('');
    },
  });

  const mutacionRecursos = useMutation({
    mutationFn: () => registrarRecursosCreativos(trabajo.id, { recursoImagenUrl: recursoImagenUrl || null, recursoConceptoPdfUrl: recursoConceptoPdfUrl || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones-creativas', 'mias'] }),
  });

  const hayAprobado = (propuestasQuery.data?.propuestas ?? []).some((p) => p.fechaAprobadaAutor);

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-lg bg-gray-50 p-3">
      {propuestasQuery.isLoading && <p className="text-xs text-gray-500">Cargando conceptos…</p>}

      {propuestasQuery.data && propuestasQuery.data.propuestas.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs">
          {propuestasQuery.data.propuestas.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-md bg-white px-2 py-1.5">
              <span>{p.descripcion ?? 'Concepto sin descripción'}</span>
              <span>
                {p.fechaAprobadaAutor ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">Aprobado por autor</span>
                ) : p.fechaAprobadaRrpp ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800">RRPP aprobó — esperando autor</span>
                ) : (
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 font-medium text-gray-700">Esperando RRPP</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <input
          type="text"
          placeholder="Descripción del concepto"
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        />
        <input
          type="text"
          placeholder="Enlace de la propuesta"
          value={enlace}
          onChange={(event) => setEnlace(event.target.value)}
          className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={() => mutacionConcepto.mutate()}
          disabled={mutacionConcepto.isPending}
          className="shrink-0 rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-tinta hover:brightness-95 disabled:opacity-60"
        >
          + Agregar concepto
        </button>
      </div>
      {mutacionConcepto.isError && (
        <p role="alert" className="text-xs text-red-600">
          No se pudo agregar{mutacionConcepto.error instanceof Error ? `: ${mutacionConcepto.error.message}` : ''}.
        </p>
      )}

      {hayAprobado && !trabajo.recursoImagenUrl && !trabajo.recursoConceptoPdfUrl && (
        <div className="flex items-end gap-2 border-t border-gray-200 pt-3">
          <input
            type="text"
            placeholder="Imagen (freepik)"
            value={recursoImagenUrl}
            onChange={(event) => setRecursoImagenUrl(event.target.value)}
            className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            placeholder="Concepto en PDF"
            value={recursoConceptoPdfUrl}
            onChange={(event) => setRecursoConceptoPdfUrl(event.target.value)}
            className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => mutacionRecursos.mutate()}
            disabled={mutacionRecursos.isPending}
            className="shrink-0 rounded-md bg-tinta px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            Entregar recursos
          </button>
        </div>
      )}
    </div>
  );
}

function TarjetaDireccionCreativa({ trabajo }: { trabajo: TrabajoLiderCreativo }) {
  const etapa = calcularEtapa(trabajo);
  const info = ETAPA_INFO[etapa];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{trabajo.autorNombre}</p>
          <p className="text-xs text-gray-500">#{trabajo.proyectoCodigo}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${info.badge}`}>{info.etiqueta}</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-gray-400">Reunión</dt>
          <dd className="font-medium text-gray-800">{formatearFechaCorta(trabajo.fechaReunion)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Brief enviado</dt>
          <dd className="font-medium text-gray-800">{formatearFechaCorta(trabajo.fechaBriefEnviadoEspecialista)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Brief aprobado (autor)</dt>
          <dd className="font-medium text-gray-800">{formatearFechaCorta(trabajo.fechaBriefAprobadoAutor)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Cierre</dt>
          <dd className="font-medium text-gray-800">{formatearFechaCorta(trabajo.fechaCierre)}</dd>
        </div>
      </dl>

      {etapa === 'reunion_pendiente' && <FormularioReunion trabajo={trabajo} />}
      {etapa === 'brief_pendiente' && <FormularioBrief trabajo={trabajo} />}
      {(etapa === 'conceptos_pendientes' || etapa === 'esperando_terceros') && trabajo.fechaBriefAprobadoAutor && <SeccionConceptos trabajo={trabajo} />}
    </div>
  );
}

// "¿Qué necesita mi atención hoy?" (master prompt 5C §24) — rol
// lider_creativo, dedicado (antes compartía DisenadorHomePage.tsx con
// 'disenador', violando la separación de 5C §19; esa pantalla sigue
// existiendo tal cual para disenador, sin tocar).
export function MisDireccionesCreativasPage() {
  const trabajosQuery = useQuery({ queryKey: ['direcciones-creativas', 'mias'], queryFn: fetchMisDireccionesCreativas });
  const trabajos = [...(trabajosQuery.data?.trabajos ?? [])].sort((a, b) => ORDEN_ETAPA[calcularEtapa(a)] - ORDEN_ETAPA[calcularEtapa(b)]);

  const totales = trabajos.reduce<Record<Etapa, number>>(
    (acc, trabajo) => {
      const etapa = calcularEtapa(trabajo);
      acc[etapa] += 1;
      return acc;
    },
    { reunion_pendiente: 0, brief_pendiente: 0, conceptos_pendientes: 0, esperando_terceros: 0, cerrado: 0 },
  );

  return (
    <div className={`${FULL_BLEED} ${ALTO_LLENO_MAIN} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden h-full w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="px-6 py-8">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-gray-500">Dirección Creativa</p>
          <nav className="space-y-2">
            <span className="flex w-full items-center gap-3 rounded-xl border border-dorado/20 bg-dorado/10 px-4 py-3 text-left text-sm font-semibold text-dorado">
              <span className="h-1.5 w-1.5 rounded-full bg-dorado" />
              Mis Direcciones Creativas
            </span>
          </nav>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#F4F5F8]">
        <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col p-6">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <span className="h-2 w-2 rounded-full bg-dorado" /> ¿Qué necesita mi atención hoy?
          </h2>

          {trabajosQuery.isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-tinta/70">Cargando tus direcciones creativas…</p>
            </div>
          )}

          {trabajosQuery.isError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              No se pudieron cargar tus direcciones creativas
              {trabajosQuery.error instanceof Error ? `: ${trabajosQuery.error.message}` : ''}.
            </p>
          )}

          {trabajosQuery.data && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-2xl font-bold text-red-600">{totales.reunion_pendiente}</p>
                  <p className="text-xs font-medium text-gray-500">Reunión pendiente</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-2xl font-bold text-amber-600">{totales.brief_pendiente}</p>
                  <p className="text-xs font-medium text-gray-500">Brief pendiente</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-2xl font-bold text-dorado">{totales.conceptos_pendientes}</p>
                  <p className="text-xs font-medium text-gray-500">Conceptos por entregar</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <p className="text-2xl font-bold text-blue-600">{totales.esperando_terceros}</p>
                  <p className="text-xs font-medium text-gray-500">Esperando terceros</p>
                </div>
              </div>

              {trabajos.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white">
                  <p className="text-sm text-gray-500">No tienes direcciones creativas asignadas todavía.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {trabajos.map((trabajo) => (
                    <TarjetaDireccionCreativa key={trabajo.id} trabajo={trabajo} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
