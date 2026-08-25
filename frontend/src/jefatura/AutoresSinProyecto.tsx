import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchAutores } from '../autores/autoresApi';
import type { Proyecto } from '../types/api';
import { AsignarEspecialistaCard } from './AsignarEspecialistaCard';
import { CrearProyectoForm } from './CrearProyectoForm';
import { fetchAutoresSinProyecto } from './jefaturaApi';

interface ProyectoPendiente {
  id: string;
  autorNombre: string;
}

export function AutoresSinProyecto() {
  // Query para la lista de "contexto" visual (quiénes faltan por atender)
  const autoresQuery = useQuery({ queryKey: ['autores', 'sin-proyecto'], queryFn: fetchAutoresSinProyecto });
  // Query unificado para el formulario: trae a TODOS los autores
  const todosLosAutoresQuery = useQuery({ queryKey: ['autores'], queryFn: fetchAutores });
  
  // Unificamos el estado: el formulario está abierto o cerrado.
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [proyectoPendiente, setProyectoPendiente] = useState<ProyectoPendiente | null>(null);

  function handleProyectoCreado(proyecto: Proyecto, autorNombre: string) {
    setIsFormOpen(false);
    setProyectoPendiente({ id: proyecto.id, autorNombre });
  }

  return (
    <section className="flex flex-col rounded-xl border border-tinta/10 bg-white p-5 shadow-sm">
      <header className="mb-5 flex flex-col justify-between gap-4 border-b border-tinta/10 pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-tinta">Inicio de Proyectos</h2>
          <p className="text-sm text-tinta/70">Crea un nuevo proyecto y asígnale un especialista.</p>
        </div>

        {!proyectoPendiente && !isFormOpen && (
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 rounded-md bg-dorado px-5 py-2.5 text-sm font-bold text-tinta shadow-sm transition-all hover:scale-[1.02] hover:brightness-95"
          >
            + Crear Proyecto
          </button>
        )}
      </header>

      {proyectoPendiente && (
        <div className="animate-in fade-in slide-in-from-top-2 mb-4">
          <AsignarEspecialistaCard
            proyectoId={proyectoPendiente.id}
            autorNombre={proyectoPendiente.autorNombre}
            onAsignado={() => setProyectoPendiente(null)}
            onCancelar={() => setProyectoPendiente(null)}
          />
        </div>
      )}

      {/* Formulario unificado con TODOS los autores */}
      {!proyectoPendiente && isFormOpen && todosLosAutoresQuery.data && (
        <div className="animate-in fade-in slide-in-from-top-2 mb-6 rounded-lg border border-dorado/30 bg-dorado/5 p-4">
          <CrearProyectoForm
            autores={todosLosAutoresQuery.data.autores}
            onCreado={handleProyectoCreado}
            onCancelar={() => setIsFormOpen(false)}
          />
        </div>
      )}

      {/* Lista de contexto: Autores que esperan su primer proyecto */}
      <div className="mt-2 rounded-lg bg-crema/30 p-4">
        <h3 className="mb-3 text-sm font-semibold text-tinta">Autores en espera (Sin proyectos activos)</h3>
        
        {autoresQuery.isLoading && <p className="animate-pulse text-sm text-tinta/70">Revisando autores…</p>}
        
        {autoresQuery.isError && (
          <p role="alert" className="text-sm text-red-600">
            Error al cargar la lista{autoresQuery.error instanceof Error ? `: ${autoresQuery.error.message}` : ''}.
          </p>
        )}
        
        {autoresQuery.data && autoresQuery.data.autores.length === 0 && (
          <p className="text-sm text-tinta/70">Todos los autores registrados ya tienen al menos un proyecto asignado.</p>
        )}

        {autoresQuery.data && autoresQuery.data.autores.length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {autoresQuery.data.autores.map((autor) => (
              <li key={autor.id} className="flex flex-col justify-center rounded-lg border border-tinta/10 bg-white p-3 shadow-sm transition-colors hover:border-dorado/50">
                <span className="font-medium text-tinta">{autor.nombre}</span>
                <span className="mt-1 text-xs text-tinta/60">
                  {autor.email ?? 'Sin correo'} • {autor.pais ?? 'Sin país'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}