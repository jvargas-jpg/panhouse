import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal } from '../autores/Modal';
import type { ProyectoConRiesgo } from '../types/api';
import { AsignarEspecialistaCard } from './AsignarEspecialistaCard';
import { fetchCargaEquipo, fetchProyectosRiesgo, fetchTodosLosProyectos } from './jefaturaApi';
import { ProyectoCardJefatura } from './ProyectoCardJefatura';
import { SeguimientoPage } from './SeguimientoPage';

// AppLayout.tsx envuelve toda la app en <TopBar/> + <main className="mx-auto
// max-w-4xl px-4 py-6 sm:px-6">. Mismo breakout que AutoresPage.tsx
// (autores/): ml/mr negativos + w-screen escapan la columna angosta de
// 896px, -my-6 cancela el padding vertical de ese <main>.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';

// Alto real del <header> de TopBar (medido: 59px, ver TopBar.tsx).
const ALTO_SIDEBAR = 'h-[calc(100vh-59px)]';

const NAV_ACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 bg-dorado/10 text-dorado rounded-xl font-semibold text-sm border border-dorado/20 transition-all text-left';
const NAV_INACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl font-medium text-sm transition-all text-left';

type Vista = 'dashboard' | 'seguimiento';

// Regla de negocio confirmada: jefe_area NUNCA crea proyectos — solo
// los recibe ya creados por comercial (ver AutoresPage.tsx) y reparte
// el trabajo. Por eso el Dashboard no tiene botón "+ Nuevo Proyecto" ni
// el formulario de creación que tenía antes (AutoresSinProyecto.tsx/
// CrearProyectoForm.tsx, eliminados) — es una bandeja de entrada, no un
// punto de alta.
//
// Shell con sidebar (mismo patrón que AutoresPage.tsx): "Dashboard" es
// el contenido que ya existía (bandeja + línea de producción);
// "Control de Tiempos" es la matriz de seguimiento nueva — dos vistas
// del mismo espacio de trabajo de jefe_area, no dos pantallas sueltas.
export function PanelJefaturaPage() {
  const [vistaActiva, setVistaActiva] = useState<Vista>('dashboard');

  const carga = useQuery({ queryKey: ['especialistas', 'carga'], queryFn: fetchCargaEquipo });
  const riesgo = useQuery({ queryKey: ['proyectos', 'riesgo'], queryFn: fetchProyectosRiesgo });
  const todos = useQuery({ queryKey: ['proyectos', 'todos'], queryFn: fetchTodosLosProyectos });

  const [proyectoParaAsignar, setProyectoParaAsignar] = useState<ProyectoConRiesgo | null>(null);

  const proyectosActivos = riesgo.data?.proyectos ?? [];
  const nuevosSinAsignar = proyectosActivos.filter((proyecto) => proyecto.especialistaId === null);
  const enCurso = proyectosActivos.filter((proyecto) => proyecto.especialistaId !== null);
  const proyectosConAlerta = proyectosActivos.filter((p) => p.riesgo.vencido || p.riesgo.enRiesgo);

  const totalProyectos = todos.data?.proyectos.length ?? 0;
  const totalEspecialistas = carga.data?.especialistas.length ?? 0;

  return (
    <div className={`${FULL_BLEED} ${ALTO_SIDEBAR} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="flex h-20 items-center border-b border-gray-800 px-6">
          <h1 className="text-xl font-light uppercase tracking-widest text-white">
            Pan<span className="font-bold text-dorado">House</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-8">
          <button onClick={() => setVistaActiva('dashboard')} className={vistaActiva === 'dashboard' ? NAV_ACTIVO : NAV_INACTIVO}>
            {vistaActiva === 'dashboard' && <span className="h-1.5 w-1.5 rounded-full bg-dorado" />}
            Dashboard
          </button>

          <button onClick={() => setVistaActiva('seguimiento')} className={vistaActiva === 'seguimiento' ? NAV_ACTIVO : NAV_INACTIVO}>
            {vistaActiva === 'seguimiento' && <span className="h-1.5 w-1.5 rounded-full bg-dorado" />}
            Control de Tiempos
          </button>
        </nav>
      </aside>

      {/* AppLayout.tsx ya envuelve el Outlet en un <main> — dos <main> anidados
          no son válidos (landmark duplicado), así que este contenedor de
          scroll independiente es un <div> con las mismas clases. */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {vistaActiva === 'seguimiento' && <SeguimientoPage />}

        {vistaActiva === 'dashboard' && (
          <div className="animate-in fade-in space-y-8 p-6 duration-500 md:p-10">
            <header className="flex flex-col gap-2 border-b border-tinta/10 pb-4">
              <h1 className="text-2xl font-bold text-tinta">Panel de Jefatura</h1>
              <p className="text-sm text-tinta/70">Bandeja de proyectos recibidos de Comercial y control de la línea de producción.</p>
            </header>

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

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Nuevos Proyectos por Asignar
              </h2>

              {riesgo.isLoading && <p className="animate-pulse text-sm text-tinta/70">Cargando proyectos…</p>}
              {riesgo.isError && (
                <p role="alert" className="text-sm text-red-600">
                  No se pudieron cargar los proyectos{riesgo.error instanceof Error ? `: ${riesgo.error.message}` : ''}.
                </p>
              )}

              {riesgo.data && nuevosSinAsignar.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
                  <p className="text-sm text-gray-500">No hay proyectos nuevos pendientes de revisión.</p>
                </div>
              )}

              {nuevosSinAsignar.length > 0 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {nuevosSinAsignar.map((proyecto) => (
                    <ProyectoCardJefatura
                      key={proyecto.id}
                      proyecto={proyecto}
                      accion={
                        <button
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setProyectoParaAsignar(proyecto);
                          }}
                          className="flex-shrink-0 rounded-lg p-2 text-gray-400 transition-colors hover:bg-dorado/10 hover:text-dorado"
                          title="Asignar especialista"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a3 3 0 11-6 0 3 3 0 016 0zM3 20a6 6 0 0112 0v1H3v-1z"
                            />
                          </svg>
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-4 mt-12 flex items-center gap-2 text-xl font-bold text-gray-900">
                <span className="h-2 w-2 rounded-full bg-dorado" />
                Proyectos en Curso
              </h2>

              {riesgo.data && enCurso.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
                  <p className="text-sm text-gray-500">Ningún proyecto en curso todavía.</p>
                </div>
              )}

              {enCurso.length > 0 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                  {enCurso.map((proyecto) => (
                    <ProyectoCardJefatura key={proyecto.id} proyecto={proyecto} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {proyectoParaAsignar && (
        <Modal titulo="Asignar Especialista" onClose={() => setProyectoParaAsignar(null)}>
          <AsignarEspecialistaCard
            proyectoId={proyectoParaAsignar.id}
            autorNombre={proyectoParaAsignar.autor.nombre}
            onAsignado={() => setProyectoParaAsignar(null)}
            onCancelar={() => setProyectoParaAsignar(null)}
          />
        </Modal>
      )}
    </div>
  );
}
