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
  const [feedback,setFeedback]=useState<Record<string,string>>({});
  const feedbackMutation=useMutation({mutationFn:(id:string)=>registrarConceptoAutor(id,{feedback:feedback[id]?.trim()}),onSuccess:()=>{void queryClient.invalidateQueries({queryKey:['direccion-creativa',direccion.id,'propuestas']});}});

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

          {propuesta.enlace&&<a href={propuesta.enlace} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-dorado underline">Consultar concepto de portada ↗</a>}
          {(propuesta.feedbackAutor||propuesta.feedbackRrpp)&&<p className="mt-2 text-xs text-amber-800">{propuesta.feedbackAutor??propuesta.feedbackRrpp}</p>}
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
          {propuesta.fechaEnviadaAutor&&!propuesta.fechaAprobadaAutor&&<div className="mt-3 grid gap-2"><label className="text-xs text-tinta/70">Feedback del autor<textarea aria-label="Feedback del autor sobre el concepto" className="mt-1 w-full rounded border p-2" value={feedback[propuesta.id]??''} onChange={e=>setFeedback(v=>({...v,[propuesta.id]:e.target.value}))}/></label><button type="button" className="fv-button" disabled={!feedback[propuesta.id]?.trim()||feedbackMutation.isPending} onClick={()=>feedbackMutation.mutate(propuesta.id)}>Enviar ajustes al Líder Creativo</button>{feedbackMutation.isError&&<p role="alert">{feedbackMutation.error.message}</p>}</div>}
        </div>
      ))}
    </div>
  );
}

function TarjetaDireccionCreativa({ proyectoId, direccion }: { proyectoId: string; direccion: DireccionCreativa }) {
  const queryClient = useQueryClient();
  const [fechaBriefEnviado, setFechaBriefEnviado] = useState('');
  const [fechaBriefAprobado, setFechaBriefAprobado] = useState('');
  const [briefFeedback,setBriefFeedback]=useState('');
  const feedbackMutation=useMutation({mutationFn:()=>registrarBriefAutor(direccion.id,{feedback:briefFeedback.trim()}),onSuccess:()=>{setBriefFeedback('');void queryClient.invalidateQueries({queryKey:['direcciones-creativas',proyectoId]});}});

  const mutacionBriefAutor = useMutation({
    mutationFn: () =>
      registrarBriefAutor(direccion.id, {
        fechaBriefEnviadoAutor: fechaBriefEnviado || undefined,
        fechaBriefAprobadoAutor: fechaBriefAprobado || undefined,
      }),
    onSuccess: () => {for(const key of [['direcciones-creativas',proyectoId],['solicitudes'],['solicitud'],['mi-trabajo'],['especialista-inicio'],['creative-leader'],['proyecto']])void queryClient.invalidateQueries({queryKey:key});},
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

      {direccion.briefEnlace&&direccion.fechaBriefEnviadoAutor&&!direccion.fechaBriefAprobadoAutor&&<div className="my-3 grid gap-2"><label className="text-xs text-tinta/70">Feedback del autor sobre el brief<textarea className="mt-1 w-full rounded border p-2" value={briefFeedback} onChange={e=>setBriefFeedback(e.target.value)}/></label><button type="button" className="fv-button" disabled={!briefFeedback.trim()||feedbackMutation.isPending} onClick={()=>feedbackMutation.mutate()}>Solicitar ajustes al brief</button>{feedbackMutation.isError&&<p role="alert">{feedbackMutation.error.message}</p>}</div>}
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
        {puedeOperar && direcciones.length === 0 && !query.data?.solicitud && (
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

        {query.data && direcciones.length === 0 && !query.data.solicitud && (
          <p className="text-sm text-gray-500">Todavía no se solicitó Dirección Creativa para este proyecto.</p>
        )}

        {query.data?.solicitud&&direcciones.length===0&&<div className="rounded-lg bg-amber-50 p-4 text-sm"><strong>{query.data.solicitud.estado==='rechazada'?'Solicitud creativa rechazada':'Solicitud creativa pendiente de aceptación'}</strong><p>{query.data.solicitud.motivo??'El Líder Creativo revisará la entrada antes de iniciar el trabajo.'}</p></div>}
        {direcciones.map((direccion) => (
          <TarjetaDireccionCreativa key={direccion.id} proyectoId={proyectoId} direccion={direccion} />
        ))}
      </div>
    </div>
  );
}
