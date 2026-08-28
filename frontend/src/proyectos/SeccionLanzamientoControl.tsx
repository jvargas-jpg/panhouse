import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { BadgeEstatus, CampoResumen, formatearFecha, INPUT_CLASS, LABEL_CLASS } from './campos';
import type { FichaCompleta } from '../types/api';
import { actualizarSeccionLanzamientoControl } from './proyectoDetalleApi';

const ESTATUS_OPCIONES = ['Pendiente', 'Tramitando ISBN', 'Subiendo a Amazon', 'Publicado'] as const;

// Sección 7 (parte 3) — Lanzamiento, estatus agregado (macro). Coexiste
// con el nivel de satisfacción y las reuniones puntuales (ver
// SeccionLanzamiento.tsx, montado justo debajo de este panel) — no las
// reemplaza, mismo criterio que SeccionCalidadControl.tsx/
// SeccionDigitalControl.tsx.
//
// Dueño doble: el especialista dueño del proyecto o el responsable de
// lanzamiento asignado — puedeEditar ya viene resuelto desde
// ProyectoDetallePage.tsx (ahí sí hace falta el id del usuario
// logueado, no solo el rol).
export function SeccionLanzamientoControl({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [estatus, setEstatus] = useState(ficha.lanzamientoEstatus ?? '');
  const [fechaInicio, setFechaInicio] = useState(ficha.lanzamientoFechaInicio ?? '');
  const [fechaEntrega, setFechaEntrega] = useState(ficha.lanzamientoFechaEntrega ?? '');
  const [totalDias, setTotalDias] = useState(ficha.lanzamientoTotalDias ?? '');
  const [observaciones, setObservaciones] = useState(ficha.lanzamientoObservaciones ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionLanzamientoControl(proyectoId, {
        lanzamientoEstatus: estatus || null,
        lanzamientoFechaInicio: fechaInicio || null,
        lanzamientoFechaEntrega: fechaEntrega || null,
        lanzamientoTotalDias: totalDias || null,
        lanzamientoObservaciones: observaciones || null,
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
        <h3 className="font-bold text-gray-900">Control de Lanzamiento y Publicación</h3>
        <BadgeEstatus estatus={ficha.lanzamientoEstatus} />
      </div>

      {!puedeEditar && (
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <CampoResumen etiqueta="Estatus" valor={ficha.lanzamientoEstatus} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Fecha de inicio" valor={formatearFecha(ficha.lanzamientoFechaInicio)} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Fecha de entrega" valor={formatearFecha(ficha.lanzamientoFechaEntrega)} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Días totales" valor={ficha.lanzamientoTotalDias} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Observaciones" valor={ficha.lanzamientoObservaciones} span="col-span-12" />
        </div>
      )}

      {puedeEditar && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <div className="col-span-12 md:col-span-4">
            <label htmlFor="lanzamiento-control-estatus" className={LABEL_CLASS}>
              Estatus
            </label>
            <select
              id="lanzamiento-control-estatus"
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
            <label htmlFor="lanzamiento-control-fecha-inicio" className={LABEL_CLASS}>
              Fecha de inicio
            </label>
            <input
              id="lanzamiento-control-fecha-inicio"
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
            <label htmlFor="lanzamiento-control-fecha-entrega" className={LABEL_CLASS}>
              Fecha de entrega
            </label>
            <input
              id="lanzamiento-control-fecha-entrega"
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
            <label htmlFor="lanzamiento-control-total-dias" className={LABEL_CLASS}>
              Días totales
            </label>
            <input
              id="lanzamiento-control-total-dias"
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
            <label htmlFor="lanzamiento-control-observaciones" className={LABEL_CLASS}>
              Observaciones
            </label>
            <textarea
              id="lanzamiento-control-observaciones"
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
