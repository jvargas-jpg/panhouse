import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal } from '../autores/Modal';
import { formatearFecha } from '../proyectos/campos';
import type { RegistroSeguimiento } from '../types/api';
import { fetchSeguimiento } from './seguimientoApi';

function formatearHora(hora: string | null): string {
  if (!hora) return '—';
  return hora.slice(0, 5);
}

function BadgeEstatus({ estatus }: { estatus: string | null }) {
  if (!estatus) {
    return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">Sin estatus</span>;
  }

  const normalizado = estatus.toLowerCase();
  if (normalizado.includes('entregado')) {
    return <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">{estatus}</span>;
  }
  if (normalizado.includes('proceso')) {
    return <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700">{estatus}</span>;
  }
  return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{estatus}</span>;
}

function FechaHora({ fecha, hora }: { fecha: string | null; hora: string | null }) {
  if (!fecha) return <span className="text-gray-400">—</span>;
  return (
    <span>
      {formatearFecha(fecha)}
      {hora && <span className="ml-1 text-gray-400">· {formatearHora(hora)}</span>}
    </span>
  );
}

const COLUMNAS = ['Proyecto/Autor', 'Tipo Asignación', 'Páginas', 'Recibido', 'Inicio', 'Entrega', 'Analista', 'Estatus', 'Tiempo', 'Obs.'];

function FilaRegistro({ registro }: { registro: RegistroSeguimiento }) {
  return (
    <tr className="border-b border-gray-100 text-sm text-gray-700 transition-colors last:border-0 hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{registro.proyecto.autorNombre}</td>
      <td className="whitespace-nowrap px-4 py-3">{registro.asignacionTipo ?? <span className="text-gray-400">—</span>}</td>
      <td className="whitespace-nowrap px-4 py-3">{registro.paginas ?? <span className="text-gray-400">—</span>}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <FechaHora fecha={registro.fechaAsignada} hora={registro.horaRecibida} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <FechaHora fecha={registro.fechaInicio} hora={registro.horaInicio} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <FechaHora fecha={registro.fechaEntrega} hora={registro.horaEntrega} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">{registro.analista?.nombre ?? <span className="text-gray-400">Sin asignar</span>}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <BadgeEstatus estatus={registro.estatus} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {registro.totalDias ?? '—'}d / {registro.totalHoras ?? '—'}h
      </td>
      <td className="max-w-[220px] truncate px-4 py-3 text-gray-500" title={registro.observaciones ?? undefined}>
        {registro.observaciones ?? <span className="text-gray-400">—</span>}
      </td>
    </tr>
  );
}

// "Control de Tiempos": matriz de rendimiento de jefe_area, trasladada
// del Excel "Seguimiento Corrección" real. Solo lectura por ahora (ver
// Restricción del pedido original) — "+ Nuevo Registro" es un modal
// vacío a propósito, no hay todavía una ruta de creación en el backend.
export function SeguimientoPage() {
  const query = useQuery({ queryKey: ['seguimiento'], queryFn: fetchSeguimiento });
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1600px] overflow-x-auto p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <span className="h-2 w-2 rounded-full bg-dorado" /> Control de Tiempos y Producción
        </h2>
        <button
          onClick={() => {
            console.log('Nuevo registro de seguimiento (pendiente de backend de creación)');
            setModalNuevoAbierto(true);
          }}
          className="flex-shrink-0 rounded-lg bg-tinta px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
        >
          + Nuevo Registro
        </button>
      </div>

      {query.isLoading && <p className="text-sm text-tinta/70">Cargando matriz…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar la matriz{query.error instanceof Error ? `: ${query.error.message}` : ''}.
        </p>
      )}

      {query.data && query.data.registros.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-sm text-gray-500">Todavía no hay registros de seguimiento cargados.</p>
        </div>
      )}

      {query.data && query.data.registros.length > 0 && (
        <div className="min-w-[1200px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
              <tr>
                {COLUMNAS.map((columna) => (
                  <th key={columna} className="whitespace-nowrap px-4 py-3">
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data.registros.map((registro) => (
                <FilaRegistro key={registro.id} registro={registro} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalNuevoAbierto && (
        <Modal titulo="Nuevo Registro de Seguimiento" onClose={() => setModalNuevoAbierto(false)}>
          <p className="text-sm text-gray-500">
            Función en desarrollo — todavía no existe una ruta de backend para crear registros de seguimiento. Esta ventana valida el
            diseño del flujo mientras se define esa parte.
          </p>
        </Modal>
      )}
    </div>
  );
}
