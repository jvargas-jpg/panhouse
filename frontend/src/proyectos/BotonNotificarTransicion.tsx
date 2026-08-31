import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Toast } from '../autores/Toast';

// Generalizado desde el antiguo BotonNotificarJefatura.tsx (un solo
// tramo) para servir a los dos pasos de la cascada de Fase 1 (Inicio):
// comercial → rrpp (POST /:id/notificar-rrpp) y rrpp → jefe_area
// (POST /:id/notificar-jefatura) — misma mecánica de confirmación +
// mutación + toast, solo cambian etiqueta, mensajes y qué bandera de
// idempotencia trae el proyecto ya cargado (notificadoRrpp o
// notificadoJefatura, ver ProyectoDetallePage.tsx).
//
// notificado arranca desde notificadoInicial (el proyecto ya cargado):
// si la página se recarga después de haber notificado, el botón nace
// deshabilitado sin depender de que la mutación haya corrido en esta
// misma sesión.
export function BotonNotificarTransicion({
  proyectoId,
  notificadoInicial,
  etiqueta,
  mensajeConfirmacion,
  mensajeToast,
  mutationFn,
}: {
  proyectoId: string;
  notificadoInicial: boolean;
  etiqueta: string;
  mensajeConfirmacion: string;
  mensajeToast: string;
  mutationFn: (proyectoId: string) => Promise<{ ok: true }>;
}) {
  const queryClient = useQueryClient();
  const [notificado, setNotificado] = useState(notificadoInicial);
  const [toastVisible, setToastVisible] = useState(false);

  const mutacion = useMutation({
    mutationFn: () => mutationFn(proyectoId),
    onSuccess: () => {
      setNotificado(true);
      setToastVisible(true);
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      setTimeout(() => setToastVisible(false), 3000);
    },
  });

  function handleClick() {
    if (!window.confirm(mensajeConfirmacion)) return;
    mutacion.mutate();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={notificado || mutacion.isPending}
        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {notificado ? 'Notificado' : mutacion.isPending ? 'Enviando…' : etiqueta}
      </button>
      {mutacion.isError && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          No se pudo notificar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
        </p>
      )}
      {toastVisible && <Toast mensaje={mensajeToast} />}
    </div>
  );
}
