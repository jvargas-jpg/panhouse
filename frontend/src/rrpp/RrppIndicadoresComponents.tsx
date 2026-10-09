import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RrppIcon } from './RrppIcons';
import type { DistribucionRrpp, FilaIndicadorRrpp, IndicadoresRrpp, MesRrpp } from './rrppIndicadoresApi';
import { Link } from 'react-router-dom';
export const COLORES = ['#3183ff', '#ffbf24', '#0cc58e', '#9254f5', '#94a3b8', '#3f668f'];
function colorCategoria(nombre: string, indice: number) {
  const fijos: Record<string, string> = {
    'En asesoramiento': '#3183ff', 'Esperando fecha': '#ffbf24', 'En espera de lanzamiento': '#0cc58e', Culminado: '#94a3b8',
    'Sin clasificar': '#94a3b8', 'Sin registrar': '#94a3b8', Excelente: '#0cc58e', Bueno: '#3183ff', Regular: '#ffbf24',
    Nuevo: '#94a3b8', 'En curso': '#3183ff', 'En revisión': '#ffbf24', Publicado: '#0cc58e', Suspendido: '#94a3b8', 'En pausa': '#9254f5',
    Completada: '#0cc58e', Bloqueada: '#ffbf24', 'No iniciada': '#94a3b8', 'Futuro Autor': '#3183ff', Novedades: '#ffbf24',
  };
  return fijos[nombre] ?? COLORES[indice % COLORES.length];
}
export const nRrpp = (n: number) => n.toLocaleString('es-VE', { maximumFractionDigits: 1 });
export const fechaIndicador = (fecha: string) => new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`));
export function CardIndicadorRrpp({ titulo, icono = 'indicadores', extra, children }: { titulo: string; icono?: Parameters<typeof RrppIcon>[0]['nombre']; extra?: ReactNode; children: ReactNode }) {
  return <section className="rrpp-i-card" aria-label={titulo}><div className="rrpp-i-card-head"><h2><RrppIcon nombre={icono} className="h-[18px] w-[18px] shrink-0" />{titulo}</h2>{extra}</div>{children}</section>;
}
function Sparkline({ valores, color }: { valores: number[]; color: string }) {
  if (valores.length < 2 || !valores.some(Boolean)) return null;
  const max = Math.max(...valores, 1);
  const puntos = valores.map((v, i) => `${i * 72 / (valores.length - 1)},${36 - v / max * 31}`).join(' ');
  return <svg aria-hidden="true" viewBox="0 0 76 42" className="rrpp-i-spark" style={{ color }}><polygon points={`0,42 ${puntos} 72,42`} fill="currentColor" opacity="0.07" /><polyline points={puntos} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}
export function KpisRrpp({ data }: { data: IndicadoresRrpp }) {
  const s = data.summary;
  const cards = [
    { titulo: 'Proyectos con planificación', valor: nRrpp(s.proyectosConPlan), icono: 'proyectos' as const, color: COLORES[0], cambio: s.comparacionPlanes, serie: data.monthly.map(m => m.planificaciones), nota: 'Planificación activada en el período' },
    { titulo: 'Eventos realizados', valor: nRrpp(s.eventosRealizados), icono: 'calendario' as const, color: COLORES[1], cambio: s.comparacionEventos, serie: data.monthly.map(m => m.eventos), nota: 'Completados · por fecha del evento' },
    { titulo: 'Piezas publicadas', valor: nRrpp(s.piezasPublicadas), icono: 'lanzamiento' as const, color: COLORES[3], cambio: s.comparacionPublicaciones, serie: data.monthly.map(m => m.publicaciones), nota: 'Primera confirmación registrada' },
    { titulo: 'Satisfacción: Excelente', valor: s.satisfaccionExcelente === null ? '—' : `${nRrpp(s.satisfaccionExcelente)}%`, icono: 'check' as const, color: COLORES[2], cambio: undefined, serie: [], nota: `${nRrpp(s.valoraciones)} valoraciones · cohorte del período` },
    { titulo: 'Intereses adicionales', valor: nRrpp(s.oportunidades), icono: 'rapido' as const, color: COLORES[3], cambio: undefined, serie: [], nota: `${nRrpp(data.opportunities.proyectos)} proyectos · intereses explícitos` },
  ];
  return <div className="rrpp-i-kpis">{cards.map(c => <section key={c.titulo} className="rrpp-i-card rrpp-i-kpi" aria-label={c.titulo} title={c.nota}><span className="rrpp-i-kpi-icon" style={{ color: c.color }}><RrppIcon nombre={c.icono} /></span><div className="rrpp-i-kpi-body"><h2>{c.titulo}</h2><div className="rrpp-i-kpi-value"><strong>{c.valor}</strong><Sparkline valores={c.serie} color={c.color!} /></div>{c.cambio !== undefined && <p className="rrpp-i-comparison">{c.cambio === null ? 'Sin base de comparación' : <><span className={c.cambio < 0 ? 'text-amber-700' : 'text-emerald-600'}>{c.cambio < 0 ? '↓' : '↑'} {nRrpp(Math.abs(c.cambio))}%</span><span>vs. período anterior</span></>}</p>}<p className="rrpp-i-kpi-note">{c.nota}</p></div></section>)}</div>;
}
export function VacioIndicador({ children = 'No hay registros en este período.' }: { children?: ReactNode }) { return <p className="rrpp-i-empty">{children}</p>; }
export function BarrasMensualesRrpp({ data, serie, nombre, segunda, nombreSegunda, color = COLORES[0] }: { data: MesRrpp[]; serie: keyof Omit<MesRrpp, 'clave' | 'mes'>; nombre: string; segunda?: keyof Omit<MesRrpp, 'clave' | 'mes'>; nombreSegunda?: string; color?: string }) {
  const hayDatos = data.some(d => d[serie] || (segunda && d[segunda]));
  return <><div className="rrpp-i-chart-legend"><span><i style={{ background: color }} />{nombre}</span>{segunda && <span><i style={{ background: '#cbdffd' }} />{nombreSegunda}</span>}</div><div className="rrpp-i-monthly-chart" role="img" aria-label={`${nombre} por mes. ${data.map(m => `${m.mes}: ${m[serie]}${segunda ? `; ${nombreSegunda}: ${m[segunda]}` : ''}`).join('. ')}`}>{hayDatos ? <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={data} margin={{ top: 8, right: 8, left: -17, bottom: 0 }} barCategoryGap="32%" accessibilityLayer><CartesianGrid vertical={false} stroke="#edf2f8" /><XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#536587' }} interval="preserveStartEnd" /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#536587' }} width={35} /><Tooltip cursor={{ fill: '#f4f7fc' }} contentStyle={{ borderRadius: 8, borderColor: '#e0e8f3', fontSize: 12 }} /><Bar dataKey={serie} name={nombre} fill={color} radius={[3, 3, 0, 0]} maxBarSize={32} isAnimationActive={false} />{segunda && <Bar dataKey={segunda} name={nombreSegunda} fill="#cbdffd" radius={[3, 3, 0, 0]} maxBarSize={32} isAnimationActive={false} />}</BarChart></ResponsiveContainer> : <VacioIndicador>No hay {nombre.toLocaleLowerCase('es')} en este período.</VacioIndicador>}</div><table className="sr-only"><caption>{nombre} por mes</caption><thead><tr><th>Mes</th><th>{nombre}</th>{segunda && <th>{nombreSegunda}</th>}</tr></thead><tbody>{data.map(m => <tr key={m.clave}><th scope="row">{m.clave}</th><td>{m[serie]}</td>{segunda && <td>{m[segunda]}</td>}</tr>)}</tbody></table></>;
}
export function DonutRrpp({ data, unidad = 'proyectos' }: { data: DistribucionRrpp[]; unidad?: string }) {
  const total = data.reduce((n, d) => n + d.cantidad, 0);
  if (!total) return <VacioIndicador />;
  return <div className="rrpp-i-donut-grid"><div className="rrpp-i-donut" role="img" aria-label={`${total} ${unidad}. ${data.map(d => `${d.nombre}: ${d.cantidad} (${d.porcentaje}%)`).join('. ')}`}><ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart accessibilityLayer><Pie data={data} dataKey="cantidad" nameKey="nombre" innerRadius="65%" outerRadius="93%" paddingAngle={1} stroke="#fff" strokeWidth={1} isAnimationActive={false}>{data.map((d, i) => <Cell key={d.nombre} fill={colorCategoria(d.nombre, i)} />)}</Pie><Tooltip formatter={(value, name) => [`${nRrpp(Number(value))} · ${data.find(d => d.nombre === name)?.porcentaje ?? 0}%`, String(name)]} contentStyle={{ borderRadius: 8, fontSize: 12, borderColor: '#e0e8f3' }} /></PieChart></ResponsiveContainer><div className="rrpp-i-donut-center" aria-hidden="true"><strong>{nRrpp(total)}</strong><span>{unidad}</span></div></div><ul className="rrpp-i-distribution">{data.map((d, i) => <li key={d.nombre}><i style={{ background: colorCategoria(d.nombre, i) }} /><span>{d.nombre}</span><strong>{nRrpp(d.cantidad)}</strong><small>{nRrpp(d.porcentaje)}%</small></li>)}</ul></div>;
}
export function RankingRrpp({ data }: { data: DistribucionRrpp[] }) {
  if (!data.length) return <VacioIndicador />;
  return <ul className="rrpp-i-ranking" tabIndex={0} aria-label="Distribución por categoría">{data.map((d, i) => <li key={d.nombre} title={`${d.nombre}: ${d.cantidad} (${d.porcentaje}%)`}><span>{d.nombre}</span><div><i style={{ width: `${d.porcentaje}%`, background: colorCategoria(d.nombre, i) }} /></div><strong>{nRrpp(d.cantidad)}</strong><small>{nRrpp(d.porcentaje)}%</small></li>)}</ul>;
}
export function TablaRrpp({ filas, publicaciones = false, eventos = false, direccion = false }: { filas: FilaIndicadorRrpp[]; publicaciones?: boolean; eventos?: boolean; direccion?: boolean }) {
  if (!filas.length) return <VacioIndicador>{publicaciones ? 'No hay publicaciones registradas en este período.' : eventos ? 'No hay eventos próximos registrados en este período.' : 'No hay lanzamientos próximos registrados.'}</VacioIndicador>;
  return <div className="rrpp-i-table-scroll" tabIndex={0} aria-label={publicaciones ? 'Publicaciones recientes' : 'Próximas fechas'}><table className="rrpp-i-table"><thead><tr><th>{publicaciones ? 'Registro' : eventos ? 'Fecha' : 'Fecha pautada'}</th><th>Proyecto / Autor</th><th>{publicaciones ? 'Pieza' : 'Tipo'}</th><th>{publicaciones ? 'Responsable' : 'Feria / Lugar'}</th><th>Estado</th><th><span className="sr-only">Detalle</span></th></tr></thead><tbody>{filas.map(f => <tr key={f.id}><td>{fechaIndicador(f.fecha)}</td><td><span className="rrpp-i-project">{f.nombre}</span><small>{f.titulo || `#${f.codigo}`}</small></td><td>{f.tipo}</td><td>{(publicaciones ? f.responsable : f.lugar) || 'Sin registrar'}</td><td><span className={`rrpp-i-badge ${/Publicado|Completada|Culminado/.test(f.estado) ? 'rrpp-i-badge-green' : /revisión|Esperando|Bloqueada/.test(f.estado) ? 'rrpp-i-badge-amber' : ''}`}>{f.estado}</span></td><td>{!direccion && <Link aria-label={`Ver ${f.nombre}, proyecto ${f.codigo}`} to={`/rrpp/lanzamientos?${publicaciones ? 'tab=publicaciones&' : eventos ? 'tab=agenda&mes=' + f.fecha.slice(0, 7) + '&' : ''}proyecto=${f.proyectoId}`}><RrppIcon nombre="flecha" className="h-4 w-4" /></Link>}</td></tr>)}</tbody></table></div>;
}
export function MiniStatsRrpp({ stats }: { stats: { label: string; valor: number | null; nota?: string }[] }) {
  return <div className="rrpp-i-stats">{stats.map(s => <section className="rrpp-i-card" key={s.label}><h2>{s.label}</h2><strong>{s.valor === null ? '—' : nRrpp(s.valor)}</strong>{s.nota && <p>{s.nota}</p>}</section>)}</div>;
}
