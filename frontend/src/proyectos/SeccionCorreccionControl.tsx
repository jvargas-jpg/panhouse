import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { BadgeEstatus, CampoResumen, formatearFecha, INPUT_CLASS, LABEL_CLASS } from './campos';
import type { FichaCompleta } from '../types/api';
import { actualizarSeccionCorreccion } from './proyectoDetalleApi';

// Mismos valores que ya reconoce BadgeEstatus (campos.tsx) para
// colorear ("Entregado"/"En proceso" — los que aparecen en la matriz
// real de Seguimiento) más "Pendiente" como estado inicial. No hay una
// lista cerrada confirmada todavía, a diferencia de Edición.
const ESTATUS_OPCIONES = ['Pendiente', 'En proceso', 'Entregado'] as const;

// Sección 3 (parte 2) — Corrección, estatus agregado que conecta con la
// matriz de tiempos de jefatura (seguimiento_fases.ts / SeguimientoPage.tsx):
// tipo de asignación, fechas de envío/inicio/entrega y días totales, tal
// como aparecen en el Excel real. Coexiste con SeccionCorreccion.tsx
// (tripa/preliminares/cubierta con su propio aprobado por categoría,
// visible más abajo en el mismo paso del Stepper) — no lo reemplaza,
// mismo criterio que SeccionEdicion.tsx con el detalle por capítulo.
export function SeccionCorreccionControl({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [tipoAsignacion, setTipoAsignacion] = useState(ficha.correccionTipoAsignacion ?? '');
  const [estatus, setEstatus] = useState(ficha.correccionEstatus ?? '');
  const [fechaEnvio, setFechaEnvio] = useState(ficha.correccionFechaEnvio ?? '');
  const [fechaInicio, setFechaInicio] = useState(ficha.correccionFechaInicio ?? '');
  const [fechaEntrega, setFechaEntrega] = useState(ficha.correccionFechaEntrega ?? '');
  const [totalDias, setTotalDias] = useState(ficha.correccionTotalDias ?? '');
  const [observaciones, setObservaciones] = useState(ficha.correccionObservaciones ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionCorreccion(proyectoId, {
        correccionTipoAsignacion: tipoAsignacion || null,
        correccionEstatus: estatus || null,
        correccionFechaEnvio: fechaEnvio || null,
        correccionFechaInicio: fechaInicio || null,
        correccionFechaEntrega: fechaEntrega || null,
        correccionTotalDias: totalDias || null,
        correccionObservaciones: observaciones || null,
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
        <h3 className="font-bold text-gray-900">Control de Corrección Ortotipográfica</h3>
        <BadgeEstatus estatus={ficha.correccionEstatus} />
      </div>

      {!puedeEditar && (
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <CampoResumen etiqueta="Tipo de asignación" valor={ficha.correccionTipoAsignacion} span="col-span-12 md:col-span-6" />
          <CampoResumen etiqueta="Estatus" valor={ficha.correccionEstatus} span="col-span-12 md:col-span-6" />
          <CampoResumen etiqueta="Envío" valor={formatearFecha(ficha.correccionFechaEnvio)} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Inicio" valor={formatearFecha(ficha.correccionFechaInicio)} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Entrega" valor={formatearFecha(ficha.correccionFechaEntrega)} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Días totales" valor={ficha.correccionTotalDias} span="col-span-12 md:col-span-4" />
          <CampoResumen etiqueta="Observaciones" valor={ficha.correccionObservaciones} span="col-span-12" />
        </div>
      )}

      {puedeEditar && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 p-6 md:grid-cols-12">
          <div className="col-span-12 md:col-span-6">
            <label htmlFor="correccion-tipo-asignacion" className={LABEL_CLASS}>
              Tipo de asignación
            </label>
            <input
              id="correccion-tipo-asignacion"
              type="text"
              placeholder="Ej. Tripa Completa, Preliminares"
              value={tipoAsignacion}
              onChange={(event) => {
                setTipoAsignacion(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12 md:col-span-6">
            <label htmlFor="correccion-estatus" className={LABEL_CLASS}>
              Estatus
            </label>
            <select
              id="correccion-estatus"
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
            <label htmlFor="correccion-fecha-envio" className={LABEL_CLASS}>
              Envío
            </label>
            <input
              id="correccion-fecha-envio"
              type="date"
              value={fechaEnvio}
              onChange={(event) => {
                setFechaEnvio(event.target.value);
                mutacion.reset();
              }}
              className={INPUT_CLASS}
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label htmlFor="correccion-fecha-inicio" className={LABEL_CLASS}>
              Inicio
            </label>
            <input
              id="correccion-fecha-inicio"
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
            <label htmlFor="correccion-fecha-entrega" className={LABEL_CLASS}>
              Entrega
            </label>
            <input
              id="correccion-fecha-entrega"
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
            <label htmlFor="correccion-total-dias" className={LABEL_CLASS}>
              Días totales
            </label>
            <input
              id="correccion-total-dias"
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
            <label htmlFor="correccion-observaciones" className={LABEL_CLASS}>
              Observaciones
            </label>
            <textarea
              id="correccion-observaciones"
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
