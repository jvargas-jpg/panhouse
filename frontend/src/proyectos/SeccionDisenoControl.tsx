import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { BadgeEstatus, CampoResumen, formatearFecha, INPUT_CLASS, LABEL_CLASS } from './campos';
import type { FichaCompleta } from '../types/api';
import { actualizarSeccionDisenoControl } from './proyectoDetalleApi';

const ESTATUS_OPCIONES = ['Pendiente', 'Creando bocetos', 'En revisión por autor', 'Aprobado'] as const;

// Sección 4 (parte 2) — Diseño y Diagramación, estatus agregado
// (macro). Coexiste con el brief creativo y las propuestas de portada
// (ver SeccionDiseno.tsx, montado justo debajo de este panel) — no las
// reemplaza, mismo criterio que SeccionEdicion.tsx/SeccionCorreccionControl.tsx.
//
// Dueño doble: el especialista dueño del proyecto o el disenador
// asignado — puedeEditar ya viene resuelto desde ProyectoDetallePage.tsx
// (ahí sí hace falta el id del usuario logueado, no solo el rol).
export function SeccionDisenoControl({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [estatus, setEstatus] = useState(ficha.disenoEstatus ?? '');
  const [fechaInicio, setFechaInicio] = useState(ficha.disenoFechaInicio ?? '');
  const [fechaEntrega, setFechaEntrega] = useState(ficha.disenoFechaEntrega ?? '');
  const [totalDias, setTotalDias] = useState(ficha.disenoTotalDias ?? '');
  const [observaciones, setObservaciones] = useState(ficha.disenoObservaciones ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionDisenoControl(proyectoId, {
        disenoEstatus: estatus || null,
        disenoFechaInicio: fechaInicio || null,
        disenoFechaEntrega: fechaEntrega || null,
        disenoTotalDias: totalDias || null,
        disenoObservaciones: observaciones || null,
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
        <h3 className="font-bold text-gray-900">Control de Diseño y Diagramación</h3>
        <BadgeEstatus estatus={ficha.disenoEstatus} />
      </div>

      {!puedeEditar && (
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <CampoResumen etiqueta="Estatus" valor={ficha.disenoEstatus} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Fecha de inicio" valor={formatearFecha(ficha.disenoFechaInicio)} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Fecha de entrega" valor={formatearFecha(ficha.disenoFechaEntrega)} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Días totales" valor={ficha.disenoTotalDias} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Observaciones" valor={ficha.disenoObservaciones} span="col-span-12" />
        </div>
      )}

      {puedeEditar && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <div className="col-span-12 md:col-span-4">
            <label htmlFor="diseno-control-estatus" className={LABEL_CLASS}>
              Estatus
            </label>
            <select
              id="diseno-control-estatus"
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
            <label htmlFor="diseno-control-fecha-inicio" className={LABEL_CLASS}>
              Fecha de inicio
            </label>
            <input
              id="diseno-control-fecha-inicio"
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
            <label htmlFor="diseno-control-fecha-entrega" className={LABEL_CLASS}>
              Fecha de entrega
            </label>
            <input
              id="diseno-control-fecha-entrega"
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
            <label htmlFor="diseno-control-total-dias" className={LABEL_CLASS}>
              Días totales
            </label>
            <input
              id="diseno-control-total-dias"
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
            <label htmlFor="diseno-control-observaciones" className={LABEL_CLASS}>
              Observaciones
            </label>
            <textarea
              id="diseno-control-observaciones"
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
