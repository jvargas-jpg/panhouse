import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { DireccionCreativa } from '../types/api';
import {
  cerrarDireccionCreativa,
  fetchDireccionesCreativasDeProyecto,
  fetchPropuestasDeDireccionCreativa,
  registrarBriefAutor,
  registrarConceptoAutor,
  solicitarDireccionCreativa,
} from './direccionCreativaApi';

function formatearFechaCorta(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es');
}

const ESTADO_ETIQUETA: Record<string, string> = {
  pendiente: 'Esperando asignación de líder creativo',
  en_progreso: 'En curso',
  completado: 'Cerrada',
};

function SeccionConceptosEspecialista({ direccion }: { direccion: DireccionCreativa }) {
  const propuestasQuery = useQuery({
    queryKey: ['direccion-creativa', direccion.id, 'propuestas'],
    queryFn: () => fetchPropuestasDeDireccionCreativa(direccion.id),
  });
  const queryClient = useQueryClient();
  const [fechasPorPropuesta, setFechasPorPropuesta] = useState<Record<string, string>>({});

  const mutacionEnvio = useMutation({
    mutationFn: (propuestaId: string) => registrarConceptoAutor(propuestaId, { fechaEnviadaAutor: fechasPorPropuesta[propuestaId] || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direccion-creativa', direccion.id, 'propuestas'] }),
  });

  const mutacionAprobacion = useMutation({
    mutationFn: (propuestaId: string) => registrarConceptoAutor(propuestaId, { fechaAprobadaAutor: fechasPorPropuesta[propuestaId] || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direccion-creativa', direccion.id, 'propuestas'] }),
  });

  if (!propuestasQuery.data || propuestasQuery.data.propuestas.length === 0) {
    return <p className="mt-3 text-xs text-gray-500">El líder creativo todavía no entregó conceptos de portada.</p>;
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {propuestasQuery.data.propuestas.map((propuesta) => (
        <div key={propuesta.id} className="rounded-lg bg-gray-50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-800">{propuesta.descripcion ?? 'Concepto sin descripción'}</span>
            {propuesta.fechaAprobadaAutor ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Aprobado por el autor</span>
            ) : propuesta.fechaAprobadaRrpp ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">RRPP aprobó</span>
            ) : (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">Esperando aprobación RRPP</span>
            )}
          </div>

          {propuesta.fechaAprobadaRrpp && !propuesta.fechaAprobadaAutor && (
            <div className="mt-2 flex items-end gap-2">
              <input
                type="date"
                value={fechasPorPropuesta[propuesta.id] ?? ''}
                onChange={(event) => setFechasPorPropuesta((prev) => ({ ...prev, [propuesta.id]: event.target.value }))}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs"
              />
              {!propuesta.fechaEnviadaAutor && (
                <button
                  type="button"
                  onClick={() => mutacionEnvio.mutate(propuesta.id)}
                  className="rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-tinta hover:brightness-95"
                >
                  Registrar envío al autor
                </button>
              )}
              {propuesta.fechaEnviadaAutor && (
                <button
                  type="button"
                  onClick={() => mutacionAprobacion.mutate(propuesta.id)}
                  className="rounded-md bg-tinta px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                >
                  Registrar aprobación del autor
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TarjetaDireccionCreativa({ proyectoId, direccion }: { proyectoId: string; direccion: DireccionCreativa }) {
  const queryClient = useQueryClient();
  const [fechaBriefEnviado, setFechaBriefEnviado] = useState('');
  const [fechaBriefAprobado, setFechaBriefAprobado] = useState('');

  const mutacionBriefAutor = useMutation({
    mutationFn: () =>
      registrarBriefAutor(direccion.id, {
        fechaBriefEnviadoAutor: fechaBriefEnviado || undefined,
        fechaBriefAprobadoAutor: fechaBriefAprobado || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones-creativas', proyectoId] }),
  });

  const mutacionCierre = useMutation({
    mutationFn: (resultadoFinal: 'aprobado' | 'rechazado') => cerrarDireccionCreativa(direccion.id, { resultadoFinal }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones-creativas', proyectoId] }),
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-gray-900">Concepto de portada</h4>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
          {ESTADO_ETIQUETA[direccion.estado] ?? direccion.estado}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-gray-400">Reunión</dt>
          <dd className="font-medium text-gray-800">{direccion.reunionRealizada ? formatearFechaCorta(direccion.fechaReunion) : 'Pendiente'}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Brief del líder creativo</dt>
          <dd className="font-medium text-gray-800">
            {direccion.briefEnlace ? (
              <a href={direccion.briefEnlace} target="_blank" rel="noreferrer" className="text-dorado underline">
                Ver brief
              </a>
            ) : (
              'Pendiente'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-gray-400">Brief aprobado (autor)</dt>
          <dd className="font-medium text-gray-800">{formatearFechaCorta(direccion.fechaBriefAprobadoAutor)}</dd>
        </div>
        <div>
          <dt className="text-gray-400">Cierre</dt>
          <dd className="font-medium text-gray-800">{formatearFechaCorta(direccion.fechaCierre)}</dd>
        </div>
      </dl>

      {direccion.briefEnlace && !direccion.fechaBriefAprobadoAutor && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Enviado al autor</label>
            <input
              type="date"
              value={fechaBriefEnviado}
              onChange={(event) => setFechaBriefEnviado(event.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Aprobado por el autor</label>
            <input
              type="date"
              value={fechaBriefAprobado}
              onChange={(event) => setFechaBriefAprobado(event.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => mutacionBriefAutor.mutate()}
            disabled={mutacionBriefAutor.isPending}
            className="rounded-md bg-dorado px-3 py-1.5 text-xs font-semibold text-tinta hover:brightness-95 disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      )}

      {direccion.fechaBriefAprobadoAutor && <SeccionConceptosEspecialista direccion={direccion} />}

      {(direccion.recursoImagenUrl || direccion.recursoConceptoPdfUrl) && (
        <div className="mt-3 flex gap-3 text-xs">
          {direccion.recursoImagenUrl && (
            <a href={direccion.recursoImagenUrl} target="_blank" rel="noreferrer" className="text-dorado underline">
              Imagen
            </a>
          )}
          {direccion.recursoConceptoPdfUrl && (
            <a href={direccion.recursoConceptoPdfUrl} target="_blank" rel="noreferrer" className="text-dorado underline">
              Concepto PDF
            </a>
          )}
        </div>
      )}

      {direccion.recursoImagenUrl && direccion.recursoConceptoPdfUrl && direccion.estado !== 'completado' && (
        <button
          type="button"
          onClick={() => mutacionCierre.mutate('aprobado')}
          disabled={mutacionCierre.isPending}
          className="mt-3 rounded-md bg-tinta px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
        >
          Cerrar Dirección Creativa
        </button>
      )}
    </div>
  );
}

// Pipeline operativo real de Dirección Creativa (Fase 5, 5C) —
// paralelo a SeccionDisenoBrief.tsx/SeccionDiseno.tsx (resumen macro de
// la ficha, sin tocar): acá vive la solicitud real con work_item/
// assignment/gates/audit, mismo criterio que SeccionCorreccionOperativa
// para 5B. Especialista solicita, ve el avance, y registra en nombre
// del Autor (sin Portal todavía, master prompt 5C §13).
export function SeccionDireccionCreativaOperativa({ proyectoId, puedeOperar }: { proyectoId: string; puedeOperar: boolean }) {
  const query = useQuery({ queryKey: ['direcciones-creativas', proyectoId], queryFn: () => fetchDireccionesCreativasDeProyecto(proyectoId) });
  const queryClient = useQueryClient();

  const mutacionSolicitar = useMutation({
    mutationFn: () => solicitarDireccionCreativa(proyectoId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['direcciones-creativas', proyectoId] }),
  });

  const direcciones = query.data?.direcciones ?? [];

  return (
    <div className="mb-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <span className="h-2 w-2 rounded-full bg-dorado" /> Dirección Creativa — Pipeline Operativo
        </h3>
        {puedeOperar && direcciones.length === 0 && (
          <button
            type="button"
            onClick={() => mutacionSolicitar.mutate()}
            disabled={mutacionSolicitar.isPending}
            className="text-sm font-medium text-dorado hover:underline disabled:opacity-60"
          >
            + Solicitar reunión creativa
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 p-6">
        {query.isLoading && <p className="text-sm text-gray-500">Cargando…</p>}
        {query.isError && (
          <p role="alert" className="text-sm text-red-600">
            No se pudo cargar{query.error instanceof Error ? `: ${query.error.message}` : ''}.
          </p>
        )}
        {mutacionSolicitar.isError && (
          <p role="alert" className="text-sm text-red-600">
            No se pudo solicitar{mutacionSolicitar.error instanceof Error ? `: ${mutacionSolicitar.error.message}` : ''}.
          </p>
        )}

        {query.data && direcciones.length === 0 && (
          <p className="text-sm text-gray-500">Todavía no se solicitó Dirección Creativa para este proyecto.</p>
        )}

        {direcciones.map((direccion) => (
          <TarjetaDireccionCreativa key={direccion.id} proyectoId={proyectoId} direccion={direccion} />
        ))}
      </div>
    </div>
  );
}
