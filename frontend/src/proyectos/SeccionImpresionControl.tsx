import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { BadgeEstatus, CampoResumen, formatearFecha, INPUT_CLASS, LABEL_CLASS } from './campos';
import type { FichaCompleta } from '../types/api';
import { actualizarSeccionImpresion } from './proyectoDetalleApi';

const ESTATUS_OPCIONES = ['Pendiente', 'En imprenta', 'Control de calidad físico', 'Completado'] as const;

// Sección 8 (parte 2) — Impresión, estatus agregado (macro). Coexiste
// con la solicitud de cotización puntual (ver SeccionImpresion.tsx,
// montado justo debajo de este panel) — no la reemplaza, mismo criterio
// que SeccionCalidadControl.tsx/SeccionDigitalControl.tsx/
// SeccionLanzamientoControl.tsx/SeccionDistribucionControl.tsx.
//
// Sin dueño individual: no existe impresionId en proyectos, así que
// puedeEditar es solo por rol (rrpp exclusivamente) — mismo alcance que
// el resto de esta sección, sin necesidad de un puedeEditarControl
// separado en ProyectoDetallePage.tsx. Calidad/Digital/Lanzamiento/
// Distribución siguen ahora este mismo patrón (perdieron su columna de
// dueño individual en una ronda posterior).
export function SeccionImpresionControl({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [estatus, setEstatus] = useState(ficha.impresionEstatus ?? '');
  const [fechaInicio, setFechaInicio] = useState(ficha.impresionFechaInicio ?? '');
  const [fechaEntrega, setFechaEntrega] = useState(ficha.impresionFechaEntrega ?? '');
  const [totalDias, setTotalDias] = useState(ficha.impresionTotalDias ?? '');
  const [observaciones, setObservaciones] = useState(ficha.impresionObservaciones ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionImpresion(proyectoId, {
        impresionEstatus: estatus || null,
        impresionFechaInicio: fechaInicio || null,
        impresionFechaEntrega: fechaEntrega || null,
        impresionTotalDias: totalDias || null,
        impresionObservaciones: observaciones || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="mb-8 rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
        <h3 className="font-bold text-gray-900">Control de Impresión</h3>
        <BadgeEstatus estatus={ficha.impresionEstatus} />
      </div>

      {!puedeEditar && (
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <CampoResumen etiqueta="Estatus" valor={ficha.impresionEstatus} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Fecha de inicio" valor={formatearFecha(ficha.impresionFechaInicio)} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Fecha de entrega" valor={formatearFecha(ficha.impresionFechaEntrega)} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Días totales" valor={ficha.impresionTotalDias} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Observaciones" valor={ficha.impresionObservaciones} span="col-span-12" />
        </div>
      )}

      {puedeEditar && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <div className="col-span-12 md:col-span-4">
            <label htmlFor="impresion-control-estatus" className={LABEL_CLASS}>
              Estatus
            </label>
            <select
              id="impresion-control-estatus"
              value={estatus}
              onChange={(event) => {
                setEstatus(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            >
              <option value="">Sin definir</option>
              {ESTATUS_OPCIONES.map((opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-4">
            <label htmlFor="impresion-control-fecha-inicio" className={LABEL_CLASS}>
              Fecha de inicio
            </label>
            <input
              id="impresion-control-fecha-inicio"
              type="date"
              value={fechaInicio}
              onChange={(event) => {
                setFechaInicio(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label htmlFor="impresion-control-fecha-entrega" className={LABEL_CLASS}>
              Fecha de entrega
            </label>
            <input
              id="impresion-control-fecha-entrega"
              type="date"
              value={fechaEntrega}
              onChange={(event) => {
                setFechaEntrega(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label htmlFor="impresion-control-total-dias" className={LABEL_CLASS}>
              Días totales
            </label>
            <input
              id="impresion-control-total-dias"
              type="number"
              step="0.01"
              min="0"
              value={totalDias}
              onChange={(event) => {
                setTotalDias(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12">
            <label htmlFor="impresion-control-observaciones" className={LABEL_CLASS}>
              Observaciones
            </label>
            <textarea
              id="impresion-control-observaciones"
              rows={3}
              value={observaciones}
              onChange={(event) => {
                setObservaciones(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12 flex items-center gap-3">
            <button
              type="submit"
              disabled={mutacion.isPending}
              className="rounded-lg bg-tinta px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-gray-800 disabled:opacity-60"
            >
              {mutacion.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            {mutacion.isSuccess && <span className="text-sm text-green-600">Guardado ✓</span>}
            {mutacion.isError && (
              <span role="alert" className="text-sm text-red-600">
                No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
              </span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
