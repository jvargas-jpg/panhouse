import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { FichaCompleta } from '../types/api';
import { CamposReadOnly, formatearFechaONull } from './campos';
import { actualizarSeccionCorreccion } from './proyectoDetalleApi';

type AprobadoOpcion = 'pendiente' | 'aprobada' | 'rechazada';

function aprobadoDesdeOpcion(opcion: AprobadoOpcion): boolean | null {
  if (opcion === 'aprobada') return true;
  if (opcion === 'rechazada') return false;
  return null;
}

function opcionDesdeAprobado(aprobado: boolean | null): AprobadoOpcion {
  if (aprobado === true) return 'aprobada';
  if (aprobado === false) return 'rechazada';
  return 'pendiente';
}

function textoAprobado(aprobado: boolean | null): string {
  if (aprobado === true) return 'Aprobada';
  if (aprobado === false) return 'Rechazada';
  return 'Pendiente';
}

export function SeccionCorreccion({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [tripaCompleta, setTripaCompleta] = useState(ficha.correccionTripaCompleta ?? '');
  const [tripaFechaEntrega, setTripaFechaEntrega] = useState(ficha.correccionTripaCompletaFechaEntrega ?? '');
  const [tripaAprobado, setTripaAprobado] = useState<AprobadoOpcion>(opcionDesdeAprobado(ficha.correccionTripaCompletaAprobado));
  const [preliminares, setPreliminares] = useState(ficha.correccionPreliminares ?? '');
  const [preliminaresFechaEntrega, setPreliminaresFechaEntrega] = useState(ficha.correccionPreliminaresFechaEntrega ?? '');
  const [preliminaresAprobado, setPreliminaresAprobado] = useState<AprobadoOpcion>(opcionDesdeAprobado(ficha.correccionPreliminaresAprobado));
  const [cubiertaExtendida, setCubiertaExtendida] = useState(ficha.correccionCubiertaExtendida ?? '');
  const [cubiertaFechaEntrega, setCubiertaFechaEntrega] = useState(ficha.correccionCubiertaExtendidaFechaEntrega ?? '');
  const [cubiertaAprobado, setCubiertaAprobado] = useState<AprobadoOpcion>(opcionDesdeAprobado(ficha.correccionCubiertaExtendidaAprobado));

  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionCorreccion(proyectoId, {
        correccionTripaCompleta: tripaCompleta || null,
        correccionTripaCompletaFechaEntrega: tripaFechaEntrega || null,
        correccionTripaCompletaAprobado: aprobadoDesdeOpcion(tripaAprobado),
        correccionPreliminares: preliminares || null,
        correccionPreliminaresFechaEntrega: preliminaresFechaEntrega || null,
        correccionPreliminaresAprobado: aprobadoDesdeOpcion(preliminaresAprobado),
        correccionCubiertaExtendida: cubiertaExtendida || null,
        correccionCubiertaExtendidaFechaEntrega: cubiertaFechaEntrega || null,
        correccionCubiertaExtendidaAprobado: aprobadoDesdeOpcion(cubiertaAprobado),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  if (!puedeEditar) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl border border-dorado/40 bg-white p-6 shadow-md">
        <div className="absolute left-0 top-0 h-1 w-full bg-dorado" />
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-tinta">5. Matriz de Corrección</h3>
          <p className="text-xs uppercase tracking-wider text-tinta/50">Control de Especialista</p>
        </div>
        <CamposReadOnly
          campos={[
            { etiqueta: 'Tripa completa', valor: ficha.correccionTripaCompleta },
            { etiqueta: 'Tripa completa — entrega', valor: formatearFechaONull(ficha.correccionTripaCompletaFechaEntrega) },
            { etiqueta: 'Tripa completa — estado', valor: textoAprobado(ficha.correccionTripaCompletaAprobado) },
            { etiqueta: 'Preliminares', valor: ficha.correccionPreliminares },
            { etiqueta: 'Preliminares — entrega', valor: formatearFechaONull(ficha.correccionPreliminaresFechaEntrega) },
            { etiqueta: 'Preliminares — estado', valor: textoAprobado(ficha.correccionPreliminaresAprobado) },
            { etiqueta: 'Cubierta extendida', valor: ficha.correccionCubiertaExtendida },
            { etiqueta: 'Cubierta extendida — entrega', valor: formatearFechaONull(ficha.correccionCubiertaExtendidaFechaEntrega) },
            { etiqueta: 'Cubierta extendida — estado', valor: textoAprobado(ficha.correccionCubiertaExtendidaAprobado) },
          ]}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full overflow-hidden rounded-xl border border-dorado/40 bg-white p-6 shadow-md">
      <div className="absolute left-0 top-0 h-1 w-full bg-dorado" />
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-tinta">5. Matriz de Corrección</h3>
        <p className="text-xs uppercase tracking-wider text-tinta/50">Control de Especialista</p>
      </div>

      {/* Paso 1 — Indicador de progreso visual */}
      <div className="relative mb-10 mt-6 flex items-center justify-between px-4 md:px-12">
        <div className="absolute left-12 right-12 top-3 z-0 h-1 bg-dorado/30" />

        <div className="z-10 flex flex-col items-center gap-2">
          <div className={`h-6 w-6 rounded-full border-4 border-white shadow-sm ${tripaAprobado === 'aprobada' ? 'bg-green-500' : 'bg-dorado'}`} />
          <span className="absolute top-8 w-24 text-center text-xs font-semibold text-tinta">Tripa Completa</span>
        </div>

        <div className="z-10 flex flex-col items-center gap-2">
          <div
            className={`h-6 w-6 rounded-full border-4 border-white shadow-sm ${preliminaresAprobado === 'aprobada' ? 'bg-green-500' : 'bg-dorado'}`}
          />
          <span className="absolute top-8 w-24 text-center text-xs font-semibold text-tinta">Preliminares</span>
        </div>

        <div className="z-10 flex flex-col items-center gap-2">
          <div className={`h-6 w-6 rounded-full border-4 border-white shadow-sm ${cubiertaAprobado === 'aprobada' ? 'bg-green-500' : 'bg-dorado'}`} />
          <span className="absolute top-8 w-24 text-center text-xs font-semibold text-tinta">Cubierta Extendida</span>
        </div>
      </div>

      {/* Paso 2 — Formulario vertical */}
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-tinta/10 bg-crema/20 p-5">
          <h4 className="mb-3 font-bold text-tinta">1. Tripa Completa</h4>
          <label htmlFor="correccion-tripa-completa" className="sr-only">
            Tripa completa
          </label>
          <textarea
            id="correccion-tripa-completa"
            rows={2}
            value={tripaCompleta}
            onChange={(event) => {
              setTripaCompleta(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-tinta">Fecha de entrega</label>
              <input
                type="date"
                value={tripaFechaEntrega}
                onChange={(event) => {
                  setTripaFechaEntrega(event.target.value);
                  mutacion.reset();
                }}
                className="w-full rounded-md border border-tinta/20 bg-white px-2 py-1.5 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tinta">Aprobado</label>
              <select
                value={tripaAprobado}
                onChange={(event) => {
                  setTripaAprobado(event.target.value as AprobadoOpcion);
                  mutacion.reset();
                }}
                className="w-full rounded-md border border-tinta/20 bg-white px-2 py-1.5 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
              >
                <option value="pendiente">Pendiente</option>
                <option value="aprobada">Sí</option>
                <option value="rechazada">No</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-tinta/10 bg-crema/20 p-5">
          <h4 className="mb-3 font-bold text-tinta">2. Preliminares</h4>
          <label htmlFor="correccion-preliminares" className="sr-only">
            Preliminares
          </label>
          <textarea
            id="correccion-preliminares"
            rows={2}
            value={preliminares}
            onChange={(event) => {
              setPreliminares(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-tinta">Fecha de entrega</label>
              <input
                type="date"
                value={preliminaresFechaEntrega}
                onChange={(event) => {
                  setPreliminaresFechaEntrega(event.target.value);
                  mutacion.reset();
                }}
                className="w-full rounded-md border border-tinta/20 bg-white px-2 py-1.5 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tinta">Aprobado</label>
              <select
                value={preliminaresAprobado}
                onChange={(event) => {
                  setPreliminaresAprobado(event.target.value as AprobadoOpcion);
                  mutacion.reset();
                }}
                className="w-full rounded-md border border-tinta/20 bg-white px-2 py-1.5 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
              >
                <option value="pendiente">Pendiente</option>
                <option value="aprobada">Sí</option>
                <option value="rechazada">No</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-tinta/10 bg-crema/20 p-5">
          <h4 className="mb-3 font-bold text-tinta">3. Cubierta Extendida</h4>
          <label htmlFor="correccion-cubierta-extendida" className="sr-only">
            Cubierta extendida
          </label>
          <textarea
            id="correccion-cubierta-extendida"
            rows={2}
            value={cubiertaExtendida}
            onChange={(event) => {
              setCubiertaExtendida(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
          <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-tinta">Fecha de entrega</label>
              <input
                type="date"
                value={cubiertaFechaEntrega}
                onChange={(event) => {
                  setCubiertaFechaEntrega(event.target.value);
                  mutacion.reset();
                }}
                className="w-full rounded-md border border-tinta/20 bg-white px-2 py-1.5 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-tinta">Aprobado</label>
              <select
                value={cubiertaAprobado}
                onChange={(event) => {
                  setCubiertaAprobado(event.target.value as AprobadoOpcion);
                  mutacion.reset();
                }}
                className="w-full rounded-md border border-tinta/20 bg-white px-2 py-1.5 text-sm focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
              >
                <option value="pendiente">Pendiente</option>
                <option value="aprobada">Sí</option>
                <option value="rechazada">No</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Paso 3 — Footer de guardar */}
      <div className="mt-4 flex justify-end rounded-lg bg-tinta p-4">
        {mutacion.isSuccess && <span className="mr-3 self-center text-sm text-green-300">Guardado ✓</span>}
        {mutacion.isError && (
          <span role="alert" className="mr-3 self-center text-sm text-red-300">
            No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
          </span>
        )}
        <button
          type="submit"
          disabled={mutacion.isPending}
          className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
        >
          {mutacion.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
