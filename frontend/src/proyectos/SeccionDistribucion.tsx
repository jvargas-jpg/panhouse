import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { FichaCompleta, FichaDistribucionPais } from '../types/api';
import { SinCompletar } from './campos';
import { actualizarPaisDistribucion, agregarPaisDistribucion, eliminarPaisDistribucion } from './proyectoDetalleApi';
import { SeccionDistribucionControl } from './SeccionDistribucionControl';

function PaisRow({
  proyectoId,
  paisFila,
  puedeEditar,
}: {
  proyectoId: string;
  paisFila: FichaDistribucionPais;
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [pais, setPais] = useState(paisFila.pais);
  const [porcentajeRegalias, setPorcentajeRegalias] = useState(paisFila.porcentajeRegalias ?? '');
  const queryClient = useQueryClient();

  const mutacionEditar = useMutation({
    mutationFn: () =>
      actualizarPaisDistribucion(proyectoId, paisFila.id, {
        pais,
        porcentajeRegalias: porcentajeRegalias || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
      setEditando(false);
    },
  });

  const mutacionBorrar = useMutation({
    mutationFn: () => eliminarPaisDistribucion(proyectoId, paisFila.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacionEditar.mutate();
  }

  function handleBorrar() {
    if (!window.confirm(`¿Borrar ${paisFila.pais} de la distribución? No se puede deshacer.`)) return;
    mutacionBorrar.mutate();
  }

  const texto = `${paisFila.pais}${paisFila.porcentajeRegalias ? ` — ${paisFila.porcentajeRegalias}% regalías` : ''}`;

  if (!puedeEditar) {
    return <li>{texto}</li>;
  }

  if (!editando) {
    return (
      <li className="flex items-center justify-between gap-2">
        <span>{texto}</span>
        <span className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditando(true)} className="text-xs text-tinta/70 underline hover:text-tinta">
            Editar
          </button>
          <button
            type="button"
            onClick={handleBorrar}
            disabled={mutacionBorrar.isPending}
            className="text-xs text-red-600 underline hover:text-red-800 disabled:opacity-60"
          >
            {mutacionBorrar.isPending ? 'Borrando…' : 'Borrar'}
          </button>
        </span>
        {mutacionBorrar.isError && (
          <span role="alert" className="text-xs text-red-600">
            No se pudo borrar.
          </span>
        )}
      </li>
    );
  }

  return (
    <li>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-md bg-crema p-2">
        <input
          type="text"
          required
          value={pais}
          onChange={(event) => setPais(event.target.value)}
          className="flex-1 rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
        <input
          type="text"
          value={porcentajeRegalias}
          onChange={(event) => setPorcentajeRegalias(event.target.value)}
          placeholder="% regalías"
          className="w-24 rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
        <button
          type="submit"
          disabled={mutacionEditar.isPending}
          className="rounded-md bg-dorado px-3 py-1.5 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
        >
          {mutacionEditar.isPending ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={() => setEditando(false)} className="text-xs text-tinta/70 underline hover:text-tinta">
          Cancelar
        </button>
        {mutacionEditar.isError && (
          <span role="alert" className="text-xs text-red-600">
            No se pudo guardar.
          </span>
        )}
      </form>
    </li>
  );
}

// Sección 9, dueño rrpp. Renombrado a componente privado: ver el
// wrapper SeccionDistribucion al final del archivo, que monta esto como
// vista "Micro" debajo del panel de control agregado (Macro).
function ContenidoDistribucionMicro({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [pais, setPais] = useState('');
  const [porcentajeRegalias, setPorcentajeRegalias] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      agregarPaisDistribucion(proyectoId, {
        pais,
        porcentajeRegalias: porcentajeRegalias || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
      setPais('');
      setPorcentajeRegalias('');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">Distribución</h3>

      {ficha.distribucionPaises.length === 0 ? (
        <SinCompletar />
      ) : (
        <ul className="space-y-1 text-sm text-tinta">
          {ficha.distribucionPaises.map((paisFila) => (
            <PaisRow key={paisFila.id} proyectoId={proyectoId} paisFila={paisFila} puedeEditar={puedeEditar} />
          ))}
        </ul>
      )}

      {puedeEditar && (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3 border-t border-tinta/10 pt-3">
          <div className="flex-1">
            <label htmlFor="distribucion-pais" className="mb-1 block text-sm font-medium text-tinta">
              País
            </label>
            <input
              id="distribucion-pais"
              type="text"
              required
              value={pais}
              onChange={(event) => setPais(event.target.value)}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <div>
            <label htmlFor="distribucion-regalias" className="mb-1 block text-sm font-medium text-tinta">
              % regalías
            </label>
            <input
              id="distribucion-regalias"
              type="text"
              value={porcentajeRegalias}
              onChange={(event) => setPorcentajeRegalias(event.target.value)}
              className="w-24 rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Agregando…' : 'Agregar país'}
          </button>
          {mutacion.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
          {mutacion.isError && (
            <span role="alert" className="text-sm text-red-600 sm:basis-full">
              No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </form>
      )}
    </div>
  );
}

// Sección 9 completa (última fase del stepper, "8. Distribución"):
// panel "Macro" (estatus agregado, dueño doble — especialista dueño del
// proyecto o responsable logístico asignado) arriba, vista "Micro"
// (países de distribución, código previo sin cambios) debajo.
// puedeEditarControl llega resuelto desde ProyectoDetallePage.tsx
// porque para decidirlo hace falta el id del usuario logueado, no solo
// su rol (a diferencia de puedeEditar, que sigue siendo solo por rol).
export function SeccionDistribucion({
  proyectoId,
  ficha,
  puedeEditar,
  puedeEditarControl,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
  puedeEditarControl: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-6">
      <SeccionDistribucionControl proyectoId={proyectoId} ficha={ficha} puedeEditar={puedeEditarControl} />
      <ContenidoDistribucionMicro proyectoId={proyectoId} ficha={ficha} puedeEditar={puedeEditar} />
    </div>
  );
}
