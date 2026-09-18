import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { FichaCompleta, ProyectoConRiesgo } from '../types/api';
import { MetricasEspecialista } from './MetricasEspecialista';
import { fetchFicha } from './proyectoDetalleApi';
import { fetchMisProyectos } from './proyectosApi';
import { RiesgoBadge } from './RiesgoBadge';

// AppLayout.tsx envuelve toda la app en <TopBar/> + <main className="mx-auto
// max-w-4xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">. Mismo breakout
// que AutoresPage.tsx/PanelJefaturaPage.tsx (ml/mr negativos + w-screen,
// -my-6 cancela la POSICIÓN del padding vertical de ese <main>,
// empujando hacia arriba) — un layout con sidebar de 256px + un Kanban
// de columnas de 320px necesita el ancho real de la pantalla.
const FULL_BLEED = 'ml-[calc(-50vw+50%)] mr-[calc(-50vw+50%)] w-screen -my-6';

// h-full solo (sin esto) deja una franja de 48px de bg-crema sin cubrir
// en el fondo (ver AutoresPage.tsx para la explicación completa): h-full
// resuelve contra la caja de CONTENIDO de <main> (ya sin su propio
// padding, py-6 = 48px totales), y -my-6 de arriba solo corrige
// posición, no alto. +3rem = ese mismo padding total de <main>.
const ALTO_LLENO_MAIN = 'h-[calc(100%+3rem)]';

const NAV_ACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 bg-dorado/10 text-dorado rounded-xl font-semibold text-sm border border-dorado/20 transition-all text-left';
const NAV_INACTIVO =
  'w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl font-medium text-sm transition-all text-left';

type VistaEspecialista = 'kanban' | 'metricas';

type FaseKanban = 'Inicio' | 'Edición' | 'Corrección' | 'Diseño';

const FASES_KANBAN: FaseKanban[] = ['Inicio', 'Edición', 'Corrección', 'Diseño'];

// % de la barra de progreso mini de cada tarjeta: no hay un porcentaje
// real de avance por proyecto en el sistema, así que se deriva de la
// misma columna en la que ya cayó (mismo criterio, se ve en la barra en
// vez de solo en la posición) — no es un valor inventado por tarjeta.
const PROGRESO_POR_FASE: Record<FaseKanban, number> = {
  Inicio: 25,
  Edición: 50,
  Corrección: 75,
  Diseño: 100,
};

// No existe un campo "fase actual" persistido por proyecto — se infiere
// de la ficha, mismo tipo de heurística que ya se usó (y luego se quitó
// del Stepper de ProyectoDetallePage.tsx a pedido explícito, pero este
// es un uso distinto: acá es lo único que puede alimentar un Kanban por
// fases sin inventar datos). Diseño > Corrección > Inicio/Edición, en
// ese orden, porque son señales acumulativas (si ya hay brief o
// propuestas de diseño, seguro ya pasó por corrección).
function calcularFaseKanban(ficha: FichaCompleta | undefined): FaseKanban {
  if (!ficha) return 'Inicio';

  const enDiseno = Boolean(ficha.disenoBriefCreativo) || ficha.disenoPropuestas.length > 0;
  if (enDiseno) return 'Diseño';

  const enCorreccion = Boolean(ficha.correccionTripaCompleta) || Boolean(ficha.correccionPreliminares) || Boolean(ficha.correccionCubiertaExtendida);
  if (enCorreccion) return 'Corrección';

  const inicioCompleto = ficha.capitulosPactados != null || ficha.paginasPactadas != null;

  return inicioCompleto ? 'Edición' : 'Inicio';
}

function TarjetaKanban({ proyecto, progreso }: { proyecto: ProyectoConRiesgo; progreso: number }) {
  return (
    <Link
      to={`/proyectos/${proyecto.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-dorado/50 hover:shadow-md"
    >
      <div className="flex flex-col">
        <h4 className="line-clamp-1 text-sm font-bold text-gray-900 transition-colors group-hover:text-dorado">
          {proyecto.titulo ?? proyecto.autor.nombre}
        </h4>
        <p className="text-xs text-gray-500">{proyecto.titulo ? `Autor: ${proyecto.autor.nombre}` : proyecto.servicio.nombre}</p>
      </div>

      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div className="h-1.5 rounded-full bg-dorado" style={{ width: `${progreso}%` }} />
      </div>

      <div>
        <RiesgoBadge riesgo={proyecto.riesgo} />
      </div>
    </Link>
  );
}

function ColumnaKanban({ fase, proyectos }: { fase: FaseKanban; proyectos: ProyectoConRiesgo[] }) {
  return (
    <div className="flex max-h-full w-80 flex-shrink-0 flex-col overflow-hidden rounded-xl border-none bg-gray-200/60">
      <div className="flex items-center justify-between p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-700">{fase}</h3>
        <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">
          {proyectos.length}
        </span>
      </div>

      <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {proyectos.length === 0 ? (
          <p className="p-2 text-center text-xs text-gray-400">Sin proyectos aquí</p>
        ) : (
          proyectos.map((proyecto) => <TarjetaKanban key={proyecto.id} proyecto={proyecto} progreso={PROGRESO_POR_FASE[fase]} />)
        )}
      </div>
    </div>
  );
}

// Tablero Kanban del especialista: GET /proyectos/mios (server/routes/
// proyectos.routes.ts) ya filtra por especialistaId === usuario logueado
// y por estado activo — la "Restricción" del pedido de que solo vea sus
// propios proyectos ya está garantizada por el backend, no hace falta
// filtrar de nuevo acá. Extraído a su propio componente (antes era el
// cuerpo entero de MisProyectosPage) para poder alternarlo con la vista
// de Métricas sin desmontar/remontar el layout del sidebar.
function TableroKanban() {
  const misProyectosQuery = useQuery({ queryKey: ['proyectos', 'mios'], queryFn: fetchMisProyectos });
  const proyectos = misProyectosQuery.data?.proyectos ?? [];

  // Misma queryKey que ProyectoDetallePage.tsx (['ficha', id]) — al
  // hacer clic en una tarjeta, el detalle abre con la ficha ya en caché,
  // sin pedirla de nuevo.
  const fichaQueries = useQueries({
    queries: proyectos.map((proyecto) => ({
      queryKey: ['ficha', proyecto.id],
      queryFn: () => fetchFicha(proyecto.id),
    })),
  });

  if (misProyectosQuery.isLoading) {
    return <p className="p-6 text-tinta/70">Cargando tu portafolio…</p>;
  }

  if (misProyectosQuery.isError) {
    return (
      <p role="alert" className="p-6 text-red-600">
        No se pudieron cargar tus proyectos
        {misProyectosQuery.error instanceof Error ? `: ${misProyectosQuery.error.message}` : ''}.
      </p>
    );
  }

  const fichasCargando = fichaQueries.some((query) => query.isLoading);

  const proyectosPorFase: Record<FaseKanban, ProyectoConRiesgo[]> = { Inicio: [], Edición: [], Corrección: [], Diseño: [] };
  if (!fichasCargando) {
    proyectos.forEach((proyecto, indice) => {
      const fase = calcularFaseKanban(fichaQueries[indice]?.data?.ficha);
      proyectosPorFase[fase].push(proyecto);
    });
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col p-6">
      <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-900">
        <span className="h-2 w-2 rounded-full bg-dorado" /> Mis Proyectos Activos
      </h2>

      {fichasCargando && <p className="text-sm text-tinta/70">Organizando tablero…</p>}

      {!fichasCargando && proyectos.length === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white">
          <p className="text-sm text-gray-500">No tienes proyectos activos todavía.</p>
        </div>
      )}

      {!fichasCargando && proyectos.length > 0 && (
        <div className="flex flex-1 gap-6 overflow-x-auto pb-4">
          {FASES_KANBAN.map((fase) => (
            <ColumnaKanban key={fase} fase={fase} proyectos={proyectosPorFase[fase]} />
          ))}
        </div>
      )}
    </div>
  );
}

// Panel Operativo del especialista: mismo patrón de sidebar que
// AutoresPage.tsx (Comercial) — dos módulos, "Tablero Kanban" (el
// tablero que ya funcionaba, ahora encajado en un marco con sidebar en
// vez de flotar solo) y "Métricas de Producción" (placeholder, sin
// datos reales que mostrar todavía).
export function MisProyectosPage() {
  const [vistaActiva, setVistaActiva] = useState<VistaEspecialista>('kanban');

  return (
    <div className={`${FULL_BLEED} ${ALTO_LLENO_MAIN} flex overflow-hidden bg-[#F8F9FA]`}>
      <aside className="z-20 hidden h-full w-64 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900 shadow-xl md:flex">
        <div className="px-6 py-8">
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-gray-500">Panel Operativo</p>
          <nav className="space-y-2">
            <button type="button" onClick={() => setVistaActiva('kanban')} className={vistaActiva === 'kanban' ? NAV_ACTIVO : NAV_INACTIVO}>
              {vistaActiva === 'kanban' && <span className="h-1.5 w-1.5 rounded-full bg-dorado" />}
              Tablero Kanban
            </button>
            <button
              type="button"
              onClick={() => setVistaActiva('metricas')}
              className={vistaActiva === 'metricas' ? NAV_ACTIVO : NAV_INACTIVO}
            >
              {vistaActiva === 'metricas' && <span className="h-1.5 w-1.5 rounded-full bg-dorado" />}
              Métricas de Producción
            </button>
          </nav>
        </div>
      </aside>

      {/* AppLayout.tsx ya envuelve el Outlet en un <main> — dos <main> anidados
          no son válidos (landmark duplicado), así que este contenedor de
          scroll independiente es un <div> con las mismas clases (mismo
          criterio que AutoresPage.tsx). */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#F4F5F8]">
        {vistaActiva === 'kanban' && <TableroKanban />}
        {vistaActiva === 'metricas' && <MetricasEspecialista />}
      </div>
    </div>
  );
}
