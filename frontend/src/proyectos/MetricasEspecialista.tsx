import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { FichaCompleta, ProyectoConRiesgo } from '../types/api';
import { fetchFicha } from './proyectoDetalleApi';
import { fetchMisProyectos } from './proyectosApi';
import { RiesgoBadge } from './RiesgoBadge';

const FASES_OPERATIVAS = [
  'Inicio',
  'Edición',
  'Corrección',
  'Diseño',
  'Calidad',
  'Digital',
  'Lanzamiento',
  'Impresión',
  'Distribución',
] as const;

type FaseOperativa = (typeof FASES_OPERATIVAS)[number];

// Extiende calcularFaseKanban (MisProyectosPage.tsx, que solo distingue
// hasta Diseño porque el tablero Kanban original tenía cuatro columnas)
// a las ocho fases operativas completas: desde que se estandarizó el
// patrón Macro/Micro en todas las fases, cada una de Edición en
// adelante ya tiene su propio *Estatus agregado — se usa como señal,
// revisando de la última fase hacia atrás (si Distribución tiene
// estatus, ya pasó por todas las anteriores; esto es una inferencia,
// no un campo "fase actual" persistido, igual que el resto de las
// heurísticas de este archivo).
function calcularFaseOperativa(ficha: FichaCompleta | undefined): FaseOperativa {
  if (!ficha) return 'Inicio';

  if (ficha.distribucionEstatus) return 'Distribución';
  if (ficha.impresionEstatus) return 'Impresión';
  if (ficha.lanzamientoEstatus) return 'Lanzamiento';
  if (ficha.digitalEstatus) return 'Digital';
  if (ficha.calidadEstatus) return 'Calidad';

  const enDiseno = Boolean(ficha.disenoEstatus) || Boolean(ficha.disenoBriefCreativo) || ficha.disenoPropuestas.length > 0;
  if (enDiseno) return 'Diseño';

  const enCorreccion =
    Boolean(ficha.correccionEstatus) ||
    Boolean(ficha.correccionTripaCompleta) ||
    Boolean(ficha.correccionPreliminares) ||
    Boolean(ficha.correccionCubiertaExtendida);
  if (enCorreccion) return 'Corrección';

  const enEdicion = Boolean(ficha.edicionEstatus) || ficha.capitulosPactados != null || ficha.paginasPactadas != null;

  return enEdicion ? 'Edición' : 'Inicio';
}

interface ProyectoConFase {
  proyecto: ProyectoConRiesgo;
  fase: FaseOperativa;
}

function TarjetaKpi({
  etiqueta,
  valor,
  detalle,
  alerta,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  alerta?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${alerta ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${alerta ? 'text-red-400' : 'text-gray-400'}`}>{etiqueta}</p>
      <p className={`mt-2 text-2xl font-bold ${alerta ? 'text-red-700' : 'text-gray-900'}`}>{valor}</p>
      <p className={`mt-1 text-xs ${alerta ? 'text-red-600/80' : 'text-gray-500'}`}>{detalle}</p>
    </div>
  );
}

function FilaCuelloDeBotella({ proyecto, fase }: ProyectoConFase) {
  return (
    <tr className="border-b border-gray-100 text-sm text-gray-700 transition-colors last:border-0 hover:bg-gray-50">
      <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900">{proyecto.titulo ?? proyecto.autor.nombre}</td>
      <td className="whitespace-nowrap px-4 py-3">{fase}</td>
      <td className="whitespace-nowrap px-4 py-3">{Math.round(proyecto.riesgo.diasEfectivosTranscurridos)}d</td>
      <td className="whitespace-nowrap px-4 py-3">
        <RiesgoBadge riesgo={proyecto.riesgo} />
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <Link to={`/proyectos/${proyecto.id}`} className="text-xs font-medium text-dorado hover:underline">
          Ver proyecto →
        </Link>
      </td>
    </tr>
  );
}

// Dashboard de "Métricas de Producción" del panel del especialista (ver
// MisProyectosPage.tsx) — reutiliza los mismos dos queries que ya
// alimentan el Kanban (GET /proyectos/mios + una ficha por proyecto),
// sin endpoint analítico propio: no existe todavía un agregado en el
// backend para estas métricas, así que se calculan en memoria sobre la
// misma lista que el especialista ya puede ver completa.
export function MetricasEspecialista() {
  const misProyectosQuery = useQuery({ queryKey: ['proyectos', 'mios'], queryFn: fetchMisProyectos });
  const proyectos = misProyectosQuery.data?.proyectos ?? [];

  const fichaQueries = useQueries({
    queries: proyectos.map((proyecto) => ({
      queryKey: ['ficha', proyecto.id],
      queryFn: () => fetchFicha(proyecto.id),
    })),
  });

  if (misProyectosQuery.isLoading) {
    return <p className="p-6 text-tinta/70">Calculando métricas…</p>;
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

  if (fichasCargando) {
    return <p className="p-6 text-tinta/70">Calculando métricas…</p>;
  }

  const proyectosConFase: ProyectoConFase[] = proyectos.map((proyecto, indice) => ({
    proyecto,
    fase: calcularFaseOperativa(fichaQueries[indice]?.data?.ficha),
  }));

  const proyectosEnRiesgo = proyectosConFase.filter(({ proyecto }) => proyecto.riesgo.enRiesgo || proyecto.riesgo.vencido);

  const conteoPorFase: Record<FaseOperativa, number> = {
    Inicio: 0,
    Edición: 0,
    Corrección: 0,
    Diseño: 0,
    Calidad: 0,
    Digital: 0,
    Lanzamiento: 0,
    Impresión: 0,
    Distribución: 0,
  };
  proyectosConFase.forEach(({ fase }) => {
    conteoPorFase[fase] += 1;
  });

  // Recorre en orden de fase (no de cantidad): con ">" estricto, un
  // empate siempre lo gana la fase que aparece primero en el flujo —
  // desempate determinista, sin depender del orden de llegada de los
  // proyectos.
  let faseCritica: { fase: FaseOperativa; cantidad: number } | null = null;
  for (const fase of FASES_OPERATIVAS) {
    const cantidad = conteoPorFase[fase];
    if (cantidad > 0 && (!faseCritica || cantidad > faseCritica.cantidad)) {
      faseCritica = { fase, cantidad };
    }
  }

  const proyectosOrdenados = [...proyectosEnRiesgo].sort((a, b) => {
    if (a.proyecto.riesgo.vencido !== b.proyecto.riesgo.vencido) {
      return a.proyecto.riesgo.vencido ? -1 : 1;
    }
    return a.proyecto.riesgo.diasRestantes - b.proyecto.riesgo.diasRestantes;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <span className="h-2 w-2 rounded-full bg-dorado" /> Rendimiento Operativo
      </h2>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TarjetaKpi
          etiqueta="Carga de Trabajo"
          valor={String(proyectos.length)}
          detalle={`proyecto${proyectos.length === 1 ? '' : 's'} activo${proyectos.length === 1 ? '' : 's'} bajo tu responsabilidad`}
        />

        <TarjetaKpi
          etiqueta="Riesgo Operativo"
          valor={String(proyectosEnRiesgo.length)}
          detalle="con alertas o fechas vencidas"
          alerta={proyectosEnRiesgo.length > 0}
        />

        <TarjetaKpi
          etiqueta="Fase Crítica"
          valor={faseCritica ? `Cuello de botella actual: ${faseCritica.fase}` : 'Sin cuellos de botella'}
          detalle={
            faseCritica
              ? `${faseCritica.cantidad} proyecto${faseCritica.cantidad === 1 ? '' : 's'} acumulado${faseCritica.cantidad === 1 ? '' : 's'}`
              : 'Distribución pareja entre fases'
          }
        />
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-tinta">Cuellos de botella — atención inmediata</h3>

        {proyectosOrdenados.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <p className="text-sm text-gray-500">Ningún proyecto activo tiene alertas de riesgo o fechas vencidas ahora mismo.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Proyecto</th>
                  <th className="whitespace-nowrap px-4 py-3">Fase Actual</th>
                  <th className="whitespace-nowrap px-4 py-3">Días Acumulados</th>
                  <th className="whitespace-nowrap px-4 py-3">Estatus</th>
                  <th className="whitespace-nowrap px-4 py-3">Acción Rápida</th>
                </tr>
              </thead>
              <tbody>
                {proyectosOrdenados.map(({ proyecto, fase }) => (
                  <FilaCuelloDeBotella key={proyecto.id} proyecto={proyecto} fase={fase} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
