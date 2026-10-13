import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DistribucionIndicador,
  EspecialistaIndicador,
  MesIndicadorJefatura,
} from '../../../shared/indicadoresJefatura';
import { numeroIndicador, VacioIndicadores } from './IndicadoresElements';
const COLORS = [
  '#244b77',
  '#5287b8',
  '#caa14a',
  '#8fb9d1',
  '#94a1b2',
  '#697487',
];
const tooltipStyle = {
  borderRadius: 10,
  borderColor: '#e4e8ef',
  fontSize: 12,
  boxShadow: '0 3px 12px #14263d10',
};
export function TendenciaIndicadores({
  data,
  lineas = false,
}: {
  data: MesIndicadorJefatura[];
  lineas?: boolean;
}) {
  const hay = data.some((d) => (lineas ? d.ingresos || d.cierres : d.cierres));
  return (
    <>
      <div className="ji-chart-legend">
        <span>
          <i style={{ background: lineas ? '#244b77' : '#caa14a' }} />
          {lineas ? 'Ingresos a Producción' : 'Cierres registrados'}
        </span>
        {lineas && (
          <span>
            <i style={{ background: '#caa14a' }} />
            Cierres registrados
          </span>
        )}
      </div>
      <div
        className="ji-chart"
        role="img"
        aria-label={
          lineas
            ? 'Ingresos a Producción y cierres por mes'
            : 'Cierres registrados por mes'
        }
      >
        {!hay ? (
          <VacioIndicadores>
            {lineas
              ? 'Sin movimientos registrados en estos meses.'
              : 'No hay cierres con fecha verificable en estos meses.'}
          </VacioIndicadores>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {lineas ? (
              <LineChart
                data={data}
                margin={{ top: 14, right: 14, left: -15, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} stroke="#edf0f4" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelFormatter={(_, payload) => payload[0]?.payload.clave}
                />
                <Line
                  type="linear"
                  dataKey="ingresos"
                  name="Ingresos a Producción"
                  stroke="#244b77"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="cierres"
                  name="Cierres registrados"
                  stroke="#caa14a"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            ) : (
              <BarChart
                data={data}
                margin={{ top: 14, right: 10, left: -15, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid vertical={false} stroke="#edf0f4" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: '#f7f8fa' }}
                  labelFormatter={(_, payload) => payload[0]?.payload.clave}
                />
                <Bar
                  dataKey="cierres"
                  name="Cierres registrados"
                  fill="#d3b06b"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                  isAnimationActive={false}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
      <table className="sr-only">
        <caption>Valores mensuales registrados</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Ingresos</th>
            <th>Asignaciones</th>
            <th>Cierres</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.clave}>
              <th>{d.clave}</th>
              <td>{d.ingresos}</td>
              <td>{d.asignaciones}</td>
              <td>{d.cierres ?? 'Sin datos suficientes'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
export function DonutIndicadores({
  data,
  centro = 'Activos',
}: {
  data: DistribucionIndicador[];
  centro?: string;
}) {
  const total = data.reduce((sum, r) => sum + r.cantidad, 0);
  if (!total) return <VacioIndicadores />;
  return (
    <div className="ji-donut">
      <div
        className="ji-donut-chart"
        role="img"
        aria-label={`${total} ${centro.toLowerCase()} por categoría`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              dataKey="cantidad"
              nameKey="nombre"
              innerRadius="65%"
              outerRadius="94%"
              paddingAngle={2}
              stroke="#fff"
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={d.id} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="ji-donut-center">
          <strong>{numeroIndicador(total)}</strong>
          <span>{centro}</span>
        </div>
      </div>
      <ul className="ji-distribution-legend">
        {data.map((d, i) => (
          <li key={d.id}>
            <i style={{ background: COLORS[i % COLORS.length] }} />
            <span>{d.nombre}</span>
            <strong>
              {d.cantidad}
              <small> {Math.round((d.cantidad / total) * 100)}%</small>
            </strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
export function CargaIndicadores({
  equipo,
}: {
  equipo: EspecialistaIndicador[];
}) {
  const data = equipo.slice(0, 7);
  if (!data.some((e) => e.carga))
    return (
      <VacioIndicadores>
        No hay carga asignada con estos filtros.
      </VacioIndicadores>
    );
  const max = Math.max(...data.map((e) => e.carga), 1);
  return (
    <ol className="ji-load-ranking">
      {data.map((e) => (
        <li key={e.id}>
          <span title={e.nombre}>{e.nombre}</span>
          <div>
            <i style={{ width: `${(e.carga / max) * 100}%` }} />
          </div>
          <strong>
            {numeroIndicador(e.carga)}
            <small> pt</small>
          </strong>
        </li>
      ))}
    </ol>
  );
}
