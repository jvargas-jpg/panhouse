import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { FichaCompleta, FichaLanzamientoReunion } from '../types/api';
import { formatearFecha, hoyISO, SinCompletar } from './campos';
import {
  actualizarReunionLanzamiento,
  actualizarSeccionLanzamientoGeneral,
  agregarReunionLanzamiento,
  eliminarReunionLanzamiento,
} from './proyectoDetalleApi';
import { SeccionLanzamientoControl } from './SeccionLanzamientoControl';

const NIVEL_SATISFACCION_LABEL: Record<string, string> = {
  '1': '1 - Muy insatisfecho',
  '2': '2 - Insatisfecho',
  '3': '3 - Neutral',
  '4': '4 - Satisfecho',
  '5': '5 - Muy satisfecho',
};

// Parte general de la Sección 7 (nivelSatisfaccion): a diferencia de
// las reuniones, es un único valor por proyecto — mutación y ruta
// propias (PATCH .../lanzamiento/general), separadas del CRUD de
// reuniones.
function DatosGeneralesLanzamiento({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [nivelSatisfaccion, setNivelSatisfaccion] = useState(ficha.nivelSatisfaccion ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => actualizarSeccionLanzamientoGeneral(proyectoId, { nivelSatisfaccion: nivelSatisfaccion || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="mb-6 rounded-lg bg-crema/20 p-4">
      <h4 className="mb-3 text-sm font-semibold text-tinta">Datos generales</h4>

      {!puedeEditar ? (
        <p className="text-sm text-tinta">
          <span className="font-medium text-tinta/70">Nivel de satisfacción del autor: </span>
          {ficha.nivelSatisfaccion ? (NIVEL_SATISFACCION_LABEL[ficha.nivelSatisfaccion] ?? ficha.nivelSatisfaccion) : 'Sin completar'}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="lanzamiento-nivel-satisfaccion" className="mb-1 block text-sm font-medium text-tinta">
              Nivel de Satisfacción del Autor
            </label>
            <select
              id="lanzamiento-nivel-satisfaccion"
              value={nivelSatisfaccion}
              onChange={(event) => {
                setNivelSatisfaccion(event.target.value);
                mutacion.reset();
              }}
              className="rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Seleccionar…</option>
              <option value="1">1 - Muy insatisfecho</option>
              <option value="2">2 - Insatisfecho</option>
              <option value="3">3 - Neutral</option>
              <option value="4">4 - Satisfecho</option>
              <option value="5">5 - Muy satisfecho</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Guardando…' : 'Guardar nivel'}
          </button>
          {mutacion.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
          {mutacion.isError && (
            <span role="alert" className="text-sm text-red-600">
              No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </form>
      )}
    </div>
  );
}

function ReunionRow({
  proyectoId,
  reunion,
  puedeEditar,
}: {
  proyectoId: string;
  reunion: FichaLanzamientoReunion;
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [fecha, setFecha] = useState(reunion.fecha ?? '');
  const [puntosTratados, setPuntosTratados] = useState(reunion.puntosTratados ?? '');
  const [acuerdos, setAcuerdos] = useState(reunion.acuerdos ?? '');
  const queryClient = useQueryClient();

  const mutacionEditar = useMutation({
    mutationFn: () =>
      actualizarReunionLanzamiento(proyectoId, reunion.id, {
        fecha: fecha || null,
        puntosTratados: puntosTratados || null,
        acuerdos: acuerdos || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
      setEditando(false);
    },
  });

  const mutacionBorrar = useMutation({
    mutationFn: () => eliminarReunionLanzamiento(proyectoId, reunion.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacionEditar.mutate();
  }

  function handleBorrar() {
    if (!window.confirm('¿Borrar esta reunión de lanzamiento? No se puede deshacer.')) return;
    mutacionBorrar.mutate();
  }

  const texto = `${formatearFecha(reunion.fecha)}${reunion.puntosTratados ? ` — ${reunion.puntosTratados}` : ''}${reunion.acuerdos ? ` (acuerdos: ${reunion.acuerdos})` : ''}`;

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
          type="date"
          value={fecha}
          onChange={(event) => setFecha(event.target.value)}
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
        <input
          type="text"
          value={puntosTratados}
          onChange={(event) => setPuntosTratados(event.target.value)}
          placeholder="Puntos tratados"
          className="flex-1 rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
        <input
          type="text"
          value={acuerdos}
          onChange={(event) => setAcuerdos(event.target.value)}
          placeholder="Acuerdos"
          className="flex-1 rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
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

// Sección 7, dueño rrpp. Renombrado a componente privado: ver el
// wrapper SeccionLanzamiento al final del archivo, que monta esto como
// vista "Micro" debajo del panel de control agregado (Macro).
function ContenidoLanzamientoMicro({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [fecha, setFecha] = useState(hoyISO());
  const [puntosTratados, setPuntosTratados] = useState('');
  const [acuerdos, setAcuerdos] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      agregarReunionLanzamiento(proyectoId, {
        fecha,
        puntosTratados: puntosTratados || null,
        acuerdos: acuerdos || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
      setPuntosTratados('');
      setAcuerdos('');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">Lanzamiento y promoción</h3>

      <DatosGeneralesLanzamiento proyectoId={proyectoId} ficha={ficha} puedeEditar={puedeEditar} />

      {ficha.lanzamientoReuniones.length === 0 ? (
        <SinCompletar />
      ) : (
        <ul className="space-y-1 text-sm text-tinta">
          {ficha.lanzamientoReuniones.map((reunion) => (
            <ReunionRow key={reunion.id} proyectoId={proyectoId} reunion={reunion} puedeEditar={puedeEditar} />
          ))}
        </ul>
      )}

      {puedeEditar && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-tinta/10 pt-3">
          <div>
            <label htmlFor="lanzamiento-fecha" className="mb-1 block text-sm font-medium text-tinta">
              Fecha de la reunión
            </label>
            <input
              id="lanzamiento-fecha"
              type="date"
              required
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <div>
            <label htmlFor="lanzamiento-puntos" className="mb-1 block text-sm font-medium text-tinta">
              Puntos tratados
            </label>
            <textarea
              id="lanzamiento-puntos"
              rows={2}
              value={puntosTratados}
              onChange={(event) => setPuntosTratados(event.target.value)}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <div>
            <label htmlFor="lanzamiento-acuerdos" className="mb-1 block text-sm font-medium text-tinta">
              Acuerdos
            </label>
            <textarea
              id="lanzamiento-acuerdos"
              rows={2}
              value={acuerdos}
              onChange={(event) => setAcuerdos(event.target.value)}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={mutacion.isPending}
              className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
            >
              {mutacion.isPending ? 'Agregando…' : 'Agregar reunión'}
            </button>
            {mutacion.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
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

// Sección 7 completa: panel "Macro" (estatus agregado, dueño doble —
// especialista dueño del proyecto o responsable de lanzamiento
// asignado) arriba, vista "Micro" (nivel de satisfacción y reuniones,
// código previo sin cambios) debajo. puedeEditarControl llega resuelto
// desde ProyectoDetallePage.tsx porque para decidirlo hace falta el id
// del usuario logueado, no solo su rol (a diferencia de puedeEditar,
// que sigue siendo solo por rol).
export function SeccionLanzamiento({
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
      <SeccionLanzamientoControl proyectoId={proyectoId} ficha={ficha} puedeEditar={puedeEditarControl} />
      <ContenidoLanzamientoMicro proyectoId={proyectoId} ficha={ficha} puedeEditar={puedeEditar} />
    </div>
  );
}
