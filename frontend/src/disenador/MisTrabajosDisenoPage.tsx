import { useQuery } from '@tanstack/react-query';
import { fetchDisenos } from '../proyectos/disenoApi';
import { TarjetaDiseno } from '../proyectos/SeccionDisenoOperativa';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import { PageHeader } from '../design-system/components';
export function MisTrabajosDisenoPage() {
  const q = useQuery({ queryKey: ['diseno', 'mios'], queryFn: () => fetchDisenos() });
  const trabajos = [...(q.data?.trabajos ?? [])].sort((a, b) => Number(!!a.cerradoEn) - Number(!!b.cerradoEn) || Number(!a.versiones[0]?.feedbackEn) - Number(!b.versiones[0]?.feedbackEn) || (a.dueAt ?? 'z').localeCompare(b.dueAt ?? 'z'));
  return <CrmSidebarLayout nav={<Link to="/" aria-current="page"><RrppIcon nombre="conceptos"/>Mis trabajos de Diseño</Link>} contentMaxWidth="max-w-[1440px]" contentClassName="p-4 sm:p-6"><PageHeader title="Mis trabajos de Diseño" description="Entregas, vencimientos, versiones y feedback de tus proyectos."/>{q.isLoading && <p>Cargando trabajos…</p>}{q.error && <p role="alert" className="text-red-700">{q.error instanceof Error ? q.error.message : 'No se pudo cargar'}</p>}{q.data && !trabajos.length && <p className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-gray-500">No tienes trabajos de Diseño asignados.</p>}<div className="space-y-4">{trabajos.map(t => <TarjetaDiseno key={t.id} trabajo={t} />)}</div></CrmSidebarLayout>;
}
