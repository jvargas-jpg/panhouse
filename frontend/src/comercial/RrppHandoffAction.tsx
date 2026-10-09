import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../autores/Modal';
import { useMe } from '../auth/useAuth';
import { notificarRrpp } from '../jefatura/jefaturaApi';

// Única acción de handoff para ficha, listado e Inicio. Nunca guarda el formulario.
export function RrppHandoffAction({ proyectoId, disponible = true, disabled = false, onEnviado }: {
  proyectoId: string; disponible?: boolean; disabled?: boolean; onEnviado?: () => void;
}) {
  const { data: usuario } = useMe();
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const enviando = useRef(false);
  const refrescar = () => Promise.all([
    ['proyecto', proyectoId], ['ficha', proyectoId], ['proyectos'],
    ['fichas-trazabilidad'], ['metricas', 'comercial'], ['notificaciones'],
  ].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  const envio = useMutation({
    mutationFn: () => notificarRrpp(proyectoId),
    onSuccess: async () => { await refrescar(); setAbierto(false); onEnviado?.(); },
    onError: async () => { await refrescar(); },
    onSettled: () => { enviando.current = false; },
  });
  function confirmar() {
    if (!disponible || disabled || enviando.current || envio.isSuccess) return;
    enviando.current = true;
    envio.mutate();
  }
  if (usuario?.rol !== 'comercial') return null;
  return <>
    {disponible && (envio.isSuccess ? <span role="status" className="text-xs font-medium text-green-700">Proyecto enviado a RRPP.</span> : <button type="button" disabled={disabled || envio.isPending} onClick={() => { envio.reset(); setAbierto(true); }} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-dorado px-3 py-2 text-xs font-semibold text-tinta transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:opacity-60">{envio.isPending ? 'Enviando…' : 'Enviar a RRPP'}</button>)}
    {abierto && createPortal(<Modal titulo="Enviar proyecto a RRPP" onClose={() => { if (!envio.isPending) setAbierto(false); }}>
      <div className="overflow-y-auto p-6 text-sm leading-6 text-gray-600">
        <p>RRPP recibirá este proyecto para completar el diagnóstico inicial y la información correspondiente a su área.</p>
        <p className="mt-3">El proyecto seguirá disponible para consulta desde Comercial.</p>
        {(!disponible || disabled) && <p role="alert" className="mt-4 text-amber-800">Guarda los cambios y espera a que la ficha esté lista antes de enviar.</p>}
        {envio.isError && <p role="alert" className="mt-4 text-red-700">{envio.error instanceof Error ? envio.error.message : 'No se pudo enviar. Inténtalo nuevamente.'}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 px-6 py-4">
        <button type="button" disabled={envio.isPending} onClick={() => setAbierto(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">Cancelar</button>
        <button type="button" disabled={!disponible || disabled || envio.isPending || envio.isSuccess} onClick={confirmar} className="rounded-lg bg-dorado px-4 py-2 text-sm font-semibold text-tinta hover:brightness-95 disabled:opacity-60">{envio.isPending ? 'Enviando…' : 'Confirmar envío'}</button>
      </div>
    </Modal>, document.body)}
  </>;
}
