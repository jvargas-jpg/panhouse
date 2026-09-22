import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal } from '../autores/Modal';
import { formatearFecha } from '../proyectos/campos';
import type { RegistroSeguimiento } from '../types/api';
import { RegistroSeguimientoForm } from './RegistroSeguimientoForm';
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

function BadgePago({ activo, etiqueta }: { activo: boolean; etiqueta: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        activo ? 'bg-dorado/20 text-tinta' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {etiqueta}
    </span>
  );
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

const COLUMNAS = [
  'Proyecto/Autor',
  'Unidad',
  'Asignación',
  'Especialista',
  'Páginas',
  'Recibido',
  'Inicio',
  'Entrega',
  'Analista',
  'Tipo servicio',
  'Estatus',
  'Tiempo',
  'Pagos',
  'Obs.',
  '',
];

function FilaRegistro({ registro, onEditar }: { registro: RegistroSeguimiento; onEditar: () => void }) {
  return (
    <tr className="border-b border-gray-100 text-sm text-gray-700 transition-colors last:border-0 hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">
        {registro.proyecto.autorNombre}
        <span className="ml-1.5 font-normal text-gray-400">#{registro.proyecto.codigo}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3">{registro.proyecto.unidadNombre ?? <span className="text-gray-400">—</span>}</td>
      <td className="whitespace-nowrap px-4 py-3">{registro.asignacionTipo ?? <span className="text-gray-400">—</span>}</td>
      <td className="whitespace-nowrap px-4 py-3">{registro.especialista?.nombre ?? <span className="text-gray-400">Sin asignar</span>}</td>
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
      <td className="whitespace-nowrap px-4 py-3">{registro.tipoServicio ?? <span className="text-gray-400">—</span>}</td>
      <td className="whitespace-nowrap px-4 py-3">
        <BadgeEstatus estatus={registro.estatus} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {registro.totalDias ?? '—'}d / {registro.totalHoras ?? '—'}h
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <BadgePago activo={registro.freelance} etiqueta="Freelance" />
          <BadgePago activo={registro.pago80} etiqueta="80%" />
          <BadgePago activo={registro.pago20} etiqueta="20%" />
        </div>
      </td>
      <td className="max-w-[220px] truncate px-4 py-3 text-gray-500" title={registro.observaciones ?? undefined}>
        {registro.observaciones ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <button onClick={onEditar} className="text-xs font-medium text-tinta/70 underline hover:text-tinta">
          Editar
        </button>
      </td>
    </tr>
  );
}

// "Control de Tiempos": matriz de rendimiento de jefe_area, trasladada
// del Excel "Seguimiento Corrección" real. Crear/editar ya está
// conectado al backend (ver seguimiento.routes.ts) — el modal "+ Nuevo
// Registro" dejó de ser un stub.
export function SeguimientoPage() {
  const query = useQuery({ queryKey: ['seguimiento'], queryFn: fetchSeguimiento });
  const [registroEnEdicion, setRegistroEnEdicion] = useState<RegistroSeguimiento | null>(null);
  const [modalNuevoAbierto, setModalNuevoAbierto] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1600px] overflow-x-auto p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <span className="h-2 w-2 rounded-full bg-dorado" /> Control de Tiempos y Producción
        </h2>
        <button
          onClick={() => setModalNuevoAbierto(true)}
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
        <div className="min-w-[1600px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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
                <FilaRegistro key={registro.id} registro={registro} onEditar={() => setRegistroEnEdicion(registro)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalNuevoAbierto && (
        <Modal titulo="Nuevo Registro de Seguimiento" onClose={() => setModalNuevoAbierto(false)} ancho="3xl">
          <RegistroSeguimientoForm registro={null} onGuardado={() => setModalNuevoAbierto(false)} onCancelar={() => setModalNuevoAbierto(false)} />
        </Modal>
      )}

      {registroEnEdicion && (
        <Modal titulo="Editar Registro de Seguimiento" onClose={() => setRegistroEnEdicion(null)} ancho="3xl">
          <RegistroSeguimientoForm
            registro={registroEnEdicion}
            onGuardado={() => setRegistroEnEdicion(null)}
            onCancelar={() => setRegistroEnEdicion(null)}
          />
        </Modal>
      )}
    </div>
  );
}
