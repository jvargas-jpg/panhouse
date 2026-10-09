import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { IndicadoresComerciales } from '../types/api';
import { ICONOS, IndicadorSeccion } from './IndicadoresComponents';

const DORADO = 'var(--indicadores-dorado)';
const NAVY = '#1e3a8a';
export function IndicadoresCharts({ monthly }: { monthly: IndicadoresComerciales['monthly'] }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Grafico monthly={monthly} /><Grafico monthly={monthly} proyectos /></div>;
}
function Grafico({ monthly, proyectos = false }: { monthly: IndicadoresComerciales['monthly']; proyectos?: boolean }) {
  const titulo = proyectos ? 'Proyectos creados vs listos para RRPP' : 'Autores ingresados por mes';
  const hayDatos = monthly.some((m) => proyectos ? m.proyectos > 0 : m.autores > 0);
  return <IndicadorSeccion titulo={titulo} icono={proyectos ? ICONOS.barras : ICONOS.autor} extra={proyectos && <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-dorado" />Proyectos creados</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-900" />Listos para RRPP</span>
  </div>}>
    <div className="relative h-[132px] min-w-0" role="img" aria-label={titulo}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={monthly} margin={{ top: 18, right: 10, left: -10, bottom: 0 }} barCategoryGap="28%" accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#f0f1f4" />
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#d1d5db' }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#d1d5db' }} width={32} />
          <Tooltip cursor={{ fill: '#f8f9fa' }} contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb', fontSize: 12 }} />
          <Bar dataKey={proyectos ? 'proyectos' : 'autores'} name={proyectos ? 'Proyectos creados' : 'Autores ingresados'} fill={DORADO} radius={[2, 2, 0, 0]} maxBarSize={54} isAnimationActive={false}>
            {monthly.length <= 6 && <LabelList dataKey={proyectos ? 'proyectos' : 'autores'} position="top" style={{ fontSize: 10, fontWeight: 600, fill: '#111827' }} formatter={(v) => Number(v) || ''} />}
          </Bar>
          {proyectos && <Bar dataKey="listos" name="Listos para RRPP" fill={NAVY} radius={[2, 2, 0, 0]} maxBarSize={54} isAnimationActive={false}>
            {monthly.length <= 6 && <LabelList dataKey="listos" position="top" style={{ fontSize: 10, fontWeight: 600, fill: '#111827' }} formatter={(v) => Number(v) || ''} />}
          </Bar>}
        </BarChart>
      </ResponsiveContainer>
      {!hayDatos && <p className="absolute inset-0 flex items-center justify-center bg-white/80 text-xs text-gray-500">Sin datos en este período</p>}
    </div>
    <table className="sr-only"><caption>{titulo}{proyectos ? ': preparación actual por mes de creación del proyecto' : ''}</caption><thead><tr><th scope="col">Mes</th><th scope="col">{proyectos ? 'Proyectos creados' : 'Autores ingresados'}</th>{proyectos && <th scope="col">Listos para RRPP</th>}</tr></thead><tbody>{monthly.map((m) => <tr key={m.clave}><th scope="row">{m.clave}</th><td>{proyectos ? m.proyectos : m.autores}</td>{proyectos && <td>{m.listos}</td>}</tr>)}</tbody></table>
  </IndicadorSeccion>;
}
