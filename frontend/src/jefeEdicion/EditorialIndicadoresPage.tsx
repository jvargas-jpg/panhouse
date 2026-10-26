import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useMe } from '../auth/useAuth';
import { RrppIcon } from '../rrpp/RrppIcons';
import { exportarIndicadoresEdicion, fetchIndicadoresEdicion } from './jefeEdicionApi';
import { editorialDate } from './EditorialParts';
import { ActividadEdicion, CardEdicion, DonutEstadoEdicion, FlujoSemanalEdicion, KpisEdicion, RiesgoEdicion, ServiciosEdicion, TablaEditores, TiemposCicloEdicion } from './EditorialIndicadoresComponents';
import type { PresetIndicadoresEdicion } from '../../../shared/editorialIndicadores';
import './editorialIndicadores.css';

const PRESET_LABELS: Record<PresetIndicadoresEdicion, string> = {
  'este-mes': 'Este mes', 'mes-anterior': 'Mes anterior', 'ultimos-3-meses': 'Últimos 3 meses',
  'ultimos-6-meses': 'Últimos 6 meses', 'este-anio': 'Este año', personalizado: 'Rango personalizado',
};

function paramsFor(preset: PresetIndicadoresEdicion, from: string, to: string, service: string, editor: string) {
  const p = new URLSearchParams({ preset });
  if (preset === 'personalizado') { p.set('from', from); p.set('to', to); }
  if (service) p.set('service', service);
  if (editor) p.set('editor', editor);
  return p;
}

export function EditorialIndicadoresPage() {
  const { data: user } = useMe();
  const [preset, setPreset] = useState<PresetIndicadoresEdicion>('este-mes');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [service, setService] = useState(''); const [editor, setEditor] = useState('');
  const [exportando, setExportando] = useState(false); const [errorExport, setErrorExport] = useState('');
  const params = paramsFor(preset, custom.from, custom.to, service, editor);
  const query = useQuery({
    queryKey: ['editorial-chief', user?.id, 'indicadores', params.toString()],
    queryFn: () => fetchIndicadoresEdicion(params),
    enabled: user?.rol === 'jefe_edicion' && (preset !== 'personalizado' || (!!custom.from && !!custom.to)),
  });
  const data = query.data;
  async function exportar() { setExportando(true); setErrorExport(''); try { await exportarIndicadoresEdicion(params); } catch { setErrorExport('No se pudo exportar los indicadores.'); } finally { setExportando(false); } }

  return <div className="eci-indicadores">
    <header className="eci-header">
      <div><span className="eci-eyebrow">ÁREA DE EDICIÓN</span><h1>Indicadores</h1><p>Analiza la actividad del equipo de Edición, los tiempos de entrega y el estado del trabajo editorial.</p></div>
      <div className="eci-period-row">
        <SelectorPeriodo preset={preset} custom={custom} onPreset={setPreset} onCustom={setCustom} />
        {data && data.filters.services.length > 0 && <select aria-label="Filtrar por servicio" value={service} onChange={e => setService(e.target.value)}>
          <option value="">Todos los servicios</option>{data.filters.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        {data && data.filters.editors.length > 0 && <select aria-label="Filtrar por Editor" value={editor} onChange={e => setEditor(e.target.value)}>
          <option value="">Todos los Editores</option>{data.filters.editors.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>}
        <button type="button" className="eci-export" onClick={() => void exportar()} disabled={exportando || !data}><RrppIcon nombre="externo" className="h-4 w-4" />{exportando ? 'Exportando…' : 'Exportar'}</button>
      </div>
    </header>
    {errorExport && <p role="alert" className="eci-note">{errorExport}</p>}
    {user && user.rol !== 'jefe_edicion' ? <p role="alert">No tienes acceso a Indicadores de Edición.</p> : <>
      {query.isLoading && <SkeletonIndicadores />}
      {query.isError && <div role="alert" className="eci-error"><p>No se pudieron cargar los indicadores de este período.</p><button onClick={() => void query.refetch()}>Reintentar</button></div>}
      {data && <div className="eci-stack" aria-busy={query.isFetching}>
        <KpisEdicion data={data} />
        <div className="eci-main-grid">
          <CardEdicion titulo="Estado de las intervenciones editoriales" icono="capas" tooltip="Distribución por estado actual, corte de hoy. No es progreso del período."><p className="eci-caption">Distribución del trabajo de edición, corte de hoy</p><DonutEstadoEdicion data={data.stateDistribution} /></CardEdicion>
          <CardEdicion titulo="Intervenciones por semana" icono="indicadores" tooltip="Iniciadas y completadas según fecha real; vencidas según su fecha exigible, dentro del período."><FlujoSemanalEdicion data={data.weeklyFlow} /></CardEdicion>
        </div>
        <div className="eci-two-grid">
          <CardEdicion titulo="Actividad del equipo editorial" icono="equipo" tooltip="Hechos por Editor: activas y vencidas son corte de hoy; completadas y SLA son del período."><TablaEditores data={data.editors} /></CardEdicion>
          <CardEdicion titulo="Tiempo de ciclo por tipo de intervención" icono="calendario" tooltip="Tiempo bajo responsabilidad de Edición: desde inicio registrado del Editor hasta su entrega."><TiemposCicloEdicion data={data.cycleTimes} /></CardEdicion>
        </div>
        <div className="eci-three-grid">
          <CardEdicion titulo="Intervenciones activas por servicio" icono="proyectos"><ServiciosEdicion data={data.services} /></CardEdicion>
          <CardEdicion titulo="Proyectos con trabajo editorial en riesgo" icono="actividad"><RiesgoEdicion data={data.riskProjects} /></CardEdicion>
          <CardEdicion titulo="Actividad reciente" icono="actividad"><ActividadEdicion items={data.activity} /></CardEdicion>
        </div>
        <p className="eci-footnote">Período: {editorialDate(data.periodo.from, true)} – {editorialDate(data.periodo.to, true)} · Caracas. Comparación (solo Entregas completadas): {editorialDate(data.periodo.anteriorFrom, true)} – {editorialDate(data.periodo.anteriorTo, true)}. Los demás KPI son corte de hoy, sin período anterior comparable.</p>
      </div>}
    </>}
  </div>;
}

function SelectorPeriodo({ preset, custom, onPreset, onCustom }: { preset: PresetIndicadoresEdicion; custom: { from: string; to: string }; onPreset: (p: PresetIndicadoresEdicion) => void; onCustom: (c: { from: string; to: string }) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [error, setError] = useState('');
  return <details className="eci-period" ref={ref}><summary aria-label="Seleccionar período de indicadores"><RrppIcon nombre="calendario" className="h-4 w-4" /><span>{PRESET_LABELS[preset]}</span>
    <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor"><path d="m3 4 3 3 3-3" /></svg></summary>
    <form onSubmit={e => {
      e.preventDefault();
      if (preset === 'personalizado') { if (!custom.from || !custom.to || custom.from > custom.to) { setError('Selecciona un rango válido.'); return; } }
      setError(''); if (ref.current) ref.current.open = false;
    }}>
      <label>Período<select value={preset} onChange={e => { onPreset(e.target.value as PresetIndicadoresEdicion); setError(''); }}>
        {Object.entries(PRESET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {preset === 'personalizado' && <div className="eci-date-fields"><label>Desde<input type="date" required value={custom.from} onChange={e => onCustom({ ...custom, from: e.target.value })} /></label>
        <label>Hasta<input type="date" required value={custom.to} onChange={e => onCustom({ ...custom, to: e.target.value })} /></label></div>}
      {error && <p role="alert">{error}</p>}<button type="submit">Aplicar período</button>
    </form></details>;
}

function SkeletonIndicadores() {
  return <div className="eci-stack" role="status" aria-label="Cargando indicadores">
    <div className="eci-kpis">{[1, 2, 3, 4].map(i => <div key={i} className="eci-card eci-kpi-skeleton" />)}</div>
    <div className="eci-main-grid"><div className="eci-card eci-skeleton-block" /><div className="eci-card eci-skeleton-block" /></div>
  </div>;
}
