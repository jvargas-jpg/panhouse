import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { FichaCompleta } from '../types/api';
import { CamposReadOnly, formatearFechaONull } from './campos';
import { actualizarSeccionSoporteDigital } from './proyectoDetalleApi';

// Sección 6, dueño soporte_digital.
export function SeccionSoporteDigital({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [cuentaAmazon, setCuentaAmazon] = useState(ficha.soporteDigitalCuentaAmazon ?? '');
  const [fechaEnvioFormulario, setFechaEnvioFormulario] = useState(ficha.soporteDigitalFechaEnvioFormulario ?? '');
  const [fechaActivacion, setFechaActivacion] = useState(ficha.soporteDigitalFechaActivacion ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionSoporteDigital(proyectoId, {
        soporteDigitalCuentaAmazon: cuentaAmazon || null,
        soporteDigitalFechaEnvioFormulario: fechaEnvioFormulario || null,
        soporteDigitalFechaActivacion: fechaActivacion || null,
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
      <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
        <h3 className="mb-2 font-medium text-tinta">6. Soporte digital</h3>
        <CamposReadOnly
          campos={[
            { etiqueta: 'Cuenta Amazon', valor: ficha.soporteDigitalCuentaAmazon },
            { etiqueta: 'Formulario enviado', valor: formatearFechaONull(ficha.soporteDigitalFechaEnvioFormulario) },
            { etiqueta: 'Activación', valor: formatearFechaONull(ficha.soporteDigitalFechaActivacion) },
          ]}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">6. Soporte digital</h3>
      <div className="space-y-3">
        <div>
          <label htmlFor="soporte-cuenta-amazon" className="mb-1 block text-sm font-medium text-tinta">
            Cuenta Amazon
          </label>
          <input
            id="soporte-cuenta-amazon"
            type="text"
            value={cuentaAmazon}
            onChange={(event) => {
              setCuentaAmazon(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="soporte-envio-formulario" className="mb-1 block text-sm font-medium text-tinta">
              Formulario enviado
            </label>
            <input
              id="soporte-envio-formulario"
              type="date"
              value={fechaEnvioFormulario}
              onChange={(event) => {
                setFechaEnvioFormulario(event.target.value);
                mutacion.reset();
              }}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <div className="flex-1">
            <label htmlFor="soporte-activacion" className="mb-1 block text-sm font-medium text-tinta">
              Activación
            </label>
            <input
              id="soporte-activacion"
              type="date"
              value={fechaActivacion}
              onChange={(event) => {
                setFechaActivacion(event.target.value);
                mutacion.reset();
              }}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          {mutacion.isSuccess && <span className="text-sm text-green-700">Guardado ✓</span>}
          {mutacion.isError && (
            <span role="alert" className="text-sm text-red-600">
              No se pudo guardar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
