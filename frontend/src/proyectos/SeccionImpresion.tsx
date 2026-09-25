import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { EstadoCotizacionImpresion, FichaCompleta } from '../types/api';
import { CamposReadOnly } from './campos';
import { actualizarSeccionImpresion } from './proyectoDetalleApi';
import { SeccionImpresionControl } from './SeccionImpresionControl';

const ESTADO_COTIZACION_LABEL: Record<EstadoCotizacionImpresion, string> = {
  solicitada: 'Solicitada',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};

// Sección 8, dueño exclusivo rrpp — jefatura solo la ve (mismo criterio
// que el resto de "Área exclusiva de RRPP"). Renombrado a componente
// privado: ver el wrapper SeccionImpresion al final del archivo, que
// monta esto como vista "Micro" debajo del panel de control agregado
// (Macro).
function ContenidoImpresionMicro({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [deseaCotizacion, setDeseaCotizacion] = useState(ficha.impresionDeseaCotizacion ?? false);
  const [responsable, setResponsable] = useState(ficha.impresionResponsable ?? '');
  const [estadoCotizacion, setEstadoCotizacion] = useState<EstadoCotizacionImpresion | ''>(ficha.impresionEstadoCotizacion ?? '');
  const [notas, setNotas] = useState(ficha.impresionNotas ?? '');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      actualizarSeccionImpresion(proyectoId, {
        impresionDeseaCotizacion: deseaCotizacion,
        impresionResponsable: responsable || null,
        impresionEstadoCotizacion: estadoCotizacion || null,
        impresionNotas: notas || null,
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
        <h3 className="mb-2 font-medium text-tinta">Impresión</h3>
        <CamposReadOnly
          campos={[
            {
              etiqueta: 'Desea cotización',
              valor: ficha.impresionDeseaCotizacion === null ? null : ficha.impresionDeseaCotizacion ? 'Sí' : 'No',
            },
            { etiqueta: 'Responsable', valor: ficha.impresionResponsable },
            {
              etiqueta: 'Estado de la cotización',
              valor: ficha.impresionEstadoCotizacion ? ESTADO_COTIZACION_LABEL[ficha.impresionEstadoCotizacion] : null,
            },
            { etiqueta: 'Notas', valor: ficha.impresionNotas },
          ]}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">Impresión</h3>

      <div className="space-y-3 rounded-lg bg-crema/20 p-4">
        <div className="flex items-center gap-2">
          <input
            id="impresion-desea-cotizacion"
            type="checkbox"
            checked={deseaCotizacion}
            onChange={(event) => {
              setDeseaCotizacion(event.target.checked);
              mutacion.reset();
            }}
            className="h-4 w-4 rounded border-tinta/20 text-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
          <label htmlFor="impresion-desea-cotizacion" className="text-sm font-medium text-tinta">
            Desea cotización
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex-1">
            <label htmlFor="impresion-responsable" className="mb-1 block text-sm font-medium text-tinta">
              Responsable
            </label>
            <input
              id="impresion-responsable"
              type="text"
              value={responsable}
              onChange={(event) => {
                setResponsable(event.target.value);
                mutacion.reset();
              }}
              className="w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <div className="flex-1">
            <label htmlFor="impresion-estado-cotizacion" className="mb-1 block text-sm font-medium text-tinta">
              Estado de la cotización
            </label>
            <select
              id="impresion-estado-cotizacion"
              value={estadoCotizacion}
              onChange={(event) => {
                setEstadoCotizacion(event.target.value as EstadoCotizacionImpresion | '');
                mutacion.reset();
              }}
              className="w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Sin definir</option>
              <option value="solicitada">Solicitada</option>
              <option value="enviada">Enviada</option>
              <option value="aceptada">Aceptada</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="impresion-notas" className="mb-1 block text-sm font-medium text-tinta">
            Notas
          </label>
          <textarea
            id="impresion-notas"
            rows={2}
            value={notas}
            onChange={(event) => {
              setNotas(event.target.value);
              mutacion.reset();
            }}
            className="w-full rounded-md border border-tinta/20 bg-white px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
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
    </form>
  );
}

// Sección 8 completa: panel "Macro" (estatus agregado) arriba, vista
// "Micro" (solicitud de cotización, código previo sin cambios) debajo.
// A diferencia de Calidad/Digital/Lanzamiento/Distribución, un solo
// puedeEditar alcanza para ambas partes: no hay dueño individual acá
// (no existe impresionId en proyectos), así que no hace falta un
// puedeEditarControl separado resuelto por id de usuario.
export function SeccionImpresion({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-6">
      <SeccionImpresionControl proyectoId={proyectoId} ficha={ficha} puedeEditar={puedeEditar} />
      <ContenidoImpresionMicro proyectoId={proyectoId} ficha={ficha} puedeEditar={puedeEditar} />
    </div>
  );
}
