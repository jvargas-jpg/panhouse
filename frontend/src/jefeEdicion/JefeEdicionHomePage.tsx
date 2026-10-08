import { RevisionesCubiertaPanel } from '../proyectos/SeccionDisenoOperativa';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal } from '../autores/Modal';
import type { ProyectoPendienteSeccion1 } from '../types/api';
import { AsignarEditorCard } from './AsignarEditorCard';
import { fetchCargaEditores, fetchProyectosSinEditor } from './jefeEdicionApi';

// Mismo breakout de ancho completo que PanelJefaturaPage.tsx — ver ese
// archivo para la explicación completa del truco FULL_BLEED/ALTO_LLENO_MAIN
// contra el <main> centrado de AppLayout.tsx.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';
const ALTO_LLENO_MAIN = 'h-[calc(100%+3rem)]';

function coincide(proyecto: ProyectoPendienteSeccion1, termino: string): boolean {
  const q = termino.trim().toLowerCase();
  if (!q) return true;
  return (
    proyecto.autor.nombre.toLowerCase().includes(q) ||
    proyecto.servicio.codigo.toLowerCase().includes(q) ||
    proyecto.servicio.nombre.toLowerCase().includes(q)
  );
}

// Días completos desde solicitadoEn hasta ahora — mismo redondeo hacia
// abajo que el resto de la app usa para "hace Nd" (sin horas/minutos,
// no hay ese nivel de precisión operativa en este flujo).
function diasDesde(fechaIso: string): number {
  const ms = Date.now() - new Date(fechaIso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function TarjetaProyectoSinEditor({ proyecto, onAsignar }: { proyecto: ProyectoPendienteSeccion1; onAsignar: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-dorado/40 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-gray-900">{proyecto.autor.nombre}</p>
        <p className="text-sm text-gray-500">
          {proyecto.servicio.codigo} — {proyecto.servicio.nombre}
        </p>
        {proyecto.solicitadoEn ? (
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Solicitado hace {diasDesde(proyecto.solicitadoEn)}d
          </span>
        ) : (
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            Sin solicitud todavía
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onAsignar}
        className="shrink-0 rounded-lg bg-dorado px-4 py-2 text-sm font-semibold text-tinta shadow-sm transition hover:brightness-95"
      >
        Asignar editor
      </button>
    </div>
  );
}

// Dashboard de jefe_edicion (Fase 5, 5A) — mismo patrón de shell con
// sidebar que PanelJefaturaPage.tsx (jefe_area): KPIs arriba, bandeja
// de acción abajo. Antes esta pantalla era solo un <h1> + la lista
// plana de ProyectosSinEditor.tsx (sin distinguir qué proyecto fue
// REALMENTE solicitado por un especialista de cuál simplemente no
// tiene editor todavía) — ahora usa solicitadoEn (ver GET /proyectos/sin-editor,
// server/helpers/proyectos.ts:ProyectoSinEditor) para priorizar: las
// solicitudes explícitas suben primero, ordenadas de la más antigua a
// la más nueva (la que lleva más tiempo esperando es la más urgente).
export function JefeEdicionHomePage() {
  const proyectosQuery = useQuery({ queryKey: ['proyectos', 'sin-editor'], queryFn: fetchProyectosSinEditor });
  const cargaQuery = useQuery({ queryKey: ['editores', 'carga'], queryFn: fetchCargaEditores });

  const [proyectoParaAsignar, setProyectoParaAsignar] = useState<ProyectoPendienteSeccion1 | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const proyectos = proyectosQuery.data?.proyectos ?? [];
  const filtrados = proyectos.filter((proyecto) => coincide(proyecto, searchTerm));

  const solicitados = filtrados
    .filter((proyecto) => proyecto.solicitadoEn)
    .sort((a, b) => new Date(a.solicitadoEn!).getTime() - new Date(b.solicitadoEn!).getTime());
  const sinSolicitud = filtrados.filter((proyecto) => !proyecto.solicitadoEn);

  const totalSinEditor = proyectos.length;
  const totalSolicitados = proyectos.filter((proyecto) => proyecto.solicitadoEn).length;
  const totalEditores = cargaQuery.data?.editores.length ?? 0;

  return (
    <div className={`${FULL_BLEED} ${ALTO_LLENO_MAIN} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden h-full w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="flex h-20 items-center border-b border-gray-800 px-6">
          <h1 className="text-xl font-light uppercase tracking-widest text-white">
            Pan<span className="font-bold text-dorado">House</span>
          </h1>
        </div>

        <nav className="flex-1 space-y-2 px-4 py-8">
          <span className="flex w-full items-center gap-3 rounded-xl border border-dorado/20 bg-dorado/10 px-4 py-3 text-left text-sm font-semibold text-dorado">
            <span className="h-1.5 w-1.5 rounded-full bg-dorado" />
            Bandeja de Edición
          </span>
        </nav>
      </aside>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="animate-fade-in space-y-8 p-6 duration-500 md:p-10">
          <header className="flex flex-col gap-2 border-b border-tinta/10 pb-4">
            <h1 className="text-2xl font-bold text-tinta">Panel de Jefatura de Edición</h1>
            <p className="text-sm text-tinta/70">Bandeja de proyectos que necesitan editor y carga del equipo.</p>
          </header>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col rounded-xl border border-tinta/10 bg-tinta p-5 text-crema shadow-sm transition-transform hover:scale-[1.02]">
              <span className="text-sm font-medium text-crema/70">Sin editor asignado</span>
              <span className="mt-2 text-3xl font-bold text-dorado">{totalSinEditor}</span>
            </div>

            <div className="flex flex-col rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm transition-transform hover:scale-[1.02]">
              <span className="text-sm font-medium text-red-800/70">Solicitudes pendientes</span>
              <span className="mt-2 text-3xl font-bold text-red-600">{totalSolicitados}</span>
            </div>

            <div className="flex flex-col rounded-xl border border-dorado/30 bg-dorado/10 p-5 shadow-sm transition-transform hover:scale-[1.02]">
              <span className="text-sm font-medium text-tinta/70">Editores activos</span>
              <span className="mt-2 text-3xl font-bold text-tinta">{totalEditores}</span>
            </div>
          </section>

          <input
            type="search"
            placeholder="Buscar por autor o servicio..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none transition-all focus:border-dorado focus:ring-2 focus:ring-dorado/40"
          />

          <RevisionesCubiertaPanel interna />
          {proyectosQuery.isLoading && <p className="animate-pulse text-sm text-tinta/70">Cargando proyectos…</p>}
          {proyectosQuery.isError && (
            <p role="alert" className="text-sm text-red-600">
              No se pudieron cargar los proyectos{proyectosQuery.error instanceof Error ? `: ${proyectosQuery.error.message}` : ''}.
            </p>
          )}

          {proyectosQuery.data && (
            <>
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                  Solicitudes pendientes de asignación
                </h2>

                {solicitados.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
                    <p className="text-sm text-gray-500">
                      {searchTerm ? `Ninguna solicitud coincide con "${searchTerm}".` : 'No hay solicitudes de editor pendientes.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {solicitados.map((proyecto) => (
                      <TarjetaProyectoSinEditor key={proyecto.id} proyecto={proyecto} onAsignar={() => setProyectoParaAsignar(proyecto)} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="mb-4 mt-12 flex items-center gap-2 text-xl font-bold text-gray-900">
                  <span className="h-2 w-2 rounded-full bg-dorado" />
                  Sin editor (aún no solicitado)
                </h2>

                {sinSolicitud.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
                    <p className="text-sm text-gray-500">
                      {searchTerm ? `Ningún proyecto coincide con "${searchTerm}".` : 'Todos los proyectos sin editor ya fueron solicitados.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {sinSolicitud.map((proyecto) => (
                      <TarjetaProyectoSinEditor key={proyecto.id} proyecto={proyecto} onAsignar={() => setProyectoParaAsignar(proyecto)} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {proyectoParaAsignar && (
        <Modal titulo={`Asignar editor — ${proyectoParaAsignar.autor.nombre}`} onClose={() => setProyectoParaAsignar(null)}>
          <AsignarEditorCard
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
