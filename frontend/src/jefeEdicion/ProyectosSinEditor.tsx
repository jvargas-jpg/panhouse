import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AsignarEditorCard } from './AsignarEditorCard';
import { fetchProyectosSinEditor } from './jefeEdicionApi';

// Punto de partida del flujo "ver pendiente → asignar por carga" para
// jefe_edicion — mismo concepto que AutoresSinProyecto (jefatura), pero
// acá el proyecto ya existe, no hay paso de creación ni de búsqueda: un
// botón "Asignar editor" por fila alcanza, cada fila ya es un proyecto
// concreto. Solo una asignación abierta a la vez.
//
// Limitación conocida: no existe todavía un campo "manuscrito
// recibido" en el modelo, así que esta lista incluye cualquier
// proyecto activo sin editor, aunque el manuscrito ni siquiera haya
// llegado.
export function ProyectosSinEditor() {
  const proyectosQuery = useQuery({ queryKey: ['proyectos', 'sin-editor'], queryFn: fetchProyectosSinEditor });
  const [proyectoEnAsignacionId, setProyectoEnAsignacionId] = useState<string | null>(null);

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold text-tinta">Proyectos sin editor asignado</h2>

      {proyectosQuery.isLoading && <p className="text-tinta/70">Cargando proyectos…</p>}
      {proyectosQuery.isError && (
        <p role="alert" className="text-red-600">
          No se pudieron cargar los proyectos{proyectosQuery.error instanceof Error ? `: ${proyectosQuery.error.message}` : ''}.
        </p>
      )}
      {proyectosQuery.data && proyectosQuery.data.proyectos.length === 0 && (
        <p className="text-tinta/70">Todos los proyectos activos ya tienen editor.</p>
      )}

      {proyectosQuery.data && proyectosQuery.data.proyectos.length > 0 && (
        <ul className="space-y-2">
          {proyectosQuery.data.proyectos.map((proyecto) => (
            <li key={proyecto.id} className="rounded-lg border border-tinta/10 bg-white p-3 text-sm shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-tinta">{proyecto.autor.nombre}</span>
                  <span className="ml-3 text-tinta/70">
                    {proyecto.servicio.codigo} — {proyecto.servicio.nombre}
                  </span>
                </div>
                {proyectoEnAsignacionId !== proyecto.id && (
                  <button
                    type="button"
                    onClick={() => setProyectoEnAsignacionId(proyecto.id)}
                    className="shrink-0 rounded-md bg-dorado px-3 py-1.5 text-sm font-medium text-tinta transition hover:brightness-95"
                  >
                    Asignar editor
                  </button>
                )}
              </div>

              {proyectoEnAsignacionId === proyecto.id && (
                <div className="mt-3">
                  <AsignarEditorCard
                    proyectoId={proyecto.id}
                    autorNombre={proyecto.autor.nombre}
                    onAsignado={() => setProyectoEnAsignacionId(null)}
                    onCancelar={() => setProyectoEnAsignacionId(null)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
