import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { hoyISO } from '../proyectos/campos';
import { fetchMisCorrecciones, marcarInicioCorreccion, registrarEntregaCorreccion } from '../proyectos/correccionesApi';
import type { EstadoPlazoCorreccion, TrabajoCorrector } from '../types/api';

// Mismo breakout de ancho completo que MisTrabajosEdicionPage.tsx
// (editor) — ver ese archivo para la explicación del truco contra el
// <main> centrado de AppLayout.tsx.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';
const ALTO_LLENO_MAIN = 'h-[calc(100%+3rem)]';

const ETIQUETA_ALCANCE: Record<string, string> = {
  tripa_completa: 'Tripa Completa',
  preliminares: 'Preliminares',
  cubierta_extendida: 'Cubierta Extendida',
};

const PLAZO_INFO: Record<EstadoPlazoCorreccion, { etiqueta: string; dot: string; badge: string }> = {
  vencido: { etiqueta: 'Vencido', dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
  proximo_a_vencer: { etiqueta: 'Próximo a vencer', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800' },
  en_tiempo: { etiqueta: 'En tiempo', dot: 'bg-green-500', badge: 'bg-green-100 text-green-800' },
};

function formatearFechaCorta(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es');
}

// dueAt es timestamp completo (checkpoint 5B §0.1 — SLAs de 12h, no
// solo de días enteros) — ver el mismo comentario en
// SeccionCorreccionOperativa.tsx.
function formatearFechaHora(fechaHora: string | null): string {
  if (!fechaHora) return '—';
  return new Date(fechaHora).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
}

// Prioridad: vencido primero, luego próximo a vencer, luego en tiempo
// sin entregar, luego entregadas — misma intención que ORDEN_PRIORIDAD
// de listarTrabajosEditor (capitulos.ts), pero acá no hace falta
// resolverlo en el backend: "Mis Correcciones" es una lista corta por
// corrector, no un listado masivo.
function ordenPrioridad(trabajo: TrabajoCorrector): number {
  if (trabajo.estado === 'completado') return 3;
  if (trabajo.plazo === 'vencido') return 0;
  if (trabajo.plazo === 'proximo_a_vencer') return 1;
  return 2;
}

function AccionesEntrega({ trabajo }: { trabajo: TrabajoCorrector }) {
  const [fecha, setFecha] = useState(hoyISO());
  const [controlCambiosUrl, setControlCambiosUrl] = useState('');
  const [informeTecnicoUrl, setInformeTecnicoUrl] = useState('');
  const queryClient = useQueryClient();

  const inicioMutacion = useMutation({
    mutationFn: () => marcarInicioCorreccion(trabajo.id, fecha),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['correcciones', 'mias'] }),
  });

  const entregaMutacion = useMutation({
    mutationFn: () =>
      registrarEntregaCorreccion(trabajo.id, { fecha, controlCambiosUrl: controlCambiosUrl || null, informeTecnicoUrl: informeTecnicoUrl || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['correcciones', 'mias'] }),
  });

  if (!trabajo.fechaInicio) {
    return (
      <div className="mt-3 flex items-end gap-2">
        <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm" />
        <button
          type="button"
          onClick={() => inicioMutacion.mutate()}
          disabled={inicioMutacion.isPending}
          className="rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-tinta hover:brightness-95 disabled:opacity-60"
        >
          Marcar inicio
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
      <div className="flex gap-2">
        <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm" />
        <input
          type="text"
          placeholder="Enlace control de cambios"
          value={controlCambiosUrl}
          onChange={(event) => setControlCambiosUrl(event.target.value)}
          className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        />
      </div>
      <input
        type="text"
        placeholder="Enlace informe técnico"
        value={informeTecnicoUrl}
        onChange={(event) => setInformeTecnicoUrl(event.target.value)}
        className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={() => entregaMutacion.mutate()}
        disabled={entregaMutacion.isPending}
        className="self-start rounded-md bg-tinta px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {entregaMutacion.isPending ? 'Guardando…' : 'Registrar entrega'}
      </button>
    </div>
  );
}

function FilaCorreccion({ trabajo }: { trabajo: TrabajoCorrector }) {
  const plazoInfo = trabajo.plazo ? PLAZO_INFO[trabajo.plazo] : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{trabajo.autorNombre}</p>
          <p className="text-xs text-gray-500">
            #{trabajo.proyectoCodigo} · {trabajo.servicioCodigo} · {ETIQUETA_ALCANCE[trabajo.alcance] ?? trabajo.alcance}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {trabajo.estado === 'completado' ? (
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">Entregada</span>
          ) : (
            plazoInfo && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${plazoInfo.badge}`}>{plazoInfo.etiqueta}</span>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-gray-400">Asignada</dt>
          <dd className="font-medium text-gray-800">{formatearFechaCorta(trabajo.fechaAsignada)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Vence</dt>
          <dd className="font-medium text-gray-800">{formatearFechaHora(trabajo.dueAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Inicio</dt>
          <dd className="font-medium text-gray-800">{formatearFechaCorta(trabajo.fechaInicio)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Entrega</dt>
          <dd className="font-medium text-gray-800">{formatearFechaCorta(trabajo.fechaEntrega)}</dd>
        </div>
      </dl>

      {trabajo.estado !== 'completado' && <AccionesEntrega trabajo={trabajo} />}
    </div>
  );
}

// "Mis Correcciones" (Fase 5, 5B) — bandeja de entrada del corrector
// INTERNO (con cuenta de sistema, ver rol 'corrector'). Responde las
// preguntas del master prompt §19: qué corregir, qué vence primero, qué
// está atrasado, qué ya se entregó — todo resuelto/priorizado acá, sin
// recalcular SLA en React (plazo ya viene del backend).
export function MisCorreccionesPage() {
  const trabajosQuery = useQuery({ queryKey: ['correcciones', 'mias'], queryFn: fetchMisCorrecciones });
  const trabajos = [...(trabajosQuery.data?.trabajos ?? [])].sort((a, b) => ordenPrioridad(a) - ordenPrioridad(b));

  return (
    <div className={`${FULL_BLEED} ${ALTO_LLENO_MAIN} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden h-full w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="px-6 py-8">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-gray-500">Panel de Corrección</p>
          <nav className="space-y-2">
            <span className="flex w-full items-center gap-3 rounded-xl border border-dorado/20 bg-dorado/10 px-4 py-3 text-left text-sm font-semibold text-dorado">
              <span className="h-1.5 w-1.5 rounded-full bg-dorado" />
              Mis Correcciones
            </span>
          </nav>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#F4F5F8]">
        <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col p-6">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <span className="h-2 w-2 rounded-full bg-dorado" /> Mis Correcciones
          </h2>

          {trabajosQuery.isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-tinta/70">Cargando tus correcciones…</p>
            </div>
          )}

          {trabajosQuery.isError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              No se pudieron cargar tus correcciones
              {trabajosQuery.error instanceof Error ? `: ${trabajosQuery.error.message}` : ''}.
            </p>
          )}

          {trabajosQuery.data && trabajos.length === 0 && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white">
              <p className="text-sm text-gray-500">No tienes correcciones asignadas todavía.</p>
            </div>
          )}

          {trabajos.length > 0 && (
            <div className="flex flex-col gap-3">
              {trabajos.map((trabajo) => (
                <FilaCorreccion key={trabajo.id} trabajo={trabajo} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
