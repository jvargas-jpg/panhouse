import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { formatearFechaONull } from '../proyectos/campos';
import { asignarEspecialista, fetchCargaEquipo } from './jefaturaApi';

// Segundo paso del flujo, inmediatamente después de crear el proyecto:
// reutiliza la misma carga ponderada que ya ve el panel de jefatura
// (GET /especialistas/carga), no duplica esa lógica.
//
// servicioCodigo/servicioNombre/fechaDeseadaAutor: "información básica
// del proyecto" a pedido explícito del negocio, para que jefatura no
// tenga que salir del modal a buscarla — antes solo se mostraba el
// nombre del autor.
//
// Alcance deliberadamente angosto — a pedido explícito del negocio, este
// modal (vista rápida del Panel de Jefatura) asigna EXCLUSIVAMENTE al
// Especialista/Coordinador Responsable (proyectos.especialistaId, único
// campo que toca PATCH /proyectos/:id/especialista). No hay ni un solo
// <select> acá para editor/corrector/diseñador — esos roles del
// "Equipo asignado" solo se asignan desde dentro del proyecto
// (SeccionEquipo.tsx), donde jefatura ve el contexto completo de la
// ficha antes de repartir el resto del equipo.
export function AsignarEspecialistaCard({
  proyectoId,
  autorNombre,
  servicioCodigo,
  servicioNombre,
  fechaDeseadaAutor,
  onAsignado,
  onCancelar,
}: {
  proyectoId: string;
  autorNombre: string;
  servicioCodigo: string;
  servicioNombre: string;
  fechaDeseadaAutor: string | null;
  onAsignado: () => void;
  onCancelar: () => void;
}) {
  const cargaQuery = useQuery({ queryKey: ['especialistas', 'carga'], queryFn: fetchCargaEquipo });
  const [especialistaId, setEspecialistaId] = useState('');
  const queryClient = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => asignarEspecialista(proyectoId, especialistaId),
    onSuccess: () => {
      // La carga del especialista asignado cambió; "mis proyectos" del
      // especialista y el riesgo del equipo también dependen de esto.
      queryClient.invalidateQueries({ queryKey: ['especialistas', 'carga'] });
      queryClient.invalidateQueries({ queryKey: ['proyectos', 'riesgo'] });
      onAsignado();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutacion.mutate();
  }

  return (
    <div className="rounded-lg border border-dorado/40 bg-white p-4 shadow-sm">
      <h3 className="mb-2 font-medium text-tinta">Asignar Especialista / Coordinador Responsable — {autorNombre}</h3>
      <p className="mb-3 text-sm text-tinta/70">
        Elige quién queda a cargo del proyecto. El resto del equipo (editor, corrector, diseñador) se asigna después, desde el
        Equipo asignado dentro del proyecto.
      </p>

      <dl className="mb-4 grid grid-cols-1 gap-2 rounded-md bg-crema/30 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-tinta/50">Autor</dt>
          <dd className="text-tinta">{autorNombre}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-tinta/50">Servicio</dt>
          <dd className="text-tinta">
            {servicioCodigo} — {servicioNombre}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-tinta/50">Fecha deseada</dt>
          <dd className="text-tinta">{formatearFechaONull(fechaDeseadaAutor) ?? 'Sin definir'}</dd>
        </div>
      </dl>

      {cargaQuery.isLoading && <p className="text-sm text-tinta/70">Cargando equipo…</p>}
      {cargaQuery.isError && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar el equipo{cargaQuery.error instanceof Error ? `: ${cargaQuery.error.message}` : ''}.
        </p>
      )}

      {cargaQuery.data && cargaQuery.data.especialistas.length === 0 && (
        <p className="text-sm text-tinta/70">No hay especialistas registrados todavía.</p>
      )}

      {cargaQuery.data && cargaQuery.data.especialistas.length > 0 && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="asignar-especialista" className="mb-1 block text-sm font-medium text-tinta">
              Especialista / Coordinador Responsable
            </label>
            <select
              id="asignar-especialista"
              required
              value={especialistaId}
              onChange={(event) => setEspecialistaId(event.target.value)}
              className="rounded-md border border-tinta/20 px-3 py-2 text-sm text-tinta focus:border-dorado focus:outline-none focus:ring-1 focus:ring-dorado"
            >
              <option value="">Seleccionar…</option>
              {cargaQuery.data.especialistas.map((especialista) => (
                <option key={especialista.id} value={especialista.id}>
                  {especialista.nombre} (carga: {especialista.carga})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={mutacion.isPending}
            className="rounded-md bg-dorado px-4 py-2 text-sm font-medium text-tinta transition hover:brightness-95 disabled:opacity-60"
          >
            {mutacion.isPending ? 'Asignando…' : 'Asignar'}
          </button>
          <button type="button" onClick={onCancelar} className="text-xs text-tinta/70 underline hover:text-tinta">
            Hacerlo después
          </button>
          {mutacion.isError && (
            <span role="alert" className="text-xs text-red-600">
              No se pudo asignar{mutacion.error instanceof Error ? `: ${mutacion.error.message}` : ''}.
            </span>
          )}
        </form>
      )}
    </div>
  );
}
