import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatearFecha } from '../proyectos/campos';
import type { EstadoTrabajoCapitulo, TrabajoEditorCapitulo } from '../types/api';
import { fetchMisTrabajosEdicion } from './editorApi';

// Mismo breakout de ancho completo que MisProyectosPage.tsx (especialista)
// — ver ese archivo para la explicación completa del truco FULL_BLEED/
// ALTO_LLENO_MAIN contra el <main> centrado de AppLayout.tsx.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';
const ALTO_LLENO_MAIN = 'h-[calc(100%+3rem)]';

const ESTADO_INFO: Record<EstadoTrabajoCapitulo, { etiqueta: string; dot: string; badge: string }> = {
  feedback_para_aplicar: { etiqueta: 'Feedback para aplicar', dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
  esperando_autor: { etiqueta: 'Esperando al autor', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800' },
  por_iniciar: { etiqueta: 'Por iniciar', dot: 'bg-blue-400', badge: 'bg-blue-100 text-blue-800' },
  entregado: { etiqueta: 'Entregado', dot: 'bg-green-500', badge: 'bg-green-100 text-green-800' },
};

const ORDEN_KPI: EstadoTrabajoCapitulo[] = ['feedback_para_aplicar', 'esperando_autor', 'por_iniciar', 'entregado'];

function TarjetaKpi({ estado, total }: { estado: EstadoTrabajoCapitulo; total: number }) {
  const info = ESTADO_INFO[estado];
  return (
    <div className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${info.dot}`} />
      <div>
        <p className="text-2xl font-bold text-gray-900">{total}</p>
        <p className="text-xs font-medium text-gray-500">{info.etiqueta}</p>
      </div>
    </div>
  );
}

function FilaTrabajo({ trabajo }: { trabajo: TrabajoEditorCapitulo }) {
  const info = ESTADO_INFO[trabajo.estado];
  return (
    <Link
      to={`/proyectos/${trabajo.proyectoId}`}
      className="grid grid-cols-2 gap-3 border-b border-gray-100 p-4 text-sm transition-colors last:border-0 hover:bg-gray-50 sm:grid-cols-6 sm:items-center sm:gap-4"
    >
      <div className="col-span-2 sm:col-span-2">
        <p className="font-semibold text-gray-900">{trabajo.autorNombre}</p>
        <p className="text-xs text-gray-500">
          #{trabajo.proyectoCodigo} · {trabajo.servicioCodigo} · Cap. {trabajo.numero}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Envío autor</p>
        <p className="text-gray-700">{formatearFecha(trabajo.fechaEnvioAutor)}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Pautada feedback</p>
        <p className="text-gray-700">{formatearFecha(trabajo.fechaPautadaFeedback)}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Respuesta autor</p>
        <p className="text-gray-700">{formatearFecha(trabajo.fechaRespuestaReal)}</p>
      </div>
      <div className="flex justify-start sm:justify-end">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${info.badge}`}>{info.etiqueta}</span>
      </div>
    </Link>
  );
}

// "Mis Trabajos de Edición" (Fase 5, 5A): a diferencia del Kanban por
// PROYECTO que usan especialista/editor hoy (MisProyectosPage.tsx,
// reutilizado tal cual por EditorHomePage.tsx antes de esta pantalla),
// el editor necesita ver qué CAPÍTULO concreto requiere su atención
// ahora — GET /capitulos/mios (listarTrabajosEditor) ya resuelve y
// prioriza esa pregunta en el backend, acá solo se pinta. Clic en una
// fila abre el proyecto completo (ProyectoDetallePage → SeccionEdicion)
// para registrar envíos/feedback — esta pantalla es la bandeja de
// entrada, no un formulario de edición duplicado.
export function MisTrabajosEdicionPage() {
  const trabajosQuery = useQuery({ queryKey: ['capitulos', 'mios'], queryFn: fetchMisTrabajosEdicion });
  const trabajos = trabajosQuery.data?.trabajos ?? [];

  const totalesPorEstado: Record<EstadoTrabajoCapitulo, number> = {
    feedback_para_aplicar: 0,
    esperando_autor: 0,
    por_iniciar: 0,
    entregado: 0,
  };
  trabajos.forEach((trabajo) => {
    totalesPorEstado[trabajo.estado] += 1;
  });

  return (
    <div className={`${FULL_BLEED} ${ALTO_LLENO_MAIN} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden h-full w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="px-6 py-8">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-gray-500">Panel de Edición</p>
          <nav className="space-y-2">
            <span className="flex w-full items-center gap-3 rounded-xl border border-dorado/20 bg-dorado/10 px-4 py-3 text-left text-sm font-semibold text-dorado">
              <span className="h-1.5 w-1.5 rounded-full bg-dorado" />
              Mis Trabajos
            </span>
          </nav>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#F4F5F8]">
        <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col p-6">
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <span className="h-2 w-2 rounded-full bg-dorado" /> Mis Trabajos de Edición
          </h2>

          {trabajosQuery.isLoading && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-tinta/70">Cargando tus capítulos…</p>
            </div>
          )}

          {trabajosQuery.isError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              No se pudieron cargar tus trabajos
              {trabajosQuery.error instanceof Error ? `: ${trabajosQuery.error.message}` : ''}.
            </p>
          )}

          {trabajosQuery.data && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ORDEN_KPI.map((estado) => (
                  <TarjetaKpi key={estado} estado={estado} total={totalesPorEstado[estado]} />
                ))}
              </div>

              {trabajos.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white">
                  <p className="text-sm text-gray-500">No tienes capítulos activos todavía.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  {trabajos.map((trabajo) => (
                    <FilaTrabajo key={`${trabajo.proyectoId}-${trabajo.numero}`} trabajo={trabajo} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
