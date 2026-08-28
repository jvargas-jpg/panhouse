import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { BadgeEstatus, CampoResumen, formatearFecha, INPUT_CLASS, LABEL_CLASS } from './campos';
import type { FichaCompleta } from '../types/api';
import { actualizarSeccionEdicion } from './proyectoDetalleApi';

const ESTATUS_OPCIONES = ['Pendiente', 'En revisión por editor', 'En revisión por autor', 'Aprobado'] as const;

// Sección 2 — Edición de estilo, vista de conjunto (a cargo del
// especialista, mismo dueño que Corrección). Coexiste con el detalle
// por capítulo (ver el bloque "2. Edición" de ProyectoDetallePage.tsx,
// que sigue mostrando el conteo de capítulos con su propia sección más
// abajo en la página) — esto es el estatus agregado de la fase, no un
// reemplazo del seguimiento por capítulo.
//
// Patrón estándar de la app: sin permiso de edición se renderiza un
// resumen de solo lectura (no el formulario con inputs deshabilitados).
export function SeccionEdicion({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [estatus, setEstatus] = useState(ficha.edicionEstatus ?? '');
  const [fechaEnvioEditor, setFechaEnvioEditor] = useState(ficha.edicionFechaEnvioEditor ?? '');
  const [fechaRecepcionEditor, setFechaRecepcionEditor] = useState(ficha.edicionFechaRecepcionEditor ?? '');
  const [fechaEnvioAutor, setFechaEnvioAutor] = useState(ficha.edicionFechaEnvioAutor ?? '');
  const [fechaAprobacionAutor, setFechaAprobacionAutor] = useState(ficha.edicionFechaAprobacionAutor ?? '');
  const [observaciones, setObservaciones] = useState(ficha.edicionObservaciones ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionEdicion(proyectoId, {
        edicionEstatus: estatus || null,
        edicionFechaEnvioEditor: fechaEnvioEditor || null,
        edicionFechaRecepcionEditor: fechaRecepcionEditor || null,
        edicionFechaEnvioAutor: fechaEnvioAutor || null,
        edicionFechaAprobacionAutor: fechaAprobacionAutor || null,
        edicionObservaciones: observaciones || null,
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
    <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
        <h3 className="font-bold text-gray-900">Control de Edición de Estilo</h3>
        <BadgeEstatus estatus={ficha.edicionEstatus} />
      </div>

      {!puedeEditar && (
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <CampoResumen etiqueta="Estatus" valor={ficha.edicionEstatus} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Envío a editor" valor={formatearFecha(ficha.edicionFechaEnvioEditor)} span="col-span-12 md:col-span-4" />
          <CampoResumen
            etiqueta="Recepción de editor"
            valor={formatearFecha(ficha.edicionFechaRecepcionEditor)}
            span="col-span-12 md:col-span-4"
          />
          <CampoResumen etiqueta="Envío a autor" valor={formatearFecha(ficha.edicionFechaEnvioAutor)} span="col-span-12 md:col-span-4" />
          <CampoResumen
            etiqueta="Aprobación de autor"
            valor={formatearFecha(ficha.edicionFechaAprobacionAutor)}
            span="col-span-12 md:col-span-4"
          />
          <CampoResumen etiqueta="Observaciones" valor={ficha.edicionObservaciones} span="col-span-12" />
        </div>
      )}

      {puedeEditar && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <div className="col-span-12 md:col-span-4">
            <label htmlFor="edicion-estatus" className={LABEL_CLASS}>
              Estatus
            </label>
            <select
              id="edicion-estatus"
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
            <label htmlFor="edicion-envio-editor" className={LABEL_CLASS}>
              Envío a editor
            </label>
            <input
              id="edicion-envio-editor"
              type="date"
              value={fechaEnvioEditor}
              onChange={(event) => {
                setFechaEnvioEditor(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label htmlFor="edicion-recepcion-editor" className={LABEL_CLASS}>
              Recepción de editor
            </label>
            <input
              id="edicion-recepcion-editor"
              type="date"
              value={fechaRecepcionEditor}
              onChange={(event) => {
                setFechaRecepcionEditor(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label htmlFor="edicion-envio-autor" className={LABEL_CLASS}>
              Envío a autor
            </label>
            <input
              id="edicion-envio-autor"
              type="date"
              value={fechaEnvioAutor}
              onChange={(event) => {
                setFechaEnvioAutor(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label htmlFor="edicion-aprobacion-autor" className={LABEL_CLASS}>
              Aprobación de autor
            </label>
            <input
              id="edicion-aprobacion-autor"
              type="date"
              value={fechaAprobacionAutor}
              onChange={(event) => {
                setFechaAprobacionAutor(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12">
            <label htmlFor="edicion-observaciones" className={LABEL_CLASS}>
              Observaciones
            </label>
            <textarea
              id="edicion-observaciones"
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
