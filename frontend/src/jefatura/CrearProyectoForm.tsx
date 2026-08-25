import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Autor, Proyecto } from '../types/api';
import { crearProyecto, fetchCatalogos } from './jefaturaApi';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function coincide(autor: Autor, busqueda: string): boolean {
  const q = busqueda.trim().toLowerCase();
  if (!q) return true;
  return autor.nombre.toLowerCase().includes(q) || (autor.email ?? '').toLowerCase().includes(q);
}

// Se abre desde uno de los dos botones de la sección (AutoresSinProyecto),
// no desde una fila puntual: primero se decide crear, después se busca
// al autor — por eso recibe la lista de autores ya resuelta (sin
// proyecto, o todos, según qué botón se usó) y resuelve la búsqueda
// acá, en vez de recibir un autorId ya fijo. No le importa de dónde
// viene la lista. Colección queda fuera a propósito: esa tabla está
// vacía todavía (ver server/db/schema/catalogos.ts).
export function CrearProyectoForm({
  autores,
  onCreado,
  onCancelar,
}: {
  autores: Autor[];
  onCreado: (proyecto: Proyecto, autorNombre: string) => void;
  onCancelar: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [autorSeleccionado, setAutorSeleccionado] = useState<Autor | null>(null);
  const catalogosQuery = useQuery({ queryKey: ['catalogos'], queryFn: fetchCatalogos });
  const [servicioId, setServicioId] = useState('');
  const [unidadId, setUnidadId] = useState('');
  const [presupuestoId, setPresupuestoId] = useState('');
  const [fechaProgramadaInicio, setFechaProgramadaInicio] = useState(hoyISO());
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () =>
      crearProyecto({
        autorId: autorSeleccionado?.id ?? '',
        servicioId,
        unidadId,
        presupuestoId,
        fechaProgramadaInicio,
      }),
    onSuccess: ({ proyecto }) => {
      // El autor ya no está "sin proyecto" — desaparece de esa lista.
      queryClient.invalidateQueries({ queryKey: ['autores', 'sin-proyecto'] });
      onCreado(proyecto, autorSeleccionado?.nombre ?? '');
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  const resultados = autores.filter((autor) => coincide(autor, busqueda));

  return (
    <div className="mt-2 rounded-md bg-crema p-3">
      {!autorSeleccionado && (
        <div>
          <label htmlFor="crear-proyecto-buscar-autor" className="mb-1 block text-sm font-medium text-tinta">
            Autor
          </label>
          <input
            id="crear-proyecto-buscar-autor"
            type="text"
            autoFocus
            placeholder="Buscar por nombre o correo…"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="w-full max-w-sm rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
          />

          <ul className="mt-2 max-h-48 max-w-sm space-y-1 overflow-y-auto">
            {resultados.length === 0 && <li className="p-2 text-sm italic text-tinta/50">Sin resultados.</li>}
            {resultados.map((autor) => (
              <li key={autor.id}>
                <button
                  type="button"
                  onClick={() => setAutorSeleccionado(autor)}
                  className="w-full rounded-md border border-tinta/10 bg-white px-3 py-2 text-left text-sm text-tinta shadow-sm hover:border-dorado"
                >
                  <span className="font-medium">{autor.nombre}</span>
                  <span className="ml-2 text-tinta/70">
                    {autor.email ?? 'sin correo'} · {autor.pais ?? 'sin país'}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button type="button" onClick={onCancelar} className="mt-2 text-xs text-tinta/70 underline hover:text-tinta">
            Cancelar
          </button>
        </div>
      )}

      {autorSeleccionado && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-tinta/10 bg-white px-3 py-2">
          <span className="text-sm text-tinta">
            Autor: <span className="font-medium">{autorSeleccionado.nombre}</span>
          </span>
          <button
            type="button"
            onClick={() => setAutorSeleccionado(null)}
            className="shrink-0 text-xs text-tinta/70 underline hover:text-tinta"
          >
            Cambiar
          </button>
        </div>
      )}

      {autorSeleccionado && catalogosQuery.isLoading && <p className="text-sm text-tinta/70">Cargando catálogos…</p>}
      {autorSeleccionado && catalogosQuery.isError && (
        <p role="alert" className="text-sm text-red-600">
          No se pudieron cargar los catálogos{catalogosQuery.error instanceof Error ? `: ${catalogosQuery.error.message}` : ''}.
        </p>
      )}

      {autorSeleccionado && catalogosQuery.data && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="crear-proyecto-servicio" className="mb-1 block text-xs font-medium text-tinta">
              Servicio
            </label>
            <select
              id="crear-proyecto-servicio"
              required
              value={servicioId}
              onChange={(event) => setServicioId(event.target.value)}
              className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Seleccionar…</option>
              {catalogosQuery.data.servicios.map((servicio) => (
                <option key={servicio.id} value={servicio.id}>
                  {servicio.codigo} — {servicio.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="crear-proyecto-unidad" className="mb-1 block text-xs font-medium text-tinta">
              Unidad
            </label>
            <select
              id="crear-proyecto-unidad"
              required
              value={unidadId}
              onChange={(event) => setUnidadId(event.target.value)}
              className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Seleccionar…</option>
              {catalogosQuery.data.unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {unidad.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="crear-proyecto-presupuesto" className="mb-1 block text-xs font-medium text-tinta">
              Presupuesto
            </label>
            <select
              id="crear-proyecto-presupuesto"
              required
              value={presupuestoId}
              onChange={(event) => setPresupuestoId(event.target.value)}
              className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Seleccionar…</option>
              {catalogosQuery.data.presupuestos.map((presupuesto) => (
                <option key={presupuesto.id} value={presupuesto.id}>
                  {presupuesto.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="crear-proyecto-fecha-inicio" className="mb-1 block text-xs font-medium text-tinta">
              Fecha programada de inicio
            </label>
            <input
              id="crear-proyecto-fecha-inicio"
              type="date"
              required
              value={fechaProgramadaInicio}
              onChange={(event) => setFechaProgramadaInicio(event.target.value)}
              className="rounded-md border border-tinta/20 px-2 py-1 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            />
          </div>

          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-dorado px-3 py-1.5 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Creando…' : 'Crear proyecto'}
          </button>
          <button type="button" onClick={onCancelar} className="text-xs text-tinta/70 underline hover:text-tinta">
            Cancelar
          </button>
          {mutacion.isError && (
            <span role="alert" className="text-xs text-red-600">
              No se pudo crear el proyecto{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </form>
      )}
    </div>
  );
}
