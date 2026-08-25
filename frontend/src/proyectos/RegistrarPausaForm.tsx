import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { CausaPausa } from '../types/api';
import { crearPausa } from './proyectoDetalleApi';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Única acción de escritura de esta pantalla: pausa simple (no
// formal). El flujo de PAUSADO con confirmación de pago queda para
// cuando esté resuelto quién puede confirmarlo.
export function RegistrarPausaForm({ proyectoId }: { proyectoId: string }) {
  const [causa, setCausa] = useState<CausaPausa>('autor');
  const [fechaInicio, setFechaInicio] = useState(hoyISO());
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => crearPausa({ proyectoId, causa, fechaInicio }),
    onSuccess: () => {
      // Sin recarga completa: invalida lo que cambió con la nueva
      // pausa — la lista misma, y el riesgo del proyecto (los días
      // efectivos ahora excluyen este tramo).
      queryClient.invalidateQueries({ queryKey: ['pausas', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyecto', proyectoId] });
      setFechaInicio(hoyISO());
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
      <div className="flex-1">
        <label htmlFor="pausa-causa" className="mb-1 block text-sm font-medium text-tinta">
          Causa
        </label>
        <select
          id="pausa-causa"
          value={causa}
          onChange={(event) => setCausa(event.target.value as CausaPausa)}
          className="w-full rounded-md border border-tinta/20 px-3 py-2 text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        >
          <option value="autor">Autor</option>
          <option value="otro_departamento">Otro departamento</option>
        </select>
      </div>

      <div className="flex-1">
        <label htmlFor="pausa-fecha" className="mb-1 block text-sm font-medium text-tinta">
          Fecha de inicio
        </label>
        <input
          id="pausa-fecha"
          type="date"
          required
          value={fechaInicio}
          onChange={(event) => setFechaInicio(event.target.value)}
          className="w-full rounded-md border border-tinta/20 px-3 py-2 text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
      </div>

      <button
        type="submit"
        disabled={mutacion.isPending}
        className="rounded-md bg-dorado px-4 py-2 font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
      >
        {mutacion.isPending ? 'Registrando…' : 'Registrar pausa'}
      </button>

      {mutacion.isError && (
        <p role="alert" className="text-sm text-red-600 sm:basis-full">
          No se pudo registrar la pausa{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
        </p>
      )}
    </form>
  );
}
