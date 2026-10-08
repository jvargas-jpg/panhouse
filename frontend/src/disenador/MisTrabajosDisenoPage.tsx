import { useQuery } from '@tanstack/react-query';
import { fetchDisenos } from '../proyectos/disenoApi';
import { TarjetaDiseno } from '../proyectos/SeccionDisenoOperativa';
export function MisTrabajosDisenoPage() {
  const q = useQuery({ queryKey: ['diseno', 'mios'], queryFn: () => fetchDisenos() });
  const trabajos = [...(q.data?.trabajos ?? [])].sort((a, b) => Number(!!a.cerradoEn) - Number(!!b.cerradoEn) || Number(!a.versiones[0]?.feedbackEn) - Number(!b.versiones[0]?.feedbackEn) || (a.dueAt ?? 'z').localeCompare(b.dueAt ?? 'z'));
  return <div className="min-w-0 bg-gray-50 p-4 sm:p-6"><header className="mb-6"><h1 className="text-2xl font-bold text-tinta">Mis trabajos de Diseño</h1><p className="mt-2 text-sm text-gray-500">Entregas, vencimientos, versiones y feedback de tus proyectos.</p></header>{q.isLoading && <p>Cargando trabajos…</p>}{q.error && <p role="alert" className="text-red-700">{q.error instanceof Error ? q.error.message : 'No se pudo cargar'}</p>}{q.data && !trabajos.length && <p className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-gray-500">No tienes trabajos de Diseño asignados.</p>}<div className="space-y-4">{trabajos.map(t => <TarjetaDiseno key={t.id} trabajo={t} />)}</div></div>;
}
