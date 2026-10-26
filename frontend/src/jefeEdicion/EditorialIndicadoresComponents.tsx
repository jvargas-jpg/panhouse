import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RrppIcon } from '../rrpp/RrppIcons';
import { editorialDate } from './EditorialParts';
import type { ActividadIndicadorEdicion, CicloTipoIndicador, DistribucionEstadoEdicion, EditorIndicador, IndicadoresEdicion, ProyectoRiesgoEdicion, SemanaFlujoEdicion, ServicioIndicadorEdicion } from '../../../shared/editorialIndicadores';

// Volumen mayor no es automáticamente positivo (prompt §24-25): paleta neutra, sin semántica
// verde=bueno/rojo=malo salvo donde el dominio ya la justifica (vencida, bloqueada).
export const COLORES_EDICION = ['#3183ff', '#9254f5', '#0cc58e', '#ffbf24', '#94a3b8', '#3f668f', '#e06767'];
const COLOR_ESTADO: Record<string, string> = {
  'En edición': '#3183ff', 'Esperando autor': '#ffbf24', 'Esperando Especialista': '#9254f5',
  'En pausa': '#94a3b8', 'Requiere ajustes': '#e08a3c', Pendiente: '#94a3b8', Completadas: '#0cc58e', Bloqueadas: '#e06767',
};
function colorEstado(nombre: string, indice: number) { return COLOR_ESTADO[nombre] ?? COLORES_EDICION[indice % COLORES_EDICION.length]; }
export const nEdicion = (n: number) => n.toLocaleString('es-VE', { maximumFractionDigits: 1 });

export function CardEdicion({ titulo, icono = 'indicadores', extra, children, tooltip }: { titulo: string; icono?: Parameters<typeof RrppIcon>[0]['nombre']; extra?: ReactNode; children: ReactNode; tooltip?: string }) {
  return <section className="eci-card" aria-label={titulo}><div className="eci-card-head"><h2 title={tooltip}><RrppIcon nombre={icono} className="h-[18px] w-[18px] shrink-0" />{titulo}</h2>{extra}</div>{children}</section>;
}
export function VacioEdicion({ children = 'No hay actividad de Edición en este período.' }: { children?: ReactNode }) { return <p className="eci-empty">{children}</p>; }

export function KpisEdicion({ data }: { data: IndicadoresEdicion }) {
  const k = data.kpis;
  const cards = [
    { titulo: 'Proyectos en edición', valor: k.projectsInEditing, icono: 'proyectos' as const, nota: 'Proyectos con al menos una intervención de Edición activa, corte de hoy. Cada proyecto cuenta una vez.' },
    { titulo: 'Entregas completadas', valor: k.completedDeliveries, icono: 'check' as const, nota: 'Intervenciones de Edición (capítulos y otras) completadas dentro del período seleccionado.' },
    { titulo: 'Intervenciones vencidas', valor: k.overdueInterventions, icono: 'actividad' as const, nota: 'Corte de hoy: intervenciones accionables bajo responsabilidad de Edición cuya fecha exigible ya pasó. No incluye esperas de autor.' },
    { titulo: 'En espera de autor', valor: k.waitingAuthor, icono: 'persona' as const, nota: 'Corte de hoy: intervenciones esperando respuesta del autor. Señal operacional, no necesariamente negativa.' },
  ];
  return <div className="eci-kpis">{cards.map(c => <section key={c.titulo} className="eci-card eci-kpi" aria-label={c.titulo} title={c.nota}><span className="eci-kpi-icon"><RrppIcon nombre={c.icono} /></span>
    <div className="eci-kpi-body"><h2>{c.titulo}</h2><strong>{nEdicion(c.valor.value)}</strong>
      <p className="eci-comparison">{c.valor.snapshot ? <span className="eci-snapshot-tag">Corte actual</span> : c.valor.deltaPct === null ? 'Sin base de comparación' : <><span>{c.valor.deltaPct < 0 ? '↓' : c.valor.deltaPct > 0 ? '↑' : '→'} {nEdicion(Math.abs(c.valor.deltaPct))}%</span><span> vs. período anterior</span></>}</p>
      <p className="eci-kpi-note">{c.nota}</p></div></section>)}</div>;
}

export function DonutEstadoEdicion({ data }: { data: DistribucionEstadoEdicion[] }) {
  const total = data.reduce((n, d) => n + d.cantidad, 0);
  if (!total) return <VacioEdicion>No hay intervenciones de Edición activas.</VacioEdicion>;
  return <div className="eci-donut-grid"><div className="eci-donut" role="img" aria-label={`${total} intervenciones. ${data.map(d => `${d.estado}: ${d.cantidad} (${d.porcentaje}%)`).join('. ')}`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart accessibilityLayer><Pie data={data} dataKey="cantidad" nameKey="estado" innerRadius="65%" outerRadius="93%" paddingAngle={1} stroke="#fff" strokeWidth={1} isAnimationActive={false}>
      {data.map((d, i) => <Cell key={d.estado} fill={colorEstado(d.estado, i)} />)}</Pie>
      <Tooltip formatter={(value, name) => [`${nEdicion(Number(value))} · ${data.find(d => d.estado === name)?.porcentaje ?? 0}%`, String(name)]} contentStyle={{ borderRadius: 8, fontSize: 12, borderColor: '#e0e8f3' }} /></PieChart></ResponsiveContainer>
    <div className="eci-donut-center" aria-hidden="true"><strong>{nEdicion(total)}</strong><span>intervenciones</span></div></div>
    <ul className="eci-distribution">{data.map((d, i) => <li key={d.estado}><i style={{ background: colorEstado(d.estado, i) }} /><span>{d.estado}</span><strong>{nEdicion(d.cantidad)}</strong><small>{nEdicion(d.porcentaje)}%</small></li>)}</ul></div>;
}

export function FlujoSemanalEdicion({ data }: { data: SemanaFlujoEdicion[] }) {
  const series: { key: keyof Omit<SemanaFlujoEdicion, 'semana' | 'from' | 'to'>; nombre: string; color: string }[] = [
    { key: 'iniciadas', nombre: 'Iniciadas', color: COLORES_EDICION[0]! }, { key: 'completadas', nombre: 'Completadas', color: COLORES_EDICION[2]! }, { key: 'vencidas', nombre: 'Vencidas', color: COLORES_EDICION[6]! },
  ];
  const hayDatos = data.some(d => series.some(s => d[s.key] > 0));
  return <><div className="eci-chart-legend">{series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.nombre}</span>)}</div>
    <div className="eci-weekly-chart" role="img" aria-label={`Flujo semanal. ${data.map(m => `${m.semana}: ${series.map(s => `${s.nombre} ${m[s.key]}`).join(', ')}`).join('. ')}`}>
      {hayDatos ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={data} margin={{ top: 8, right: 8, left: -17, bottom: 0 }} barCategoryGap="28%" accessibilityLayer>
        <CartesianGrid vertical={false} stroke="#edf2f8" /><XAxis dataKey="semana" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#536587' }} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#536587' }} width={28} />
        <Tooltip cursor={{ fill: '#f4f7fc' }} contentStyle={{ borderRadius: 8, borderColor: '#e0e8f3', fontSize: 12 }} labelFormatter={(v) => { const s = data.find(d => d.semana === v); return s ? `${editorialDate(s.from)} – ${editorialDate(s.to)}` : String(v); }} />
        {series.map(s => <Bar key={s.key} dataKey={s.key} name={s.nombre} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />)}
      </BarChart></ResponsiveContainer> : <VacioEdicion>No hay flujo de intervenciones registrado en este período.</VacioEdicion>}
    </div></>;
}

export function TablaEditores({ data }: { data: EditorIndicador[] }) {
  if (!data.length) return <VacioEdicion>No hay Editores con intervenciones activas o completadas en este período.</VacioEdicion>;
  return <div className="eci-table-scroll" tabIndex={0}><table className="eci-table"><thead><tr><th>Editor</th><th>Activas</th><th>Vencidas</th><th>Vencen esta semana</th><th>Esperando terceros</th><th>Entregas completadas</th><th>Cumplimiento SLA</th></tr></thead>
    <tbody>{data.map(e => <tr key={e.id}><td data-label="Editor">{e.nombre}</td><td data-label="Activas">{e.activas}</td><td data-label="Vencidas" className={e.vencidas ? 'eci-red' : ''}>{e.vencidas}</td><td data-label="Vencen esta semana">{e.vencenEstaSemana}</td><td data-label="Esperando terceros">{e.esperandoTerceros}</td><td data-label="Entregas completadas">{e.entregasCompletadas}</td>
      <td data-label="Cumplimiento SLA">{e.slaPct === null ? <span className="eci-insufficient">Sin datos</span> : `${nEdicion(e.slaPct)}% (${e.slaMuestras})`}</td></tr>)}</tbody></table></div>;
}

export function TiemposCicloEdicion({ data }: { data: CicloTipoIndicador[] }) {
  if (!data.length) return <VacioEdicion>Datos insuficientes para calcular tiempos de ciclo en este período.</VacioEdicion>;
  const max = Math.max(1, ...data.map(c => c.promedioDias ?? 0));
  return <ul className="eci-cycle-list" aria-label="Tiempo promedio por tipo de intervención">{data.map(c => <li key={c.tipo} title={c.definicion}>
    <span>{c.etiqueta}</span>
    {c.promedioDias === null ? <span className="eci-insufficient">Datos insuficientes</span> : <><div className="eci-cycle-bar"><i style={{ width: `${Math.max(4, (c.promedioDias / max) * 100)}%` }} /></div>
      <strong>{nEdicion(c.promedioDias)} {c.promedioDias === 1 ? 'día' : 'días'}</strong></>}
    <small>{c.muestras} {c.muestras === 1 ? 'muestra' : 'muestras'}</small></li>)}</ul>;
}

export function ServiciosEdicion({ data }: { data: ServicioIndicadorEdicion[] }) {
  if (!data.length) return <VacioEdicion>No hay intervenciones activas por servicio.</VacioEdicion>;
  const max = Math.max(1, ...data.map(d => d.cantidad));
  return <ul className="eci-ranking" aria-label="Intervenciones activas por servicio">{data.map((d, i) => <li key={d.servicio} title={`${d.servicio}: ${d.cantidad}`}>
    <span>{d.servicio}</span><div><i style={{ width: `${(d.cantidad / max) * 100}%`, background: colorEstado(d.servicio, i) }} /></div><strong>{nEdicion(d.cantidad)}</strong></li>)}</ul>;
}

export function RiesgoEdicion({ data }: { data: ProyectoRiesgoEdicion[] }) {
  if (!data.length) return <VacioEdicion>No hay proyectos con intervenciones de Edición en riesgo.</VacioEdicion>;
  return <div className="eci-table-scroll" tabIndex={0}><table className="eci-table"><thead><tr><th>Proyecto / Autor</th><th>En riesgo</th><th>Próxima entrega</th><th>Estado</th></tr></thead>
    <tbody>{data.map(p => <tr key={p.projectId}><td data-label="Proyecto / Autor"><span className="eci-project">{p.title}</span><small>#{p.code} · {p.authors}</small></td><td data-label="En riesgo" className="eci-red">{p.interventionsAtRisk}</td><td data-label="Próxima entrega">{p.nextDelivery ? editorialDate(p.nextDelivery) : 'Sin fecha'}</td><td data-label="Estado">{p.editorialState}</td></tr>)}</tbody></table></div>;
}

export function ActividadEdicion({ items }: { items: ActividadIndicadorEdicion[] }) {
  if (!items.length) return <VacioEdicion>No hay actividad de Edición reciente.</VacioEdicion>;
  return <ul className="eci-activity">{items.map(a => <li key={a.id}><span>{a.text}</span><small>{a.title} · {a.actor}</small><time dateTime={a.at}>{editorialDate(a.at)}</time></li>)}</ul>;
}
