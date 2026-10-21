import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { RrppIcon } from '../rrpp/RrppIcons';
import type { CicloCreativo, CreativeActivity, DistribucionCreativa, HitoCreativo, IndicadoresCreativos, MesCreativo } from './creativeIndicadoresApi';

// Volumen mayor no significa "mejor": paleta neutra, sin semántica verde/rojo (ver docs/arquitectura/28-direccion-creativa-indicadores.md).
export const COLORES = ['#3183ff', '#9254f5', '#0cc58e', '#ffbf24', '#94a3b8', '#3f668f'];
function colorCategoria(nombre: string, indice: number) {
  const fijos: Record<string, string> = {
    'Brief / reunión': '#3183ff', Conceptos: '#9254f5', Recursos: '#ffbf24', Cubierta: '#0cc58e', Completado: '#94a3b8', Bloqueada: '#e06767',
  };
  return fijos[nombre] ?? COLORES[indice % COLORES.length];
}
export const nCreativo = (n: number) => n.toLocaleString('es-VE', { maximumFractionDigits: 1 });
export const fechaIndicadorCreativo = (fecha: string) => new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(fecha.length === 10 ? `${fecha}T12:00:00Z` : fecha));
export function CardIndicador({ titulo, icono = 'indicadores', extra, children, tooltip }: { titulo: string; icono?: Parameters<typeof RrppIcon>[0]['nombre']; extra?: ReactNode; children: ReactNode; tooltip?: string }) {
  return <section className="ci-card" aria-label={titulo}><div className="ci-card-head"><h2 title={tooltip}><RrppIcon nombre={icono} className="h-[18px] w-[18px] shrink-0" />{titulo}</h2>{extra}</div>{children}</section>;
}
export function VacioIndicador({ children = 'No hay actividad creativa en este período.' }: { children?: ReactNode }) { return <p className="ci-empty">{children}</p>; }

export function KpisCreativos({ data }: { data: IndicadoresCreativos }) {
  const s = data.summary;
  const cards = [
    { titulo: 'Briefs elaborados', valor: s.briefsElaborados, icono: 'proceso' as const, cambio: s.comparacionBriefs, nota: 'Briefs finalizados y enviados al Especialista en el período.' },
    { titulo: 'Conceptos creados', valor: s.conceptosCreados, icono: 'conceptos' as const, cambio: s.comparacionConceptos, nota: 'Propuestas de concepto de portada registradas (no proyectos; un proyecto puede tener varias).' },
    { titulo: 'Recursos entregados', valor: s.recursosEntregados, icono: 'ingreso' as const, cambio: s.comparacionRecursos, nota: 'Entregas formales de imagen + PDF del concepto aprobado por el autor, completas.' },
    { titulo: 'Cubiertas verificadas', valor: s.cubiertasVerificadas, icono: 'check' as const, cambio: s.comparacionCubiertas, nota: 'Verificaciones de cubierta extendida registradas por Dirección Creativa (aprobadas o con ajustes).' },
  ];
  return <div className="ci-kpis">{cards.map(c => <section key={c.titulo} className="ci-card ci-kpi" aria-label={c.titulo} title={c.nota}><span className="ci-kpi-icon"><RrppIcon nombre={c.icono} /></span>
    <div className="ci-kpi-body"><h2>{c.titulo}</h2><strong>{nCreativo(c.valor)}</strong>
      <p className="ci-comparison">{c.cambio === null ? 'Sin base de comparación' : <><span>{c.cambio! < 0 ? '↓' : c.cambio! > 0 ? '↑' : '→'} {nCreativo(Math.abs(c.cambio!))}%</span><span> vs. período anterior</span></>}</p>
      <p className="ci-kpi-note">{c.nota}</p></div></section>)}</div>;
}

export function BarrasMensualesCreativas({ data }: { data: MesCreativo[] }) {
  const series: { key: keyof Omit<MesCreativo, 'clave' | 'mes'>; nombre: string; color: string }[] = [
    { key: 'briefs', nombre: 'Briefs finalizados', color: COLORES[0]! },
    { key: 'conceptos', nombre: 'Conceptos creados', color: COLORES[1]! },
    { key: 'recursos', nombre: 'Recursos entregados', color: COLORES[2]! },
    { key: 'cubiertas', nombre: 'Cubiertas verificadas', color: COLORES[3]! },
  ];
  const hayDatos = data.some(d => series.some(s => d[s.key] > 0));
  return <><div className="ci-chart-legend">{series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.nombre}</span>)}</div>
    <div className="ci-monthly-chart" role="img" aria-label={`Evolución mensual. ${data.map(m => `${m.mes}: ${series.map(s => `${s.nombre} ${m[s.key]}`).join(', ')}`).join('. ')}`}>
      {hayDatos ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={data} margin={{ top: 8, right: 8, left: -17, bottom: 0 }} barCategoryGap="28%" accessibilityLayer>
        <CartesianGrid vertical={false} stroke="#edf2f8" /><XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#536587' }} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#536587' }} width={35} />
        <Tooltip cursor={{ fill: '#f4f7fc' }} contentStyle={{ borderRadius: 8, borderColor: '#e0e8f3', fontSize: 12 }} />
        {series.map(s => <Bar key={s.key} dataKey={s.key} name={s.nombre} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />)}
      </BarChart></ResponsiveContainer> : <VacioIndicador>No hay registros de actividad creativa en este período.</VacioIndicador>}
    </div>
    <table className="sr-only"><caption>Evolución mensual</caption><thead><tr><th>Mes</th>{series.map(s => <th key={s.key}>{s.nombre}</th>)}</tr></thead>
      <tbody>{data.map(m => <tr key={m.clave}><th scope="row">{m.clave}</th>{series.map(s => <td key={s.key}>{m[s.key]}</td>)}</tr>)}</tbody></table></>;
}

export function DonutCreativo({ data, unidad = 'proyectos' }: { data: DistribucionCreativa[]; unidad?: string }) {
  const total = data.reduce((n, d) => n + d.cantidad, 0);
  if (!total) return <VacioIndicador />;
  return <div className="ci-donut-grid"><div className="ci-donut" role="img" aria-label={`${total} ${unidad}. ${data.map(d => `${d.nombre}: ${d.cantidad} (${d.porcentaje}%)`).join('. ')}`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart accessibilityLayer><Pie data={data} dataKey="cantidad" nameKey="nombre" innerRadius="65%" outerRadius="93%" paddingAngle={1} stroke="#fff" strokeWidth={1} isAnimationActive={false}>
      {data.map((d, i) => <Cell key={d.nombre} fill={colorCategoria(d.nombre, i)} />)}</Pie>
      <Tooltip formatter={(value, name) => [`${nCreativo(Number(value))} · ${data.find(d => d.nombre === name)?.porcentaje ?? 0}%`, String(name)]} contentStyle={{ borderRadius: 8, fontSize: 12, borderColor: '#e0e8f3' }} /></PieChart></ResponsiveContainer>
    <div className="ci-donut-center" aria-hidden="true"><strong>{nCreativo(total)}</strong><span>{unidad}</span></div></div>
    <ul className="ci-distribution">{data.map((d, i) => <li key={d.nombre}><i style={{ background: colorCategoria(d.nombre, i) }} /><span>{d.nombre}</span><strong>{nCreativo(d.cantidad)}</strong><small>{nCreativo(d.porcentaje)}%</small></li>)}</ul></div>;
}

export function RankingCreativo({ data }: { data: DistribucionCreativa[] }) {
  if (!data.length) return <VacioIndicador />;
  return <ul className="ci-ranking" tabIndex={0} aria-label="Distribución por categoría">{data.map((d, i) => <li key={d.nombre} title={`${d.nombre}: ${d.cantidad} (${d.porcentaje}%)`}>
    <span>{d.nombre}</span><div><i style={{ width: `${d.porcentaje}%`, background: colorCategoria(d.nombre, i) }} /></div><strong>{nCreativo(d.cantidad)}</strong><small>{nCreativo(d.porcentaje)}%</small></li>)}</ul>;
}

export function TiemposCiclo({ data }: { data: CicloCreativo[] }) {
  const max = Math.max(1, ...data.map(c => c.promedioDias ?? 0));
  return <ul className="ci-cycle-list" aria-label="Tiempo promedio por fase">{data.map(c => <li key={c.id}>
    <span>{c.etiqueta}</span>
    {c.promedioDias === null ? <span className="ci-cycle-insufficient">Datos insuficientes</span> : <><div className="ci-cycle-bar"><i style={{ width: `${Math.max(4, (c.promedioDias / max) * 100)}%` }} /></div>
      <strong>{nCreativo(c.promedioDias)} {c.promedioDias === 1 ? 'día' : 'días'}</strong></>}
    <small>{c.muestras} {c.muestras === 1 ? 'muestra' : 'muestras'}</small></li>)}</ul>;
}

export function TarjetaCarga({ workload }: { workload: IndicadoresCreativos['workload'] }) {
  const stats = [
    { label: 'Intervenciones activas', valor: workload.activas, nota: 'Requieren tu atención ahora mismo' },
    { label: 'En espera de terceros', valor: workload.enEsperaTerceros, nota: 'RRPP, autor, Diseño o Especialista' },
    { label: 'Completadas en el período', valor: workload.completadasPeriodo, nota: 'Cerradas dentro del rango seleccionado' },
  ];
  return <div className="ci-workload">{stats.map(s => <div key={s.label} className="ci-workload-item"><strong>{nCreativo(s.valor)}</strong><span>{s.label}</span><small>{s.nota}</small></div>)}</div>;
}

export function TablaHitos({ filas }: { filas: HitoCreativo[] }) {
  if (!filas.length) return <VacioIndicador>No hay hitos recientes en este período.</VacioIndicador>;
  return <div className="ci-table-scroll" tabIndex={0} aria-label="Hitos recientes"><table className="ci-table"><thead><tr><th>Fecha</th><th>Proyecto / Autor</th><th>Servicio</th><th>Hito</th></tr></thead>
    <tbody>{filas.map(f => <tr key={f.id}><td>{fechaIndicadorCreativo(f.fecha)}</td><td><span className="ci-project">{f.titulo}</span><small>#{f.codigo} · {f.autores}</small></td><td>{f.servicio}</td><td>{f.hito}</td></tr>)}</tbody></table></div>;
}

export function ListaActividadCreativa({ items }: { items: CreativeActivity[] }) {
  if (!items.length) return <VacioIndicador>No hay actividad creativa reciente.</VacioIndicador>;
  return <ul className="ci-activity">{items.map(a => <li key={a.id}><Link to={a.href}><span>{a.label}</span><small>{a.projectTitle} · {a.actor}</small><time dateTime={a.at}>{fechaIndicadorCreativo(a.at)}</time></Link></li>)}</ul>;
}
