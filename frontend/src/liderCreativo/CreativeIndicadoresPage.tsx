import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useMe } from '../auth/useAuth';
import { RrppIcon } from '../rrpp/RrppIcons';
import { exportarIndicadoresCreativos, fetchIndicadoresCreativos, hoyIndicadoresCreativos, rangoCreativo, type PresetCreativo } from './creativeIndicadoresApi';
import { BarrasMensualesCreativas, CardIndicador, DonutCreativo, fechaIndicadorCreativo, KpisCreativos, ListaActividadCreativa, RankingCreativo, TablaHitos, TarjetaCarga, TiemposCiclo } from './CreativeIndicadoresComponents';
import './creativeIndicadores.css';

export function CreativeIndicadoresPage() {
  const { data: user } = useMe();
  const [rango, setRango] = useState(() => rangoCreativo('ano', hoyIndicadoresCreativos()));
  const [servicio, setServicio] = useState<string>('');
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState('');
  const query = useQuery({
    queryKey: ['creative-leader', user?.id, 'indicadores', rango.from, rango.to, servicio],
    queryFn: () => fetchIndicadoresCreativos(rango.from, rango.to, servicio || undefined),
    enabled: user?.rol === 'lider_creativo',
  });
  const data = query.data;
  async function exportar() {
    setExportando(true); setErrorExport('');
    try { await exportarIndicadoresCreativos(rango.from, rango.to, servicio || undefined); }
    catch { setErrorExport('No se pudo exportar los indicadores.'); }
    finally { setExportando(false); }
  }
  return <div className="ci-indicadores">
    <header className="ci-i-header">
      <div><span className="ci-eyebrow">DIRECCIÓN CREATIVA</span><h1>Indicadores</h1><p>Panorama de la actividad y los tiempos del proceso creativo en los proyectos en los que participas.</p></div>
      <div className="ci-period-row">
        <SelectorPeriodo rango={rango} cambiar={setRango} />
        {data && data.filters.services.length > 0 && <select aria-label="Filtrar por servicio" value={servicio} onChange={e => setServicio(e.target.value)}>
          <option value="">Todos los servicios</option>{data.filters.services.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>}
        <button type="button" className="ci-export" onClick={() => void exportar()} disabled={exportando || !data}><RrppIcon nombre="externo" className="h-4 w-4" />{exportando ? 'Exportando…' : 'Exportar'}</button>
      </div>
    </header>
    {errorExport && <p role="alert" className="ci-note">{errorExport}</p>}
    {user && user.rol !== 'lider_creativo' ? <p role="alert">No tienes acceso a Indicadores de Dirección Creativa.</p> : <>
      {query.isLoading && <SkeletonIndicadoresCreativos />}
      {query.isError && <div role="alert" className="ci-error"><p>No se pudieron cargar los indicadores de este período.</p><button onClick={() => void query.refetch()}>Reintentar</button></div>}
      {data && <div className="ci-stack" aria-busy={query.isFetching}>
        <KpisCreativos data={data} />
        <div className="ci-main-grid">
          <CardIndicador titulo="Evolución de intervenciones creativas" icono="indicadores"><BarrasMensualesCreativas data={data.monthly} /></CardIndicador>
          <CardIndicador titulo="Estado actual de proyectos creativos" icono="proyectos" tooltip="Distribución por estado actual, no porcentaje de avance."><DonutCreativo data={data.stateDistribution} /></CardIndicador>
        </div>
        <div className="ci-three-grid">
          <CardIndicador titulo="Proyectos por servicio" icono="libro"><RankingCreativo data={data.byService} /></CardIndicador>
          <CardIndicador titulo="Tiempo promedio por fase" icono="calendario" tooltip="Tiempo bajo responsabilidad de Dirección Creativa; excluye esperas de RRPP, autor o Diseño cuando el dato lo permite determinar."><TiemposCiclo data={data.cycleTimes} /></CardIndicador>
          <CardIndicador titulo="Carga de trabajo actual" icono="equipo"><TarjetaCarga workload={data.workload} /></CardIndicador>
        </div>
        <div className="ci-two-grid">
          <CardIndicador titulo="Hitos recientes" icono="check"><TablaHitos filas={data.milestones} /></CardIndicador>
          <CardIndicador titulo="Actividad reciente (Dirección Creativa)" icono="actividad"><ListaActividadCreativa items={data.activity} /></CardIndicador>
        </div>
        <p className="ci-footnote">Período inclusivo: {fechaIndicadorCreativo(data.periodo.from)} – {fechaIndicadorCreativo(data.periodo.to)} · Caracas. Comparación: {fechaIndicadorCreativo(data.periodo.anteriorFrom)} – {fechaIndicadorCreativo(data.periodo.anteriorTo)} ({data.periodo.dias} días en cada intervalo). Métricas de tu participación actual en cada intervención; una reasignación puede mover el histórico al nuevo responsable.</p>
      </div>}
    </>}
  </div>;
}

function SelectorPeriodo({ rango, cambiar }: { rango: { from: string; to: string }; cambiar: (r: { from: string; to: string }) => void }) {
  const [preset, setPreset] = useState<PresetCreativo>('ano'); const [draft, setDraft] = useState(rango); const [error, setError] = useState(''); const ref = useRef<HTMLDetailsElement>(null);
  return <details className="ci-period" ref={ref}><summary aria-label="Seleccionar período de indicadores"><RrppIcon nombre="calendario" className="h-4 w-4" /><span>{fechaIndicadorCreativo(rango.from)} – {fechaIndicadorCreativo(rango.to)}</span>
    <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor"><path d="m3 4 3 3 3-3" /></svg></summary>
    <form onSubmit={e => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      const fechas = { from: String(form.get('from') ?? ''), to: String(form.get('to') ?? '') };
      if (!fechas.from || !fechas.to || fechas.from > fechas.to || (Date.parse(fechas.to) - Date.parse(fechas.from)) / 86400000 > 731) { setError('Selecciona un rango válido de hasta 732 días.'); return; }
      cambiar(fechas); setDraft(fechas); setError(''); if (ref.current) ref.current.open = false;
    }}>
      <label>Período<select value={preset} onChange={e => { const value = e.target.value as PresetCreativo; setPreset(value); setError(''); if (value !== 'custom') setDraft(rangoCreativo(value, hoyIndicadoresCreativos())); }}>
        <option value="mes">Mes actual</option><option value="3m">Últimos 3 meses</option><option value="6m">Últimos 6 meses</option><option value="ano">Año actual</option><option value="custom">Rango personalizado</option></select></label>
      <div className="ci-date-fields"><label>Desde<input type="date" name="from" required value={draft.from} onChange={e => { setPreset('custom'); setDraft({ ...draft, from: e.target.value }); }} /></label>
        <label>Hasta<input type="date" name="to" required value={draft.to} onChange={e => { setPreset('custom'); setDraft({ ...draft, to: e.target.value }); }} /></label></div>
      {error && <p role="alert">{error}</p>}<p>Meses calendario hasta hoy. Ambos extremos incluidos.</p><button type="submit">Aplicar período</button>
    </form></details>;
}

function SkeletonIndicadoresCreativos() {
  return <div className="ci-stack" role="status" aria-label="Cargando indicadores">
    <div className="ci-kpis">{[1, 2, 3, 4].map(i => <div key={i} className="ci-card ci-kpi-skeleton" />)}</div>
    <div className="ci-main-grid"><div className="ci-card ci-skeleton-block" /><div className="ci-card ci-skeleton-block" /></div>
  </div>;
}
