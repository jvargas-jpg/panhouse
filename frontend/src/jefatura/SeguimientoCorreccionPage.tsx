import { useQuery } from '@tanstack/react-query';
import { fetchSeguimientoCorreccion } from '../proyectos/correccionesApi';
import type { EstadoPlazoCorreccion } from '../types/api';

const ETIQUETA_ALCANCE: Record<string, string> = {
  tripa_completa: 'Tripa Completa',
  preliminares: 'Preliminares',
  cubierta_extendida: 'Cubierta Extendida',
};

const ESTADO_ETIQUETA: Record<string, string> = {
  pendiente: 'Pendiente de asignación',
  en_progreso: 'En progreso',
  completado: 'Entregada',
};

const PLAZO_INFO: Record<EstadoPlazoCorreccion, { etiqueta: string; badge: string }> = {
  vencido: { etiqueta: 'Vencido', badge: 'bg-red-100 text-red-800' },
  proximo_a_vencer: { etiqueta: 'Próximo a vencer', badge: 'bg-amber-100 text-amber-800' },
  en_tiempo: { etiqueta: 'En tiempo', badge: 'bg-green-100 text-green-800' },
};

// dueAt es timestamp completo (checkpoint 5B §0.1 — SLAs de 12h, no
// solo de días enteros), a diferencia de un `date` plano — se muestra
// con hora para no esconder esa precisión.
function formatearFechaHora(fechaHora: string | null): string {
  if (!fechaHora) return '—';
  return new Date(fechaHora).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
}

// "Seguimiento de Corrección" (master prompt §18/§21) — la Matriz real
// se llama "Seguimiento Corrección - Innovación Editorial", lo que
// confirma que jefatura necesita una vista de supervisión propia. No
// copia las 25-33 columnas del Excel real (muchas son administrativas/
// de pago, fuera del seguimiento operativo) — solo lo que responde
// pendientes/vencimientos/carga, igual que el resto de esta app deriva
// el riesgo en vez de mostrar una hoja de cálculo completa.
export function SeguimientoCorreccionPage() {
  const query = useQuery({ queryKey: ['correcciones', 'seguimiento'], queryFn: fetchSeguimientoCorreccion });
  const correcciones = query.data?.correcciones ?? [];

  const totalActivas = correcciones.filter((c) => c.estado !== 'completado').length;
  const totalVencidas = correcciones.filter((c) => c.plazo === 'vencido' && c.estado !== 'completado').length;
  const totalSinAsignar = correcciones.filter((c) => !c.correctorId && !c.correctorNombre).length;

  return (
    <div className="animate-fade-in space-y-8 p-6 duration-500 md:p-10">
      <header className="flex flex-col gap-2 border-b border-tinta/10 pb-4">
        <h1 className="text-2xl font-bold text-tinta">Seguimiento de Corrección</h1>
        <p className="text-sm text-tinta/70">Supervisión de todas las intervenciones de corrección activas, sin importar el especialista.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col rounded-xl border border-tinta/10 bg-tinta p-5 text-crema shadow-sm">
          <span className="text-sm font-medium text-crema/70">Correcciones activas</span>
          <span className="mt-2 text-3xl font-bold text-dorado">{totalActivas}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <span className="text-sm font-medium text-red-800/70">Vencidas</span>
          <span className="mt-2 text-3xl font-bold text-red-600">{totalVencidas}</span>
        </div>
        <div className="flex flex-col rounded-xl border border-dorado/30 bg-dorado/10 p-5 shadow-sm">
          <span className="text-sm font-medium text-tinta/70">Sin corrector asignado</span>
          <span className="mt-2 text-3xl font-bold text-tinta">{totalSinAsignar}</span>
        </div>
      </section>

      {query.isLoading && <p className="animate-pulse text-sm text-tinta/70">Cargando seguimiento…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-red-600">
          No se pudo cargar el seguimiento{query.error instanceof Error ? `: ${query.error.message}` : ''}.
        </p>
      )}

      {query.data && correcciones.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">No hay correcciones registradas todavía.</p>
        </div>
      )}

      {correcciones.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Autor</th>
                <th className="px-4 py-3">Alcance</th>
                <th className="px-4 py-3">Corrector</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3">Plazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {correcciones.map((correccion) => (
                <tr key={correccion.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{correccion.autorNombre}</p>
                    <p className="text-xs text-gray-500">
                      #{correccion.proyectoCodigo} · {correccion.servicioCodigo}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{ETIQUETA_ALCANCE[correccion.alcance] ?? correccion.alcance}</td>
                  <td className="px-4 py-3 text-gray-700">{correccion.correctorNombre ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{ESTADO_ETIQUETA[correccion.estado] ?? correccion.estado}</td>
                  <td className="px-4 py-3 text-gray-700">{formatearFechaHora(correccion.dueAt)}</td>
                  <td className="px-4 py-3">
                    {correccion.estado !== 'completado' && correccion.plazo && (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PLAZO_INFO[correccion.plazo].badge}`}>
                        {PLAZO_INFO[correccion.plazo].etiqueta}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
