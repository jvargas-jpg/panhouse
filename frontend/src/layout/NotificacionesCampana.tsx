import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notificacion } from '../types/api';
import { fetchNotificaciones, marcarNotificacionLeida } from './notificacionesApi';

// Sin WebSockets todavía — refetchInterval simula tiempo real con
// polling. 30s: frecuente para no sentirse desactualizado, sin
// convertirse en una petición por segundo entre todo el equipo logueado.
const INTERVALO_REFETCH_MS = 30_000;

function formatearFechaHora(fecha: string): string {
  return new Date(fecha).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function ItemNotificacion({ notificacion, onClick }: { notificacion: Notificacion; onClick: (notificacion: Notificacion) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(notificacion)}
      className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-gray-50 ${
        notificacion.leido ? '' : 'bg-dorado/5'
      }`}
    >
      <span
        className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${notificacion.leido ? 'bg-transparent' : 'bg-dorado'}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className={`text-sm leading-snug ${notificacion.leido ? 'text-gray-600' : 'font-medium text-gray-900'}`}>
          {notificacion.mensaje}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">{formatearFechaHora(notificacion.createdAt)}</p>
      </div>
    </button>
  );
}

// Campana global del layout (TopBar.tsx) — visible para cualquier rol
// autenticado: rolDestino es texto libre del lado del backend, no está
// atado a jefe_area (el único disparador de hoy), así que restringir el
// ícono por rol acá adelantaría una regla que el modelo de datos no
// impone. Reemplaza el ícono estático que ya existía en TopBar.tsx
// (punto rojo fijo, sin datos ni clic) por uno real.
export function NotificacionesCampana() {
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const notificacionesQuery = useQuery({
    queryKey: ['notificaciones'],
    queryFn: fetchNotificaciones,
    refetchInterval: INTERVALO_REFETCH_MS,
  });

  const mutacionLeer = useMutation({
    mutationFn: (id: string) => marcarNotificacionLeida(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    },
  });

  const notificaciones = notificacionesQuery.data?.notificaciones ?? [];
  const hayNoLeidas = notificaciones.some((notificacion) => !notificacion.leido);

  function handleClickNotificacion(notificacion: Notificacion) {
    if (!notificacion.leido) {
      mutacionLeer.mutate(notificacion.id);
    }
    setAbierto(false);
    if (notificacion.proyectoId) {
      navigate(`/proyectos/${notificacion.proyectoId}`);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        title="Notificaciones"
        onClick={() => setAbierto((valor) => !valor)}
        className="relative rounded-md p-2 text-tinta/60 transition hover:bg-tinta/5 hover:text-tinta"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {hayNoLeidas && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
      </button>

      {abierto && (
        <>
          {/* Backdrop transparente: clic afuera cierra el desplegable, sin
              un hook de "click outside" aparte. */}
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />

          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Notificaciones</h3>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notificacionesQuery.isLoading && <p className="px-4 py-6 text-center text-sm text-gray-400">Cargando…</p>}
              {notificacionesQuery.isError && (
                <p className="px-4 py-6 text-center text-sm text-red-600">No se pudieron cargar las notificaciones.</p>
              )}
              {notificacionesQuery.data && notificaciones.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-400">No tienes notificaciones.</p>
              )}
              {notificaciones.map((notificacion) => (
                <ItemNotificacion key={notificacion.id} notificacion={notificacion} onClick={handleClickNotificacion} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
