import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ProyectoCard } from '../proyectos/ProyectoCard';
import { EstadoBadge } from '../proyectos/EstadoBadge'; // <-- Ajustado según nuestra corrección anterior
import { AutoresSinProyecto } from './AutoresSinProyecto';
import { fetchCargaEquipo, fetchProyectosRiesgo, fetchTodosLosProyectos } from './jefaturaApi';

export function PanelJefaturaPage() {
  const carga = useQuery({ queryKey: ['especialistas', 'carga'], queryFn: fetchCargaEquipo });
  const riesgo = useQuery({ queryKey: ['proyectos', 'riesgo'], queryFn: fetchProyectosRiesgo });
  const todos = useQuery({ queryKey: ['proyectos', 'todos'], queryFn: fetchTodosLosProyectos });

  const proyectosConAlerta = riesgo.data?.proyectos.filter((p) => p.riesgo.vencido || p.riesgo.enRiesgo) ?? [];
  const totalProyectos = todos.data?.proyectos.length ?? 0;
  const totalEspecialistas = carga.data?.especialistas.length ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2 border-b border-tinta/10 pb-4">
        <h1 className="text-2xl font-bold text-tinta">Panel de Jefatura</h1>
        <p className="text-sm text-tinta/70">Resumen operativo y control de proyectos activos.</p>
      </header>

      {/* --- SECCIÓN 1: KPIs (Métricas visuales) --- */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col rounded-xl border border-tinta/10 bg-tinta p-5 text-crema shadow-sm transition-transform hover:scale-[1.02]">
          <span className="text-sm font-medium text-crema/70">Total Proyectos</span>
          <span className="mt-2 text-3xl font-bold text-dorado">{totalProyectos}</span>
        </div>
        
        <div className="flex flex-col rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm transition-transform hover:scale-[1.02]">
          <span className="text-sm font-medium text-red-800/70">En Riesgo / Vencidos</span>
          <span className="mt-2 text-3xl font-bold text-red-600">{proyectosConAlerta.length}</span>
        </div>

        <div className="flex flex-col rounded-xl border border-dorado/30 bg-dorado/10 p-5 shadow-sm transition-transform hover:scale-[1.02]">
          <span className="text-sm font-medium text-tinta/70">Especialistas Activos</span>
          <span className="mt-2 text-3xl font-bold text-tinta">{totalEspecialistas}</span>
        </div>
      </section>

      {/* --- SECCIÓN 2: Acción Inmediata --- */}
      <AutoresSinProyecto />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* --- SECCIÓN 3: Carga del Equipo --- */}
        <section className="flex flex-col rounded-xl border border-tinta/10 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-tinta">Carga del equipo</h2>
          
          {carga.isLoading && <p className="animate-pulse text-sm text-tinta/70">Calculando cargas…</p>}
          
          {carga.data && carga.data.especialistas.length > 0 && (
            <ul className="flex flex-col gap-3">
              {carga.data.especialistas.map((especialista) => (
                <li key={especialista.id} className="flex items-center justify-between rounded-lg bg-crema/50 p-3 hover:bg-crema">
                  <div className="flex flex-col">
                    <span className="font-medium text-tinta">{especialista.nombre}</span>
                    <span className="text-xs text-tinta/60">{especialista.email}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="rounded-full bg-dorado px-3 py-1 text-xs font-bold text-tinta shadow-sm">
                      {especialista.carga} pts
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- SECCIÓN 4: Proyectos en Riesgo --- */}
        <section className="flex flex-col rounded-xl border border-tinta/10 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-tinta">Atención requerida</h2>
          
          {riesgo.isLoading && <p className="animate-pulse text-sm text-tinta/70">Revisando plazos…</p>}
          
          {riesgo.data && proyectosConAlerta.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-green-200 bg-green-50 p-6 text-center">
              <span className="text-sm font-medium text-green-800">¡Todo al día!</span>
              <span className="mt-1 text-xs text-green-600">Ningún proyecto presenta retrasos.</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {proyectosConAlerta.map((proyecto) => (
                <ProyectoCard key={proyecto.id} proyecto={proyecto} />
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* --- SECCIÓN 5: Catálogo Histórico --- */}
      <section className="rounded-xl border border-tinta/10 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-tinta">Catálogo de Proyectos</h2>
        
        {todos.isLoading && <p className="animate-pulse text-sm text-tinta/70">Cargando catálogo…</p>}
        
        {todos.data && todos.data.proyectos.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-tinta/10">
            <ul className="divide-y divide-tinta/10 bg-white">
              {todos.data.proyectos.map((proyecto) => (
                <li key={proyecto.id} className="transition-colors hover:bg-crema/80">
                  <Link to={`/proyectos/${proyecto.id}`} className="flex items-center justify-between p-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-tinta">{proyecto.autor.nombre}</span>
                      <span className="text-xs font-medium uppercase tracking-wider text-tinta/50 mt-1">
                        {proyecto.servicio.codigo} — {proyecto.servicio.nombre}
                      </span>
                    </div>
                    <EstadoBadge estado={proyecto.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}