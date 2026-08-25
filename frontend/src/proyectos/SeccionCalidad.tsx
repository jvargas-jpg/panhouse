import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { FichaCalidadFase, FichaCompleta } from '../types/api';
import { SinCompletar } from './campos';
import { actualizarFaseCalidad, agregarFaseCalidad, eliminarFaseCalidad } from './proyectoDetalleApi';

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

function FaseRow({ proyectoId, fase, puedeEditar }: { proyectoId: string; fase: FichaCalidadFase; puedeEditar: boolean }) {
  const [editando, setEditando] = useState(false);
  const [numeroFase, setNumeroFase] = useState(fase.numeroFase);
  const [pdfVersion, setPdfVersion] = useState(fase.pdfVersion ?? '');
  const [pdfUrl, setPdfUrl] = useState(fase.pdfUrl ?? '');
  const [aprobado, setAprobado] = useState<AprobadoOpcion>(opcionDesdeAprobado(fase.aprobado));
  const queryClient = useQueryClient();

  const mutacionEditar = useMutation({
    mutationFn: () =>
      actualizarFaseCalidad(proyectoId, fase.id, {
        numeroFase,
        pdfUrl: pdfUrl || null,
        pdfVersion: pdfVersion || null,
        aprobado: aprobadoDesdeOpcion(aprobado),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
      setEditando(false);
    },
  });

  const mutacionBorrar = useMutation({
    mutationFn: () => eliminarFaseCalidad(proyectoId, fase.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacionEditar.mutate();
  }

  function handleBorrar() {
    if (!window.confirm(`¿Borrar la fase ${fase.numeroFase}? No se puede deshacer.`)) return;
    mutacionBorrar.mutate();
  }

  const texto = `Fase ${fase.numeroFase}: ${fase.aprobado === true ? 'Aprobada' : fase.aprobado === false ? 'Rechazada' : 'Pendiente'}${fase.pdfVersion ? ` — ${fase.pdfVersion}` : ''}`;

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
        <select
          value={numeroFase}
          onChange={(event) => setNumeroFase(Number(event.target.value))}
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
        <input
          type="text"
          value={pdfVersion}
          onChange={(event) => setPdfVersion(event.target.value)}
          placeholder="Versión del PDF"
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
        <input
          type="text"
          value={pdfUrl}
          onChange={(event) => setPdfUrl(event.target.value)}
          placeholder="Enlace al PDF"
          className="flex-1 rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        />
        <select
          value={aprobado}
          onChange={(event) => setAprobado(event.target.value as AprobadoOpcion)}
          className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
        >
          <option value="pendiente">Pendiente</option>
          <option value="aprobada">Aprobada</option>
          <option value="rechazada">Rechazada</option>
        </select>
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

// Sección 5, dueño soporte_editorial.
export function SeccionCalidad({
  proyectoId,
  ficha,
  puedeEditar,
}: {
  proyectoId: string;
  ficha: FichaCompleta;
  puedeEditar: boolean;
}) {
  const [numeroFase, setNumeroFase] = useState(1);
  const [pdfVersion, setPdfVersion] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [aprobado, setAprobado] = useState<AprobadoOpcion>('pendiente');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      agregarFaseCalidad(proyectoId, {
        numeroFase,
        pdfUrl: pdfUrl || null,
        pdfVersion: pdfVersion || null,
        aprobado: aprobadoDesdeOpcion(aprobado),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ficha', proyectoId] });
      setPdfVersion('');
      setPdfUrl('');
      setAprobado('pendiente');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="rounded-lg border border-tinta/10 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">5. Calidad</h3>

      {ficha.calidadFases.length === 0 ? (
        <SinCompletar />
      ) : (
        <ul className="space-y-1 text-sm text-tinta">
          {ficha.calidadFases.map((fase) => (
            <FaseRow key={fase.id} proyectoId={proyectoId} fase={fase} puedeEditar={puedeEditar} />
          ))}
        </ul>
      )}

      {puedeEditar && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2 border-t border-tinta/10 pt-3">
          <div className="flex gap-3">
            <div>
              <label htmlFor="calidad-numero-fase" className="mb-1 block text-sm font-medium text-tinta">
                Fase
              </label>
              <select
                id="calidad-numero-fase"
                value={numeroFase}
                onChange={(event) => setNumeroFase(Number(event.target.value))}
                className="rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>

            <div className="flex-1">
              <label htmlFor="calidad-version" className="mb-1 block text-sm font-medium text-tinta">
                Versión del PDF
              </label>
              <input
                id="calidad-version"
                type="text"
                value={pdfVersion}
                onChange={(event) => setPdfVersion(event.target.value)}
                className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
              />
            </div>
          </div>

          <div>
            <label htmlFor="calidad-url" className="mb-1 block text-sm font-medium text-tinta">
              Enlace al PDF
            </label>
            <input
              id="calidad-url"
              type="text"
              value={pdfUrl}
              onChange={(event) => setPdfUrl(event.target.value)}
              className="w-full rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <div>
            <label htmlFor="calidad-aprobado" className="mb-1 block text-sm font-medium text-tinta">
              Estado
            </label>
            <select
              id="calidad-aprobado"
              value={aprobado}
              onChange={(event) => setAprobado(event.target.value as AprobadoOpcion)}
              className="rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="pendiente">Pendiente</option>
              <option value="aprobada">Aprobada</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={mutacion.isPending}
              className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
            >
              {mutacion.isPending ? 'Agregando…' : 'Agregar fase'}
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
